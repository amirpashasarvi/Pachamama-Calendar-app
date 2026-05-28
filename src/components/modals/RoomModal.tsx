import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Room, RoomType, Booking } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Save } from 'lucide-react';
import { APP_COLOR_PALETTE } from '@/lib/colorPalette';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room?: Room | null;
  bookings: Booking[];
}

export default function RoomModal({ isOpen, onClose, room, bookings }: RoomModalProps) {
  const [formData, setFormData] = useState<Partial<Room>>({
    name: '',
    type: 'Private Room',
    description: '',
    equipment: '',
    size: '',
    color: '#36454F',
    order: 0,
    guestCount: 2,
    additionalBeds: 0,
    singleBeds: 0,
    doubleBeds: 0
  });

  const roomTypes: RoomType[] = [
    'Shared Room', 'Private Room', 'Glamping Tent', 'Campground', 'Treehouse', 'Venue Hire', 'Home Exchange'
  ];

  const colors = APP_COLOR_PALETTE;

  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (room) {
      setFormData(room);
    } else {
      setFormData({
        name: '',
        type: 'Private Room',
        description: '',
        equipment: '',
        size: '',
        color: '#36454F',
        order: 0,
        guestCount: 2,
        additionalBeds: 0,
        singleBeds: 0,
        doubleBeds: 0
      });
    }
    setShowConfirmDelete(false);
    setIsDeleting(false);
  }, [room, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...dataToSave } = formData;
    try {
      if (room?.id) {
        await updateDoc(doc(db, 'rooms', room.id), dataToSave);
      } else {
        await addDoc(collection(db, 'rooms'), dataToSave);
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, room?.id ? OperationType.UPDATE : OperationType.CREATE, room?.id ? `rooms/${room.id}` : 'rooms');
    }
  };

  const handleDelete = async () => {
    if (!room?.id) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'rooms', room.id));
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Failed to delete room: ${errorMessage}`);
      handleFirestoreError(err, OperationType.DELETE, `rooms/${room.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasBookings = room?.id ? bookings.some(b => b.roomId === room.id) : false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={room ? 'Edit Room' : 'Add Room'}>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Room Name</label>
          <input 
            required
            placeholder="e.g. Ivy, Suite 101..."
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            value={formData.name || ''}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Color Tag</label>
          <div className="grid grid-cols-12 sm:grid-cols-15 gap-1.5 max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner scrollbar-hide">
            {colors.map((c, i) => (
              <button
                key={`${c}-${i}`}
                type="button"
                onClick={() => setFormData({ ...formData, color: c })}
                className={`w-full aspect-square rounded-full border border-black/5 shadow-sm transition-all relative flex items-center justify-center ${formData.color === c ? 'scale-110 ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-105 active:scale-95'}`}
                style={{ backgroundColor: c }}
                title={`Color: ${c}`}
              >
                {formData.color === c && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full mix-blend-difference" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 border-t border-gray-100">
          {showConfirmDelete ? (
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3 text-rose-800">
                <Trash2 size={18} className="shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold mb-1">Are you absolutely sure?</p>
                  {hasBookings ? (
                    <p className="opacity-90">This room has <span className="font-bold underline">active bookings</span>. Deleting it will leave them unassigned.</p>
                  ) : (
                    <p className="opacity-90">This action cannot be undone.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                  disabled={isDeleting}
                >
                  Keep Room
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Room'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {room && (
                <button 
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-4 py-2 font-mono text-[10px] uppercase font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                >
                  Delete Room
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-6 py-2 text-gray-400 font-bold hover:text-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-black/10 text-sm"
                >
                  {room ? 'Update' : 'Create'} Room
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
