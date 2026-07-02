import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Booking, Room } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { addDays, format, parseISO } from 'date-fns';
import { Save, Trash2, AlertTriangle, Ban } from 'lucide-react';
import { calculateNights, cn } from '@/lib/utils';
import { isActiveLifecycle } from '@/lib/bookingLifecycle';
import { buildBlockedBookingPayload, BLOCKED_BOOKING_TYPE } from '@/lib/bookingBlock';
import { logActivity } from '@/lib/activityLog';

const DEFAULT_BLOCK_NIGHTS = 6;

interface BlockRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  initialData?: { roomId?: string; checkIn?: string; checkOut?: string };
  rooms: Room[];
  bookings: Booking[];
  bookingChannel?: string;
  currentUserName?: string;
  currentUserEmail?: string;
}

function findOverlap(
  roomId: string,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
  excludeId?: string,
): { roomName: string; label: string; checkIn: string; checkOut: string } | null {
  const overlapping = bookings.find(existing => {
    if (excludeId && existing.id === excludeId) return false;
    if (!isActiveLifecycle(existing)) return false;
    if (existing.roomId !== roomId) return false;
    return checkIn < existing.checkOut && checkOut > existing.checkIn;
  });
  if (!overlapping) return null;
  const label = overlapping.type === BLOCKED_BOOKING_TYPE
    ? 'Blocked'
    : overlapping.guestName;
  return {
    roomName: roomId,
    label,
    checkIn: overlapping.checkIn,
    checkOut: overlapping.checkOut,
  };
}

