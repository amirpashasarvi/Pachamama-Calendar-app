import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Booking, Room, GlobalSettings, BookingStatus, ConfigOption, VenueHire } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { calculateNights, cn } from '@/lib/utils';
import { Trash2, Save, Plus, X, AlertTriangle } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  rooms: Room[];
  bookings: Booking[];
  venueHires?: VenueHire[];
  settings: GlobalSettings | null;
  bookingTypes: ConfigOption[];
  bookingChannels: ConfigOption[];
  initialData?: Partial<Booking>;
  isAdmin?: boolean;
}

export default function BookingModal({ 
  isOpen, 
  onClose, 
  booking, 
  rooms, 
  bookings, 
  settings, 
  bookingTypes, 
  bookingChannels, 
  venueHires = [],
  initialData,
  isAdmin = false 
}: BookingModalProps) {
  const INITIAL_BOOKING_STATE = {
    guestName: '',
    additionalNames: '',
    adults: 1,
    kids: 0,
    checkIn: '',
    checkOut: '',
    roomId: '',
    type: '',
    bedSetting: 'Double' as const,
    singleBeds: 0,
    doubleBeds: 0,
    dietary: '',
    notes: '',
    price: 0,
    extras: [],
    deposit: 0,
    paidLater1: 0,
    paidLater2: 0,
    channelPaymentBasis: 'bookingPrice' as const,
    commissionCustomAmount: 0,
    source: '',
    bookingChannel: '',
    status: 'Unpaid' as BookingStatus,
    comments: ''
  };

  const [formData, setFormData] = useState<Partial<Booking>>(INITIAL_BOOKING_STATE);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showBedConfig, setShowBedConfig] = useState(false);

  useEffect(() => {
    if (booking) {
      // Map old fields if they exist for backward compatibility
      const mappedBooking = {
        ...booking,
        extras: booking.extras || (booking as any).extraCharges ? [{ label: 'Extras', amount: (booking as any).extraCharges }] : [],
        paidLater1: booking.paidLater1 ?? (booking as any).paidLater ?? 0,
        paidLater2: booking.paidLater2 ?? 0,
        channelPaymentBasis: booking.channelPaymentBasis || 'bookingPrice',
        comments: typeof (booking as any).comments === 'string' 
          ? (booking as any).comments 
          : (Array.isArray((booking as any).comments) 
            ? (booking as any).comments.map((c: any) => typeof c === 'object' ? (c.text || '') : String(c)).filter(Boolean).join('\n') 
            : '')
      } as Booking;
      setFormData(mappedBooking);
    } else if (initialData) {
      setFormData({ ...INITIAL_BOOKING_STATE, ...initialData });
    } else {
      setFormData({
        ...INITIAL_BOOKING_STATE,
        bookingChannel: bookingChannels[0]?.name || ''
      });
    }
    setError(null);
    setIsSaving(false);
    setShowConfirmDelete(false);
    setDeleteConfirmText('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, initialData, isOpen]);

  // Set default booking channel for new bookings
  useEffect(() => {
    if (!booking && !initialData && isOpen) {
      if (!formData.bookingChannel && bookingChannels.length > 0) {
        setFormData(prev => ({ ...prev, bookingChannel: bookingChannels[0].name }));
      }
    }
  }, [isOpen, bookingChannels, booking, initialData]);

  // Status calculation logic
  const totalExtras = (formData.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const total = (formData.price || 0) + totalExtras;
  const remaining = total - (formData.deposit || 0) - (formData.paidLater1 || 0) - (formData.paidLater2 || 0);
  
  let calculatedStatus: BookingStatus = 'Unpaid';
  if (remaining <= 0 && total > 0) calculatedStatus = 'Paid';
  else if ((formData.deposit || 0) > 0 || (formData.paidLater1 || 0) > 0 || (formData.paidLater2 || 0) > 0) calculatedStatus = 'Partial';

  const nights = calculateNights(formData.checkIn || '', formData.checkOut || '');

  const selectedChannel = bookingChannels.find(c => c.name === formData.bookingChannel);
  const channelCommissionRate = selectedChannel?.commission ?? 0;

  const commissionBase = formData.channelPaymentBasis === 'custom'
    ? (formData.commissionCustomAmount ?? 0)
    : formData.channelPaymentBasis === 'bookingPrice'
      ? (formData.price || 0)
      : (formData.deposit || 0);

  const liveCommission = useMemo(() => {
    if (!channelCommissionRate) return 0;
    const base = formData.channelPaymentBasis === 'custom'
      ? (formData.commissionCustomAmount ?? 0)
      : formData.channelPaymentBasis === 'bookingPrice'
        ? (formData.price || 0)
        : (formData.deposit || 0);
    return (base * channelCommissionRate) / 100;
  }, [formData.channelPaymentBasis, formData.price, formData.deposit, formData.commissionCustomAmount, channelCommissionRate]);


  const checkOverlaps = (targetRoomId: string) => {
    if (!targetRoomId || !formData.checkIn || !formData.checkOut) return null;

    const overlappingBooking = bookings.find(existing => {
      // Skip the current booking being edited
      if (booking?.id && existing.id === booking.id) return false;
      
      // Only check target room
      if (existing.roomId !== targetRoomId) return false;

      const newIn = formData.checkIn!;
      const newOut = formData.checkOut!;
      const existingIn = existing.checkIn;
      const existingOut = existing.checkOut;

      // Standard interval overlap check: (StartA < EndB) and (EndA > StartB)
      return (newIn < existingOut) && (newOut > existingIn);
    });

    if (overlappingBooking) {
      const room = rooms.find(r => r.id === targetRoomId);
      return `Double Booking: ${room?.name || 'This room'} is already booked by ${overlappingBooking.guestName} (${overlappingBooking.checkIn} to ${overlappingBooking.checkOut})`;
    }
    return null;
  };

  const getVenueHireOverlap = () => {
    if (!formData.checkIn || !formData.checkOut) return null;
    const vh = venueHires.find(vh => {
      const newIn = formData.checkIn!;
      const newOut = formData.checkOut!;
      const vhIn = vh.startDate;
      const vhOut = vh.endDate;
      return (newIn < vhOut) && (newOut > vhIn);
    });
    return vh ? vh.name : null;
  };

  const venueHireOverlapName = getVenueHireOverlap();

  const liveOverlapWarning = useMemo(() => {
    if (isSaving) return null;
    if (!formData.roomId || formData.roomId === 'ALL') return null;
    return checkOverlaps(formData.roomId);
  }, [isSaving, formData.checkIn, formData.checkOut, formData.roomId, bookings, booking?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isAdmin && !formData.type?.trim()) {
      setError('Please select a booking type before saving.');
      return;
    }

    // Filter out empty extras
    const filteredExtras = (formData.extras || []).filter(e => e.label || e.amount > 0);

    if (formData.roomId === 'ALL') {
      // Check ALL rooms for overlaps
      const overlapErrors: string[] = [];
      rooms.forEach(room => {
        const err = checkOverlaps(room.id);
        if (err) overlapErrors.push(err);
      });

      if (overlapErrors.length > 0) {
        setError(`Cannot book all rooms. Conflicts found:\n${overlapErrors.join('\n')}`);
        return;
      }
    } else {
      const overlapMessage = checkOverlaps(formData.roomId!);
      if (overlapMessage) {
        setError(overlapMessage);
        return;
      }
    }

    // Recursively removes undefined values so Firestore never receives them,
    // even inside nested objects or arrays.
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
      extras: filteredExtras,
      status: calculatedStatus,
      totalGuests: (formData.adults || 0) + (formData.kids || 0),
      updatedAt: new Date().toISOString(),
    }) as Record<string, unknown>;

    setIsSaving(true);
    try {
      if (booking?.id) {
        if (isAdmin) {
          await updateDoc(doc(db, 'bookings', booking.id), data);
        } else {
          // If staff, only update comments
          await updateDoc(doc(db, 'bookings', booking.id), {
            comments: formData.comments || '',
            commentsUpdatedAt: new Date().toISOString(),
          });
        }
      } else if (formData.roomId === 'ALL') {
        // Bulk Create
        const promises = rooms.map(room => {
          const bulkData = { ...data, roomId: room.id, createdAt: new Date().toISOString() };
          return addDoc(collection(db, 'bookings'), bulkData);
        });
        await Promise.all(promises);
      } else {
        const createData = { ...data, createdAt: new Date().toISOString() };
        await addDoc(collection(db, 'bookings'), createData);
      }
      onClose();
    } catch (err) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : 'Failed to save booking. Please try again.';
      setError(msg);
    }
  };

  const handleDelete = async () => {
    if (!booking?.id) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { deletedAt: new Date().toISOString() });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookings/${booking.id}`);
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

  const modalFooter = (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
          <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-rose-800 whitespace-pre-line">{error}</div>
        </div>
      )}
    <div className="flex items-center justify-between">
      {booking && isAdmin && (
        <div className="flex items-center gap-2">
          {showConfirmDelete ? (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2">
              <span className="text-[10px] font-bold text-gray-500">
                Type <span className="text-rose-600 font-black">{booking?.guestName || 'DELETE'}</span> to confirm
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={booking?.guestName || 'DELETE'}
                  className="border rounded-lg px-2 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteConfirmText.trim().toLowerCase() !== (booking?.guestName || 'DELETE').toLowerCase()}
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
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm font-bold"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      )}
      <div className="flex gap-3 ml-auto">
        {!showConfirmDelete && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="booking-form"
              className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 text-sm"
            >
              <Save size={16} /> {isAdmin ? (booking ? 'Update Booking' : 'Create Booking') : 'Save Comment'}
            </button>
          </>
        )}
      </div>
    </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={booking ? (isAdmin ? 'Edit Booking' : 'Booking Details') : 'New Booking'} footer={modalFooter} dismissible={!error}>
      <form id="booking-form" onSubmit={handleSave} autoComplete="off" className="space-y-5">
        
        {/* Basic Info */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Guest Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Guest Name</label>
              {isAdmin ? (
                <input 
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.guestName || ''}
                  onChange={e => setFormData({ ...formData, guestName: e.target.value })}
                />
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {formData.guestName || '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Adults</label>
              {isAdmin ? (
                <input 
                  type="number"
                  min={0}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.adults ?? ''}
                  onChange={e => setFormData({ ...formData, adults: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {formData.adults ?? 0}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Kids</label>
              {isAdmin ? (
                <input 
                  type="number"
                  min={0}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.kids ?? ''}
                  onChange={e => setFormData({ ...formData, kids: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {formData.kids ?? 0}
                </div>
              )}
            </div>
          </div>

          {/* Bed configuration — collapsed by default */}
          {isAdmin && (
            <div>
              <button
                type="button"
                onClick={() => setShowBedConfig(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 font-bold transition-colors"
              >
                {showBedConfig ? '▾ Hide bed config' : '▸ Bed configuration'}
              </button>
              {showBedConfig && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Single Beds</label>
                    <input 
                      type="number" min={0}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.singleBeds ?? ''}
                      onChange={e => setFormData({ ...formData, singleBeds: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Double Beds</label>
                    <input 
                      type="number" min={0}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.doubleBeds ?? ''}
                      onChange={e => setFormData({ ...formData, doubleBeds: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Stay Info */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
              {isAdmin ? (
                <DatePicker 
                  value={formData.checkIn || ''}
                  onChange={val => {
                    setFormData(prev => ({ 
                      ...prev, 
                      checkIn: val,
                      checkOut: (prev.checkOut && val >= prev.checkOut) ? '' : prev.checkOut
                    }));
                    setError(null);
                  }}
                />
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {formData.checkIn || '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
              {isAdmin ? (
                <DatePicker 
                  value={formData.checkOut || ''}
                  min={formData.checkIn ? new Date(new Date(formData.checkIn).getTime() + 86400000).toISOString().split('T')[0] : ''}
                  onChange={val => {
                    setFormData({ ...formData, checkOut: val });
                    setError(null);
                  }}
                />
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {formData.checkOut || '-'}
                </div>
              )}
            </div>
            <div className="col-span-2 text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg font-bold">
              Total Stay: {nights} nights
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
              {isAdmin ? (
                <select 
                  required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.roomId || ''}
                  onChange={e => {
                    setFormData({ ...formData, roomId: e.target.value });
                    setError(null);
                  }}
                >
                  <option value="">Select Room</option>
                  {!booking && <option value="ALL" className="font-bold text-blue-600">✨ All Rooms (Bulk)</option>}
                  {rooms.map(r => <option key={String(r.id)} value={String(r.id)}>{typeof r.name === 'object' ? 'Unnamed Room' : String(r.name)}</option>)}
                </select>
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {rooms.find(r => r.id === formData.roomId)?.name || (formData.roomId === 'ALL' ? 'All Rooms' : '-')}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              {isAdmin ? (
                <select 
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.type || ''}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="">Select type</option>
                  {bookingTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic">
                  {formData.type || '-'}
                </div>
              )}
            </div>

            {isAdmin && liveOverlapWarning && (
              <div className="col-span-2 flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-1">
                <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-rose-700">{liveOverlapWarning}</span>
              </div>
            )}
          </div>
        </section>

        {/* Additional Info + Notes */}
        <section className="space-y-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-rose-500 mb-1 uppercase tracking-wide">Dietary Requirements</label>
            {isAdmin ? (
              <textarea 
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[56px] resize-none"
                placeholder="e.g. Vegan, Gluten-free..."
                value={formData.dietary || ''}
                onChange={e => setFormData({ ...formData, dietary: e.target.value })}
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic min-h-[56px] whitespace-pre-wrap">
                {formData.dietary || '-'}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Booking Notes</label>
            {isAdmin ? (
              <textarea 
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[56px] resize-none"
                placeholder="Any special requests..."
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic min-h-[56px] whitespace-pre-wrap">
                {formData.notes || '-'}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Staff Comments</label>
            <textarea 
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[72px] resize-none"
              placeholder="Internal notes, observations..."
              value={formData.comments || ''}
              onChange={e => setFormData({ ...formData, comments: e.target.value })}
            />
          </div>
        </section>

        {/* Financial info */}
        {isAdmin && (
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Financials</h3>

            {/* Recap / Totals */}
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
              {/* Row 1: Booking Price | Deposit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Booking Price</label>
                  <div className="relative font-mono text-sm">
                    <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none bg-gray-50 font-mono"
                      value={formData.price ?? ''}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {nights > 0 && (formData.price || 0) > 0 && (
                    <span className="block text-right text-xs font-mono text-gray-400 mt-1">
                      ≈ €{((formData.price || 0) / nights).toFixed(2)} / night
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

              {/* Extras Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Extras</label>
                </div>
                
                {(formData.extras || []).map((extra, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <input 
                      className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none bg-gray-50"
                      placeholder="e.g. Airport transfer"
                      value={extra.label || ''}
                      onChange={updateExtra.bind(null, idx, 'label' as any)}
                    />
                    <div className="relative w-32 font-mono text-sm">
                      <span className="absolute left-3 top-2 text-gray-400 text-xs">€</span>
                      <input 
                        type="number"
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl outline-none bg-gray-50 text-xs"
                        value={extra.amount ?? ''}
                        onChange={updateExtra.bind(null, idx, 'amount' as any)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExtra(idx)}
                      className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                    >
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
                          atLimit
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-blue-600 hover:text-blue-700"
                        )}
                      >
                        <Plus size={12} /> Add Extra
                      </button>
                      {atLimit && (
                        <span className="text-[10px] text-gray-400 italic">Maximum 5 extras reached</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Paid Later Section */}
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

                {/* Row 1: Channel dropdown | basis pills | custom amount input */}
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

                  {/* Base amount — always visible; editable only for Custom */}
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

                {/* Row 2: Always-visible commission result — even for 0% / direct */}
                <p className="text-xs text-gray-400 font-mono">
                  {channelCommissionRate}% commission
                  <span className="mx-1.5 text-gray-200">·</span>
                  €{liveCommission.toFixed(2)}
                </p>
              </div>

            </div>
          </section>
        )}


        {/* Error Message */}
        {venueHireOverlapName && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 mb-4">
            <span className="text-lg shrink-0">⚠️</span>
            <div className="text-xs font-bold text-orange-800">
              These dates overlap with a Venue Hire: {venueHireOverlapName}. You can still proceed.
            </div>
          </div>
        )}

      </form>
    </Modal>
  );
}
