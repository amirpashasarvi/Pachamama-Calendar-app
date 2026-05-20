import React, { useMemo, useEffect } from 'react';
import { X, SprayCan, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, Booking, HousekeepingRecord } from '@/types';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInHours, isToday, isTomorrow, startOfToday } from 'date-fns';

interface HousekeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  bookings: Booking[];
  housekeeping: HousekeepingRecord[];
  updateStatus: (roomId: string, updates: Partial<HousekeepingRecord>) => Promise<void>;
  checkAutoDirty: () => Promise<void>;
}

export default function HousekeepingModal({ 
  isOpen, 
  onClose, 
  rooms, 
  bookings, 
  housekeeping,
  updateStatus,
  checkAutoDirty
}: HousekeepingModalProps) {

  useEffect(() => {
    if (isOpen) {
      checkAutoDirty();
    }
  }, [isOpen]);

  const sortedRoomCards = useMemo(() => {
    return rooms.map(room => {
      const record = housekeeping.find(h => h.roomId === room.id) || {
        roomId: room.id,
        status: 'clean' as const,
        cleaned: true,
        inspected: true,
        lastCheckout: null,
        nextCheckin: null,
        lastUpdated: new Date().toISOString()
      };

      const nextBooking = bookings
        .filter(b => b.roomId === room.id && parseISO(b.checkIn) >= startOfToday())
        .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())[0];

      const lastCheckoutBooking = bookings
        .filter(b => b.roomId === room.id && parseISO(b.checkOut) <= startOfToday())
        .sort((a, b) => parseISO(b.checkOut).getTime() - parseISO(a.checkOut).getTime())[0];

      const isUrgent = record.status !== 'clean' && nextBooking && (
        isToday(parseISO(nextBooking.checkIn)) && 
        differenceInHours(parseISO(nextBooking.checkIn + 'T15:00:00'), new Date()) < 3
      );

      return {
        room,
        record,
        nextBooking,
        lastCheckoutBooking,
        isUrgent
      };
    }).sort((a, b) => {
      const statusWeight = { dirty: 0, inspected: 1, clean: 2 };
      if (statusWeight[a.record.status] !== statusWeight[b.record.status]) {
        return statusWeight[a.record.status] - statusWeight[b.record.status];
      }
      return a.room.order - b.room.order;
    });
  }, [rooms, housekeeping, bookings]);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'dirty') return <div className="w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />;
    if (status === 'inspected') return <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />;
    return <div className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-gray-50 flex flex-col"
        >
          <header className="h-16 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <SprayCan size={20} />
              </div>
              <h2 className="text-xl font-black tracking-tight">Housekeeping</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={24} />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedRoomCards.map(({ room, record, nextBooking, lastCheckoutBooking, isUrgent }) => (
                <div 
                  key={room.id}
                  className={cn(
                    "bg-white p-6 rounded-3xl border shadow-sm flex flex-col gap-6 relative transition-all",
                    record.status === 'dirty' ? "border-rose-100" : 
                    record.status === 'inspected' ? "border-amber-100" : "border-gray-100"
                  )}
                >
                  {isUrgent && (
                    <div className="absolute top-4 right-4 animate-bounce">
                      <div className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <AlertTriangle size={10} />
                        CHECK-IN SOON!
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <StatusIcon status={record.status} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black truncate">{room.name}</h3>
                      <div className="mt-1 space-y-0.5">
                        {record.status === 'dirty' && lastCheckoutBooking && (
                          <p className="text-[11px] text-gray-400 font-bold">
                            Checked out: <span className="text-gray-600">{lastCheckoutBooking.guestName}</span> · {format(parseISO(lastCheckoutBooking.checkOut), 'dd MMM')}
                          </p>
                        )}
                        {nextBooking && (isToday(parseISO(nextBooking.checkIn)) || isTomorrow(parseISO(nextBooking.checkIn))) && (
                          <p className={cn(
                            "text-[11px] font-black flex items-center gap-1",
                            isToday(parseISO(nextBooking.checkIn)) ? "text-orange-500" : "text-gray-400"
                          )}>
                            <AlertTriangle size={12} />
                            Check-in: {nextBooking.guestName} · {format(parseISO(nextBooking.checkIn), 'dd MMM')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => updateStatus(room.id, { cleaned: !record.cleaned, inspected: false })}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left group",
                        record.cleaned 
                          ? "bg-amber-50 border-amber-200 text-amber-700" 
                          : "bg-white border-gray-100 text-gray-400 hover:border-amber-100"
                      )}
                    >
                      {record.cleaned ? <CheckCircle2 className="text-amber-500" /> : <Circle className="text-gray-200 group-hover:text-amber-200" />}
                      <span className="font-black text-sm uppercase tracking-wider">Room Cleaned</span>
                    </button>

                    <button
                      disabled={!record.cleaned}
                      onClick={() => updateStatus(room.id, { inspected: !record.inspected })}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left group",
                        record.inspected 
                          ? "bg-green-50 border-green-200 text-green-700" 
                          : !record.cleaned
                            ? "bg-gray-50 border-gray-50 text-gray-300 cursor-not-allowed"
                            : "bg-white border-gray-100 text-gray-400 hover:border-green-100"
                      )}
                    >
                      {record.inspected ? <CheckCircle2 className="text-green-500" /> : <Circle className={cn(record.cleaned ? "text-gray-200 group-hover:text-green-200" : "text-gray-100")} />}
                      <span className="font-black text-sm uppercase tracking-wider">Room Inspected & Ready</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