export default function BlockRoomModal({
  isOpen,
  onClose,
  booking,
  initialData,
  rooms,
  bookings,
  bookingChannel = 'Direct',
  currentUserName = '',
  currentUserEmail = '',
}: BlockRoomModalProps) {
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isEditing = !!booking?.id;
  const allRoomIds = useMemo(() => rooms.map(r => r.id), [rooms]);
  const allRoomsSelected = allRoomIds.length > 0 && allRoomIds.every(id => selectedRoomIds.includes(id));

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSaving(false);
    setShowConfirmDelete(false);

    if (booking) {
      setSelectedRoomIds(booking.roomId ? [booking.roomId] : []);
      setCheckIn(booking.checkIn);
      setCheckOut(booking.checkOut);
      setNotes(booking.notes || '');
    } else {
      const initialCheckIn = initialData?.checkIn || '';
      setSelectedRoomIds(initialData?.roomId ? [initialData.roomId] : []);
      setCheckIn(initialCheckIn);
      setCheckOut(
        initialData?.checkOut
          || (initialCheckIn ? format(addDays(parseISO(initialCheckIn), DEFAULT_BLOCK_NIGHTS), 'yyyy-MM-dd') : ''),
      );
      setNotes('');
    }
  }, [booking, initialData, isOpen]);

  const overlapMessages = useMemo(() => {
    if (!checkIn || !checkOut || selectedRoomIds.length === 0) return [];

    return selectedRoomIds.flatMap(roomId => {
      const hit = findOverlap(roomId, checkIn, checkOut, bookings, booking?.id);
      if (!hit) return [];
      const room = rooms.find(r => r.id === roomId);
      return [`${room?.name || 'This room'} is unavailable (${hit.label}, ${hit.checkIn} to ${hit.checkOut})`];
    });
  }, [checkIn, checkOut, selectedRoomIds, bookings, booking?.id, rooms]);

  const nights = calculateNights(checkIn, checkOut);

  const handleCheckInChange = (val: string) => {
    setCheckIn(val);
    setError(null);
    if (!val) {
      setCheckOut('');
      return;
    }
    const prevNights = calculateNights(checkIn, checkOut);
    const n = prevNights > 0 ? prevNights : DEFAULT_BLOCK_NIGHTS;
    setCheckOut(format(addDays(parseISO(val), n), 'yyyy-MM-dd'));
  };

  const toggleAllRooms = (checked: boolean) => {
    setSelectedRoomIds(checked ? [...allRoomIds] : []);
    setError(null);
  };

  const toggleRoom = (roomId: string, checked: boolean) => {
    setSelectedRoomIds(prev => {
      if (checked) return prev.includes(roomId) ? prev : [...prev, roomId];
      return prev.filter(id => id !== roomId);
    });
    setError(null);
  };

  const handleSave = async () => {
    setError(null);

    if (selectedRoomIds.length === 0) {
      setError('Please select at least one room.');
      return;
    }
    if (!checkIn || !checkOut) {
      setError('Please select check-in and check-out dates.');
      return;
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    if (!notes.trim()) {
      setError('Please enter a reason for the block.');
      return;
    }
    if (overlapMessages.length > 0) {
      setError(overlapMessages[0]);
      return;
    }

    const logBase = {
      userName: currentUserName || currentUserEmail,
      userEmail: currentUserEmail,
      entityType: 'booking' as const,
    };
    const now = new Date().toISOString();

    setIsSaving(true);
    try {
      if (booking?.id) {
        const originalRoomId = booking.roomId;
        const primaryRoomId = selectedRoomIds.includes(originalRoomId)
          ? originalRoomId
          : selectedRoomIds[0];
        const roomsToCreate = selectedRoomIds.filter(id => id !== primaryRoomId);

        const primaryPayload = buildBlockedBookingPayload(primaryRoomId, checkIn, checkOut, notes, bookingChannel);
        const primaryName = rooms.find(r => r.id === primaryRoomId)?.name ?? primaryRoomId;
        await updateDoc(doc(db, 'bookings', booking.id), {
          ...primaryPayload,
          updatedAt: now,
        });
        logActivity({
          ...logBase,
          action: 'updated',
          entityId: booking.id,
          summary: `Room block updated · ${primaryName} · ${checkIn} → ${checkOut} · ${notes.trim()}`,
        });

        if (roomsToCreate.length > 0) {
          const refs = await Promise.all(
            roomsToCreate.map(roomId => {
              const payload = buildBlockedBookingPayload(roomId, checkIn, checkOut, notes, bookingChannel);
              return addDoc(collection(db, 'bookings'), {
                ...payload,
                createdAt: now,
                updatedAt: now,
              });
            }),
          );
          refs.forEach((ref, i) => {
            const roomName = rooms.find(r => r.id === roomsToCreate[i])?.name ?? roomsToCreate[i];
            logActivity({
              ...logBase,
              action: 'created',
              entityId: ref.id,
              summary: `Room blocked · ${roomName} · ${checkIn} → ${checkOut} · ${notes.trim()}`,
            });
          });
        }
      } else {
        const refs = await Promise.all(
          selectedRoomIds.map(roomId => {
            const payload = buildBlockedBookingPayload(roomId, checkIn, checkOut, notes, bookingChannel);
            return addDoc(collection(db, 'bookings'), {
              ...payload,
              createdAt: now,
              updatedAt: now,
            });
          }),
        );
        refs.forEach((ref, i) => {
          const roomName = rooms.find(r => r.id === selectedRoomIds[i])?.name ?? selectedRoomIds[i];
          logActivity({
            ...logBase,
            action: 'created',
            entityId: ref.id,
            summary: `Room blocked · ${roomName} · ${checkIn} → ${checkOut} · ${notes.trim()}`,
          });
        });
      }
      onClose();
    } catch (err) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : 'Failed to save room block.';
      setError(msg);
      handleFirestoreError(err, booking ? OperationType.UPDATE : OperationType.CREATE, 'bookings');
    }
  };

  const handleDelete = async () => {
    if (!booking?.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { deletedAt: new Date().toISOString() });
      const roomName = rooms.find(r => r.id === booking.roomId)?.name ?? booking.roomId;
      logActivity({
        action: 'deleted',
        entityType: 'booking',
        entityId: booking.id,
        summary: `Room block removed · ${roomName} · ${booking.checkIn} → ${booking.checkOut}`,
        userName: currentUserName || currentUserEmail,
        userEmail: currentUserEmail,
      });
      onClose();
    } catch (err) {
      setIsSaving(false);
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const checkOutDefaultMonth = checkIn
    ? format(addDays(parseISO(checkIn), DEFAULT_BLOCK_NIGHTS), 'yyyy-MM-dd')
    : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit room block' : 'Block rooms'}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-gray-100 border border-gray-200 rounded-xl">
          <Ban size={16} className="text-gray-600 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Marks selected rooms unavailable for guest bookings. Type is saved as <span className="font-bold">Blocked</span>.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-bold uppercase text-gray-400">Rooms</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allRoomsSelected}
                onChange={e => toggleAllRooms(e.target.checked)}
                className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5"
              />
              <span className="text-xs font-bold text-gray-600">All rooms</span>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-xl">
            {rooms.map(room => {
              const checked = selectedRoomIds.includes(room.id);
              return (
                <label
                  key={room.id}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors',
                    checked ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => toggleRoom(room.id, e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5 shrink-0"
                  />
                  <span className="truncate">{room.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Check-in</label>
            <DatePicker
              value={checkIn}
              onChange={handleCheckInChange}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Check-out</label>
            <DatePicker
              value={checkOut}
              onChange={val => { setCheckOut(val); setError(null); }}
              min={checkIn ? format(addDays(parseISO(checkIn), 1), 'yyyy-MM-dd') : undefined}
              defaultMonth={checkOutDefaultMonth || checkIn || undefined}
              className="w-full"
            />
          </div>
        </div>

        {nights > 0 && (
          <p className="text-xs font-bold text-gray-500">{nights} {nights === 1 ? 'night' : 'nights'}</p>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Reason</label>
          <textarea
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none min-h-[72px] resize-none text-sm placeholder:text-gray-400"
            placeholder="e.g. Plumbing repair, deep clean, owner stay..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {overlapMessages.length > 0 && (
          <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {overlapMessages.map(msg => (
                <p key={msg} className="text-xs font-bold text-rose-700">{msg}</p>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-rose-700">{error}</span>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100 flex gap-2">
          {!showConfirmDelete ? (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving
                  ? 'Saving…'
                  : isEditing
                    ? selectedRoomIds.length > 1
                      ? `Update · ${selectedRoomIds.length} rooms`
                      : 'Update block'
                    : selectedRoomIds.length > 1
                      ? `Block ${selectedRoomIds.length} rooms`
                      : 'Block room'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-3 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 disabled:opacity-50"
                  title="Remove block"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleDelete}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove block
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
