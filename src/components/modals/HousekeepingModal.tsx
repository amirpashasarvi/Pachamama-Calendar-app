import React, { useMemo, useEffect, useState } from 'react';
import { X, SprayCan, AlertTriangle, CheckCircle2, Circle, RotateCcw, Clock, MessageSquare, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, Booking, HousekeepingRecord, UserRecord } from '@/types';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInHours, differenceInDays, isToday, startOfToday } from 'date-fns';

interface HousekeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  bookings: Booking[];
  housekeeping: HousekeepingRecord[];
  updateStatus: (roomId: string, updates: Partial<HousekeepingRecord>, actorName?: string) => Promise<void>;
  checkAutoDirty: () => Promise<void>;
  users: UserRecord[];
  currentUserName?: string;
}

function isMiddleState(status: string) {
  return status === 'cleaned' || status === 'inspected';
}

export default function HousekeepingModal({
  isOpen,
  onClose,
  rooms,
  bookings,
  housekeeping,
  updateStatus,
  checkAutoDirty: _checkAutoDirty,
  users: _users,
  currentUserName,
}: HousekeepingModalProps) {
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Set<string>>(new Set());
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});

  // checkAutoDirty runs on app load and every 30 minutes via useHousekeeping.
  // Triggering it again on modal open created a race condition: the async loop
  // captured stale housekeeping state, then wrote 'dirty' after the user had
  // already clicked 'Room Cleaned', clobbering the action.

  const sortedRoomCards = useMemo(() => {
    return rooms.map(room => {
      const record = housekeeping.find(h => h.roomId === room.id) || {
        roomId: room.id,
        status: 'clean' as const,
        cleaned: true,
        inspected: true,
        lastCheckout: null,
        nextCheckin: null,
        lastUpdated: new Date().toISOString(),
      };

      const nextBooking = bookings
        .filter(b => b.roomId === room.id && parseISO(b.checkIn) >= startOfToday())
        .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())[0];

      const lastCheckoutBooking = bookings
        .filter(b => b.roomId === room.id && parseISO(b.checkOut) <= startOfToday())
        .sort((a, b) => parseISO(b.checkOut).getTime() - parseISO(a.checkOut).getTime())[0];

      const isUrgent =
        record.status !== 'clean' &&
        nextBooking &&
        isToday(parseISO(nextBooking.checkIn)) &&
        differenceInHours(parseISO(nextBooking.checkIn + 'T15:00:00'), new Date()) < 3;

      return { room, record, nextBooking, lastCheckoutBooking, isUrgent };
    }).sort((a, b) => {
      const w: Record<string, number> = { dirty: 0, inspected: 1, cleaned: 1, clean: 2 };
      const wa = w[a.record.status] ?? 1;
      const wb = w[b.record.status] ?? 1;
      if (wa !== wb) return wa - wb;
      return a.room.order - b.room.order;
    });
  }, [rooms, housekeeping, bookings]);

  const summary = useMemo(() => ({
    dirty: sortedRoomCards.filter(c => c.record.status === 'dirty').length,
    cleaned: sortedRoomCards.filter(c => isMiddleState(c.record.status)).length,
    urgent: sortedRoomCards.filter(c => c.isUrgent).length,
    allReady: sortedRoomCards.every(c => c.record.status === 'clean'),
  }), [sortedRoomCards]);

  const handleNotesSave = async (roomId: string, notes: string) => {
    setSavingNotes(s => ({ ...s, [roomId]: true }));
    await updateStatus(roomId, { notes, notesUpdatedAt: new Date().toISOString() }, currentUserName);
    setSavingNotes(s => ({ ...s, [roomId]: false }));
  };

  const toggleHistory = (roomId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      return next;
    });
  };

  const openNote = (roomId: string) =>
    setEditingNotes(prev => new Set([...prev, roomId]));

  const closeNote = (roomId: string) =>
    setEditingNotes(prev => { const n = new Set(prev); n.delete(roomId); return n; });

  const StatusDot = ({ status }: { status: string }) => {
    if (status === 'dirty') return <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)] shrink-0" />;
    if (isMiddleState(status)) return <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] shrink-0" />;
    return <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)] shrink-0" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-gray-50 flex flex-col pt-safe pb-safe px-safe"
        >
          {/* Header */}
          <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
                <SprayCan size={16} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Housekeeping</h2>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                {summary.allReady ? (
                  <span className="text-green-600 font-bold">All rooms ready</span>
                ) : (
                  <>
                    {summary.dirty > 0 && (
                      <span className="font-bold text-rose-500">{summary.dirty} dirty</span>
                    )}
                    {summary.cleaned > 0 && (
                      <span className="font-bold text-amber-500">
                        {summary.dirty > 0 && '· '}{summary.cleaned} cleaned
                      </span>
                    )}
                    {summary.urgent > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {summary.urgent} check-in today
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={20} />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">

            {/* Today's tasks summary strip */}
            {!summary.allReady && (
              <div className="max-w-7xl mx-auto mb-4 flex items-center gap-2 flex-wrap">
                {summary.urgent > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold">
                    <AlertTriangle size={13} />
                    {summary.urgent} check-in today — clean urgently
                  </div>
                )}
                {summary.dirty > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                    {summary.dirty} {summary.dirty === 1 ? 'room needs' : 'rooms need'} cleaning
                  </div>
                )}
                {summary.cleaned > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                    {summary.cleaned} {summary.cleaned === 1 ? 'room awaits' : 'rooms await'} inspection
                  </div>
                )}
              </div>
            )}

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sortedRoomCards.map(({ room, record, nextBooking, lastCheckoutBooking, isUrgent }) => {
                const historyOpen = expandedHistory.has(room.id);
                const noteOpen = editingNotes.has(room.id);
                const history = record.history || [];
                const daysUntilCheckin = nextBooking
                  ? differenceInDays(parseISO(nextBooking.checkIn), startOfToday())
                  : null;

                return (
                  <div
                    key={room.id}
                    className={cn(
                      'bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-all',
                      record.status === 'dirty' ? 'border-rose-100' :
                      isMiddleState(record.status) ? 'border-amber-100' : 'border-gray-100'
                    )}
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-3 p-4 pb-3">
                      <div className="pt-1 shrink-0">
                        <StatusDot status={record.status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-black truncate">{room.name}</h3>
                          {isUrgent && (
                            <div className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 animate-bounce">
                              <AlertTriangle size={9} />
                              URGENT
                            </div>
                          )}
                        </div>

                        {/* Last checkout */}
                        {record.status === 'dirty' && lastCheckoutBooking && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Checked out: <span className="font-bold text-gray-600">{lastCheckoutBooking.guestName}</span>
                          </p>
                        )}

                        {/* Next check-in — visible for any booking within 14 days */}
                        {nextBooking && daysUntilCheckin !== null && daysUntilCheckin <= 14 && (
                          <p className={cn(
                            'text-xs font-bold mt-1 flex items-center gap-1',
                            daysUntilCheckin === 0 ? 'text-orange-500' :
                            daysUntilCheckin <= 2 ? 'text-amber-500' :
                            'text-gray-400'
                          )}>
                            {daysUntilCheckin === 0 && <AlertTriangle size={11} className="shrink-0" />}
                            Next: {nextBooking.guestName} ·{' '}
                            {daysUntilCheckin === 0 ? 'today' :
                             daysUntilCheckin === 1 ? 'tomorrow' :
                             `in ${daysUntilCheckin} days`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons — two-step workflow preserved */}
                    <div className="px-4 pb-3 space-y-2">
                      <button
                        onClick={() => updateStatus(room.id, { cleaned: !record.cleaned, inspected: false }, currentUserName)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left group',
                          record.cleaned
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white border-gray-100 text-gray-400 hover:border-amber-100'
                        )}
                      >
                        {record.cleaned
                          ? <CheckCircle2 size={18} className="text-amber-500 shrink-0" />
                          : <Circle size={18} className="text-gray-200 group-hover:text-amber-200 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-sm uppercase tracking-wide">Room Cleaned</span>
                          {record.cleaned && record.cleanedBy && (
                            <p className="text-xs font-medium text-amber-500 mt-0.5">by {record.cleanedBy}</p>
                          )}
                        </div>
                      </button>

                      <button
                        disabled={!record.cleaned}
                        onClick={() => updateStatus(room.id, { inspected: !record.inspected }, currentUserName)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left group',
                          record.inspected
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : !record.cleaned
                              ? 'bg-gray-50 border-gray-50 text-gray-300 cursor-not-allowed'
                              : 'bg-white border-gray-100 text-gray-400 hover:border-green-100'
                        )}
                      >
                        {record.inspected
                          ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                          : <Circle size={18} className={cn(record.cleaned ? 'text-gray-200 group-hover:text-green-200' : 'text-gray-100', 'shrink-0')} />}
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-sm uppercase tracking-wide">Inspected &amp; Ready</span>
                          {record.inspected && record.inspectedBy && (
                            <p className="text-xs font-medium text-green-600 mt-0.5">by {record.inspectedBy}</p>
                          )}
                        </div>
                      </button>

                      {record.status !== 'dirty' && (
                        <button
                          onClick={() => updateStatus(room.id, { status: 'dirty', cleaned: false, inspected: false }, currentUserName)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-all text-xs font-bold"
                        >
                          <RotateCcw size={13} />
                          Reset to dirty
                        </button>
                      )}
                    </div>

                    {/* Notes — collapsed by default */}
                    <div className="px-4 pb-3">
                      {noteOpen ? (
                        <div>
                          <textarea
                            autoFocus
                            rows={2}
                            defaultValue={record.notes || ''}
                            placeholder="Issues, missing items, extra requests…"
                            onBlur={e => {
                              const val = e.target.value;
                              if (val !== (record.notes || '')) handleNotesSave(room.id, val);
                              closeNote(room.id);
                            }}
                            className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-black outline-none resize-none placeholder:text-gray-300"
                          />
                          {savingNotes[room.id] && (
                            <p className="text-xs text-blue-400 mt-1">saving…</p>
                          )}
                        </div>
                      ) : record.notes ? (
                        <button
                          onClick={() => openNote(room.id)}
                          className="w-full flex items-start gap-2 text-left px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors"
                        >
                          <MessageSquare size={12} className="text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-xs text-amber-700 leading-snug">{record.notes}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openNote(room.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          <Plus size={11} />
                          Add note
                        </button>
                      )}
                    </div>

                    {/* History — subtle footer link, out of the way */}
                    {history.length > 0 && (
                      <div className="border-t border-gray-50">
                        <button
                          onClick={() => toggleHistory(room.id)}
                          className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-gray-300 hover:text-gray-500 transition-colors text-left"
                        >
                          <Clock size={11} />
                          {historyOpen ? 'Hide history' : `History (${history.length})`}
                        </button>
                        {historyOpen && (
                          <div className="px-4 pb-3 space-y-2">
                            {[...history].reverse().slice(0, 10).map((entry, i) => (
                              <React.Fragment key={i}>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-bold text-gray-700">{entry.action}</p>
                                    <p className="text-xs text-gray-400">{entry.userName}</p>
                                  </div>
                                  <p className="text-xs text-gray-300 shrink-0 text-right">
                                    {format(parseISO(entry.timestamp), 'dd MMM HH:mm')}
                                  </p>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
