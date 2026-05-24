import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { VenueHire, Room, ConfigOption, BookingStatus } from '@/types';
import { db } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { calculateNights, cn } from '@/lib/utils';
import { AlertTriangle, Trash2, Save, Plus, X } from 'lucide-react';

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
    channelPaymentBasis: 'bookingPrice',
    commissionCustomAmount: 0,
  });

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (venueHire) {
      setFormData({
        ...venueHire,
        roomNotes: venueHire.roomNotes || {},
        extras: venueHire.extras || [],
        commissionCustomAmount: venueHire.commissionCustomAmount ?? 0,
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
        channelPaymentBasis: 'bookingPrice',
        commissionCustomAmount: 0,
      });
    }
    setError(null);
    setIsSaving(false);
    setShowConfirmDelete(false);
    setDeleteConfirmText('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueHire?.id, isOpen]);

  const totalExtras = (formData.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const total = (formData.bookingPrice || 0) + totalExtras;
  const remaining = total - (formData.deposit || 0) - (formData.paidLater1 || 0) - (formData.paidLater2 || 0);
  const days = calculateNights(formData.startDate || '', formData.endDate || '');

  let calculatedStatus: BookingStatus = 'Unpaid';
  if (remaining <= 0 && total > 0) calculatedStatus = 'Paid';
  else if ((formData.deposit || 0) > 0 || (formData.paidLater1 || 0) > 0 || (formData.paidLater2 || 0) > 0) calculatedStatus = 'Partial';

  const selectedChannel = bookingChannels.find(c => c.name === formData.bookingChannel);
  const channelCommissionRate = selectedChannel?.commission ?? 0;

  const commissionBase = formData.channelPaymentBasis === 'custom'
    ? (formData.commissionCustomAmount ?? 0)
    : formData.channelPaymentBasis === 'bookingPrice'
      ? (formData.bookingPrice || 0)
      : (formData.deposit || 0);

  const liveCommission = useMemo(() => {
    if (!channelCommissionRate) return 0;
    return (commissionBase * channelCommissionRate) / 100;
  }, [commissionBase, channelCommissionRate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const removeUndefinedDeep = (obj: unknown): unknown => {
      if (Array.isArray(obj)) return obj.map(removeUndefinedDeep);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, removeUndefinedDeep(v)])
        );
      }
      return obj;
    };

    const { id, ...dataToSave } = formData;
    const data = removeUndefinedDeep({
      ...dataToSave,
      updatedAt: new Date().toISOString(),
    }) as Record<string, unknown>;

    setIsSaving(true);
    try {
      if (venueHire?.id) {
        await updateDoc(doc(db, 'venueHires', venueHire.id), data);
      } else {
        const createData = { ...data, createdAt: new Date().toISOString() };
        await addDoc(collection(db, 'venueHires'), createData);
      }
      onClose();
    } catch (err) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setError(msg);
    }
  };

  const handleDelete = async () => {
    if (!venueHire?.id) return;
    try {
      await updateDoc(doc(db, 'venueHires', venueHire.id), { deletedAt: new Date().toISOString() });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete. Please try again.';
      setError(msg);
    }
  };

  const addExtra = () => {
    if ((formData.extras || []).length >= 5) return;
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
        <section className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Financials</h3>

          {/* Summary at top */}
          <div className="pb-4 border-b flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</span>
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

          <div className="space-y-4">
            {/* Booking Price + Deposit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Booking Price</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none bg-gray-50 font-mono"
                    value={formData.bookingPrice ?? ''}
                    onChange={e => setFormData({ ...formData, bookingPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {days > 0 && (formData.bookingPrice || 0) > 0 && (
                  <span className="block text-right text-xs font-mono text-gray-400 mt-1">
                    ≈ €{((formData.bookingPrice || 0) / days).toFixed(2)} / day
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Deposit</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none bg-gray-50 font-mono"
                    value={formData.deposit ?? ''}
                    onChange={e => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Extras */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Extras</label>
              {(formData.extras || []).map((extra, idx) => (
                <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none bg-gray-50"
                    placeholder="e.g. Sound system"
                    value={extra.label || ''}
                    onChange={e => updateExtra(idx, 'label', e.target.value)}
                  />
                  <div className="relative w-32 font-mono text-sm">
                    <span className="absolute left-3 top-2 text-gray-400 text-xs">€</span>
                    <input
                      type="number"
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl outline-none bg-gray-50 text-xs"
                      value={extra.amount ?? ''}
                      onChange={e => updateExtra(idx, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button type="button" onClick={() => removeExtra(idx)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(() => {
                const atLimit = (formData.extras || []).length >= 5;
                return (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={addExtra}
                      disabled={atLimit}
                      className={cn(
                        "flex items-center gap-1.5 text-[10px] font-bold",
                        atLimit ? "text-gray-300 cursor-not-allowed" : "text-blue-600 hover:text-blue-700"
                      )}
                    >
                      <Plus size={12} /> Add Extra
                    </button>
                    {atLimit && <span className="text-[10px] text-gray-400 italic">Maximum 5 extras reached</span>}
                  </div>
                );
              })()}
            </div>

            {/* Paid Later */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Paid Later 1</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none bg-gray-50 font-mono"
                    value={formData.paidLater1 ?? ''}
                    onChange={e => setFormData({ ...formData, paidLater1: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Paid Later 2</label>
                <div className="relative font-mono text-sm">
                  <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none bg-gray-50 font-mono"
                    value={formData.paidLater2 ?? ''}
                    onChange={e => setFormData({ ...formData, paidLater2: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Channel & Commission */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Channel &amp; Commission</h4>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="w-40 shrink-0 px-3 py-2 border border-gray-200 rounded-xl outline-none bg-gray-50 text-sm"
                  value={formData.bookingChannel || ''}
                  onChange={e => setFormData({ ...formData, bookingChannel: e.target.value })}
                >
                  <option value="">Direct</option>
                  {bookingChannels.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>

                <div className="flex gap-1 p-0.5 bg-gray-100 rounded-xl shrink-0">
                  {([
                    { value: 'bookingPrice', label: 'Full Booking' },
                    { value: 'deposit',      label: 'Deposit' },
                    { value: 'custom',       label: 'Custom' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, channelPaymentBasis: opt.value })}
                      className={cn(
                        'py-1 px-2.5 rounded-lg text-xs font-bold transition-all',
                        formData.channelPaymentBasis === opt.value
                          ? 'bg-white text-gray-800 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {formData.channelPaymentBasis === 'custom' ? (
                  <div className="relative shrink-0 w-28">
                    <span className="absolute left-2.5 top-[9px] text-xs text-gray-400">€</span>
                    <input
                      type="number"
                      min={0}
                      className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-xl outline-none bg-gray-50 font-mono text-sm"
                      value={formData.commissionCustomAmount ?? ''}
                      onChange={e => setFormData({ ...formData, commissionCustomAmount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-400 text-right select-none">
                    €{commissionBase.toFixed(2)}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono">
                {channelCommissionRate}% commission
                <span className="mx-1.5 text-gray-200">·</span>
                €{liveCommission.toFixed(2)}
              </p>
            </div>
          </div>
        </section>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
            <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs font-bold text-rose-800 whitespace-pre-line">{error}</div>
          </div>
        )}

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
