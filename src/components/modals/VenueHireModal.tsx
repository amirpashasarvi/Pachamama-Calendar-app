import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { VenueHire, Room, ConfigOption, BookingStatus } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Trash2, Save, Plus, X } from 'lucide-react';

interface VenueHireModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueHire?: VenueHire | null;
  rooms: Room[];
  bookingChannels: ConfigOption[];
}

export default function VenueHireModal({ 
  isOpen, 
  onClose, 
  venueHire, 
  rooms, 
  bookingChannels 
}: VenueHireModalProps) {
  const [formData, setFormData] = useState<Partial<VenueHire>>({
    name: '',
    organizer: '',
    startDate: '',
    endDate: '',
    guestCount: 0,
    notes: '',
    roomNotes: {},
    bookingPrice: 0,
    deposit: 0,
    extras: [],
    paidLater1: 0,
    paidLater2: 0,
    bookingChannel: '',
    channelPaymentBasis: 'bookingPrice'
  });

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (venueHire) {
      setFormData({
        ...venueHire,
        roomNotes: venueHire.roomNotes || {},
        extras: venueHire.extras || []
      });
    } else if (isOpen) {
      setFormData({
        name: '',
        organizer: '',
        startDate: '',
        endDate: '',
        guestCount: 0,
        notes: '',
        roomNotes: {},
        bookingPrice: 0,
        deposit: 0,
        extras: [],
        paidLater1: 0,
        paidLater2: 0,
        bookingChannel: '',
        channelPaymentBasis: 'bookingPrice'
      });
    }
    setShowConfirmDelete(false);
    setDeleteConfirmText('');
  }, [venueHire, isOpen, bookingChannels]);

  const totalExtras = (formData.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const total = (formData.bookingPrice || 0) + totalExtras;
  const remaining = total - (formData.deposit || 0) - (formData.paidLater1 || 0) - (formData.paidLater2 || 0);
  
  let calculatedStatus: BookingStatus = 'Unpaid';
  if (remaining <= 0 && total > 0) calculatedStatus = 'Paid';
  else if ((formData.deposit || 0) > 0 || (formData.paidLater1 || 0) > 0 || (formData.paidLater2 || 0) > 0) calculatedStatus = 'Partial';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...dataToSave } = formData;
    const data = {
      ...dataToSave,
      updatedAt: new Date().toISOString()
    };

    try {
      if (venueHire?.id) {
        await updateDoc(doc(db, 'venueHires', venueHire.id), data);
      } else {
        await addDoc(collection(db, 'venueHires'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, venueHire?.id ? OperationType.UPDATE : OperationType.CREATE, venueHire?.id ? `venueHires/${venueHire.id}` : 'venueHires');
    }
  };

  const handleDelete = async () => {
    if (!venueHire?.id) return;
    try {
      await updateDoc(doc(db, 'venueHires', venueHire.id), { deletedAt: new Date().toISOString() });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `venueHires/${venueHire.id}`);
    }
  };

  const addExtra = () => {
    if ((formData.extras || []).length >= 2) return;
    setFormData(prev => ({
      ...prev,
      extras: [...(prev.extras || []), { label: '', amount: 0 }]
    }));
  };

  const updateExtra = (index: number, field: 'label' | 'amount', value: string | number) => {
    const newExtras = [...(formData.extras || [])];
    newExtras[index] = { ...newExtras[index], [field]: value };
    setFormData({ ...formData, extras: newExtras });
  };

  const removeExtra = (index: number) => {
    setFormData({
      ...formData,
      extras: (formData.extras || []).filter((_, i) => i !== index)
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={venueHire ? 'Edit Venue Hire' : 'Add Venue Hire'}>
      <form onSubmit={handleSave} className="space-y-8">
        
        {/* Details Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Event Name</label>
              <input 
                required
                className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Host / Organizer</label>
              <input 
                required
                className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.organizer || ''}
                onChange={e => setFormData({ ...formData, organizer: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
              <DatePicker 
                value={formData.startDate || ''}
                onChange={val => {
                  setFormData(prev => ({
                    ...prev,
                    startDate: val,
                    endDate: (prev.endDate && val >= prev.endDate) ? '' : prev.endDate
                  }));
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
              <DatePicker 
                value={formData.endDate || ''}
                min={formData.startDate ? new Date(new Date(formData.startDate).getTime() + 86400000).toISOString().split('T')[0] : ''}
                onChange={val => setFormData({ ...formData, endDate: val })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Number of Guests</label>
              <input 
                type="number"
                min={0}
                className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.guestCount ?? ''}
                onChange={e => setFormData({ ...formData, guestCount: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Notes / Special Requirements</label>
              <textarea 
                className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                placeholder="Any special notes..."
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Rooms Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Rooms Configuration</h3>
          <div className="grid grid-cols-1 gap-3">
            {rooms.map(room => (
              <div key={room.id} className="flex items-center gap-4 py-1 border-b border-gray-100 last:border-0">
                <span className="w-1/3 text-sm font-bold text-gray-700 truncate">{room.name}</span>
                <input 
                  placeholder="Bed config e.g. 2 singles"
                  className="flex-1 px-4 py-1.5 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.roomNotes?.[room.id] || ''}
                  onChange={e => setFormData({
                    ...formData,
                    roomNotes: {
                      ...(formData.roomNotes || {}),
                      [room.id]: e.target.value
                    }
                  })}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Financial info */}
        <section className="space-y-4 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Financials</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Booking Price</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2 text-gray-400">€</span>
                  <input 
                    type="number"
                    className="w-full pl-8 pr-4 py-2 border rounded-lg outline-none bg-white font-mono"
                    value={formData.bookingPrice ?? ''}
                    onChange={e => setFormData({ ...formData, bookingPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Deposit</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2 text-gray-400">€</span>
                  <input 
                    type="number"
                    className="w-full pl-8 pr-4 py-2 border rounded-lg outline-none bg-white font-mono"
                    value={formData.deposit ?? ''}
                    onChange={e => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Extras</label>
              {(formData.extras || []).map((extra, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input 
                    className="flex-1 px-3 py-2 text-xs border rounded-lg outline-none bg-white"
                    placeholder="label"
                    value={extra.label || ''}
                    onChange={e => updateExtra(idx, 'label', e.target.value)}
                  />
                  <div className="relative w-32 font-mono text-sm">
                    <span className="absolute left-3 top-1.5 text-gray-400 text-xs">€</span>
                    <input 
                      type="number"
                      className="w-full pl-7 pr-3 py-1.5 border rounded-lg outline-none bg-white text-xs"
                      value={extra.amount ?? ''}
                      onChange={e => updateExtra(idx, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button type="button" onClick={() => removeExtra(idx)} className="p-1 px-2 text-rose-500"><X size={14} /></button>
                </div>
              ))}
              {(formData.extras || []).length < 2 && (
                <button type="button" onClick={addExtra} className="text-[10px] font-bold text-blue-600">+ Add Extra</button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Paid Later 1</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2 text-gray-400">€</span>
                  <input 
                    type="number"
                    className="w-full pl-8 pr-4 py-2 border rounded-lg outline-none bg-white font-mono"
                    value={formData.paidLater1 ?? ''}
                    onChange={e => setFormData({ ...formData, paidLater1: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Paid Later 2</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2 text-gray-400">€</span>
                  <input 
                    type="number"
                    className="w-full pl-8 pr-4 py-2 border rounded-lg outline-none bg-white font-mono"
                    value={formData.paidLater2 ?? ''}
                    onChange={e => setFormData({ ...formData, paidLater2: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Channel</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg outline-none bg-white text-xs"
                  value={formData.bookingChannel || ''}
                  onChange={e => setFormData({ ...formData, bookingChannel: e.target.value })}
                >
                  <option value="">Select Channel</option>
                  {bookingChannels.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Basis</label>
                <div className="flex p-1 bg-white border rounded-lg h-[34px]">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, channelPaymentBasis: 'bookingPrice' })}
                    className={cn(
                      "flex-1 px-1 text-[9px] font-bold rounded",
                      formData.channelPaymentBasis === 'bookingPrice' ? "bg-black text-white shadow-sm" : "text-gray-400"
                    )}
                  >
                    Price
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, channelPaymentBasis: 'deposit' })}
                    className={cn(
                      "flex-1 px-1 text-[9px] font-bold rounded",
                      formData.channelPaymentBasis === 'deposit' ? "bg-black text-white shadow-sm" : "text-gray-400"
                    )}
                  >
                    Deposit
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest text-[10px]">Total</span>
                <span className="text-2xl font-black text-black">€{total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Remaining</span>
                  <span className="text-lg font-bold text-blue-600">€{remaining.toFixed(2)}</span>
                </div>
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-black italic uppercase tracking-tighter shadow-sm",
                  calculatedStatus === 'Paid' ? 'bg-green-100 text-green-700' :
                  calculatedStatus === 'Partial' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                )}>
                  {calculatedStatus}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          {venueHire && (
             <button 
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm font-bold"
              >
                <Trash2 size={16} /> Delete
             </button>
          )}
          
          <div className="flex gap-3 ml-auto">
            {showConfirmDelete ? (
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-right-2">
                <span className="text-[10px] font-bold text-gray-500">
                  Type <span className="text-rose-600 font-black">{venueHire?.name || 'DELETE'}</span> to confirm
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder={venueHire?.name || 'DELETE'}
                    className="border rounded-lg px-2 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteConfirmText.trim().toLowerCase() !== (venueHire?.name || 'DELETE').toLowerCase()}
                    className="px-3 py-2 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowConfirmDelete(false); setDeleteConfirmText(''); }}
                    className="px-3 py-2 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 px-8 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 text-sm"
                >
                  <Save size={16} /> {venueHire ? 'Update' : 'Create'} Venue Hire
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
