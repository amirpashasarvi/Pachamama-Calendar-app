import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Booking, Room, GlobalSettings, BookingStatus, ConfigOption, VenueHire } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { calculateNights, cn } from '@/lib/utils';
import { Trash2, Save, Plus, X } from 'lucide-react';

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
    source: '',
    bookingChannel: '',
    status: 'Unpaid' as BookingStatus,
    comments: ''
  };

  const [formData, setFormData] = useState<Partial<Booking>>(INITIAL_BOOKING_STATE);

  const [error, setError] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

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
      // Default type if nothing selected
      setFormData({
        ...INITIAL_BOOKING_STATE,
        type: bookingTypes[0]?.name || '',
        bookingChannel: bookingChannels[0]?.name || ''
      });
    }
    setError(null);
    setShowConfirmDelete(false);
  }, [booking, initialData, isOpen, bookingTypes, bookingChannels]);

  // Set defaults for new bookings
  useEffect(() => {
    if (!booking && !initialData && isOpen) {
      if (!formData.type && bookingTypes.length > 0) {
        setFormData(prev => ({ ...prev, type: bookingTypes[0].name }));
      }
      if (!formData.bookingChannel && bookingChannels.length > 0) {
        setFormData(prev => ({ ...prev, bookingChannel: bookingChannels[0].name }));
      }
    }
  }, [isOpen, bookingTypes, bookingChannels, booking, initialData]);

  // Status calculation logic
  const totalExtras = (formData.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const total = (formData.price || 0) + totalExtras;
  const remaining = total - (formData.deposit || 0) - (formData.paidLater1 || 0) - (formData.paidLater2 || 0);
  
  let calculatedStatus: BookingStatus = 'Unpaid';
  if (remaining <= 0 && total > 0) calculatedStatus = 'Paid';
  else if ((formData.deposit || 0) > 0 || (formData.paidLater1 || 0) > 0 || (formData.paidLater2 || 0) > 0) calculatedStatus = 'Partial';

  const nights = calculateNights(formData.checkIn || '', formData.checkOut || '');

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    const { id, ...dataToSave } = formData;
    const data = {
      ...dataToSave,
      extras: filteredExtras,
      status: calculatedStatus,
      totalGuests: (formData.adults || 0) + (formData.kids || 0),
      updatedAt: new Date().toISOString()
    };

    try {
      if (booking?.id) {
        if (isAdmin) {
          await updateDoc(doc(db, 'bookings', booking.id), data);
        } else {
          // If staff, only update comments
          await updateDoc(doc(db, 'bookings', booking.id), {
            comments: formData.comments || ''
          });
        }
      } else if (formData.roomId === 'ALL') {
        // Bulk Create
        const promises = rooms.map(room => {
          return addDoc(collection(db, 'bookings'), {
            ...data,
            roomId: room.id,
            createdAt: new Date().toISOString()
          });
        });
        await Promise.all(promises);
      } else {
        await addDoc(collection(db, 'bookings'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, booking?.id ? OperationType.UPDATE : OperationType.CREATE, booking?.id ? `bookings/${booking.id}` : 'bookings');
    }
  };

  const handleDelete = async () => {
    if (!booking?.id) return;
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookings/${booking.id}`);
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
    <Modal isOpen={isOpen} onClose={onClose} title={booking ? (isAdmin ? 'Edit Booking' : 'Booking Details') : 'New Booking'}>
      <form onSubmit={handleSave} className="space-y-8">
        
        {/* Basic Info */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Guest Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Main Guest Name</label>
              {isAdmin ? (
                <input 
                  required
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.guestName || ''}
                  onChange={e => setFormData({ ...formData, guestName: e.target.value })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
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
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.adults ?? ''}
                  onChange={e => setFormData({ ...formData, adults: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
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
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.kids ?? ''}
                  onChange={e => setFormData({ ...formData, kids: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {formData.kids ?? 0}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Single Beds</label>
              {isAdmin ? (
                <input 
                  type="number"
                  min={0}
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.singleBeds ?? ''}
                  onChange={e => setFormData({ ...formData, singleBeds: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {formData.singleBeds ?? 0}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Double Beds</label>
              {isAdmin ? (
                <input 
                  type="number"
                  min={0}
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.doubleBeds ?? ''}
                  onChange={e => setFormData({ ...formData, doubleBeds: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {formData.doubleBeds ?? 0}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stay Info */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Check-in</label>
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
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {formData.checkIn || '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Check-out</label>
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
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {formData.checkOut || '-'}
                </div>
              )}
            </div>
            <div className="col-span-2 text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded font-bold">
              Total Stay: {nights} nights
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Room</label>
              {isAdmin ? (
                <select 
                  required
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {rooms.find(r => r.id === formData.roomId)?.name || (formData.roomId === 'ALL' ? 'All Rooms' : '-')}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
              {isAdmin ? (
                <select 
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.type || ''}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="">Select Type</option>
                  {bookingTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic">
                  {formData.type || '-'}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Additional Info */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1 text-rose-500">Dietary Requirements</label>
              {isAdmin ? (
                <textarea 
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                  placeholder="e.g. Vegan, Gluten-free..."
                  value={formData.dietary || ''}
                  onChange={e => setFormData({ ...formData, dietary: e.target.value })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic min-h-[60px] whitespace-pre-wrap">
                  {formData.dietary || '-'}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Booking Notes</label>
              {isAdmin ? (
                <textarea 
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                  placeholder="Any special requests..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              ) : (
                <div className="px-4 py-2 bg-gray-100/50 border rounded-lg text-sm font-bold text-gray-900 italic min-h-[60px] whitespace-pre-wrap">
                  {formData.notes || '-'}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Comments Section */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">COMMENTS</label>
              <textarea 
                className="w-full px-4 py-2 bg-white border-2 border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] shadow-sm"
                placeholder="Add a comment..."
                value={formData.comments || ''}
                onChange={e => setFormData({ ...formData, comments: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Financial info */}
        {isAdmin && (
          <section className="space-y-4 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Financials</h3>
            <div className="space-y-4">
              {/* Row 1: Booking Price | Deposit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Booking Price</label>
                  <div className="relative font-mono text-sm">
                    <span className="absolute left-3 top-2 text-gray-400">€</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-2 border rounded-lg outline-none bg-white font-mono"
                      value={formData.price ?? ''}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
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

              {/* Extras Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Extras</label>
                </div>
                
                {(formData.extras || []).map((extra, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <input 
                      className="flex-1 px-3 py-2 text-xs border rounded-lg outline-none bg-white"
                      placeholder="e.g. Airport transfer"
                      value={extra.label || ''}
                      onChange={updateExtra.bind(null, idx, 'label' as any)}
                    />
                    <div className="relative w-32 font-mono text-sm">
                      <span className="absolute left-3 top-1.5 text-gray-400 text-xs">€</span>
                      <input 
                        type="number"
                        className="w-full pl-7 pr-3 py-1.5 border rounded-lg outline-none bg-white text-xs"
                        value={extra.amount ?? ''}
                        onChange={updateExtra.bind(null, idx, 'amount' as any)}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeExtra(idx)}
                      className="p-1 px-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {(formData.extras || []).length < 2 && (
                  <button
                    type="button"
                    onClick={addExtra}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 mt-1"
                  >
                    <Plus size={12} /> Add Extra
                  </button>
                )}
              </div>

              {/* Paid Later Section */}
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

              {/* Booking Channel + Payment Basis */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Booking Channel</label>
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
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Payment Basis</label>
                  <div className="flex p-1 bg-white border rounded-lg h-[34px]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, channelPaymentBasis: 'bookingPrice' })}
                      className={cn(
                        "flex-1 px-1 text-[9px] font-bold rounded transition-all leading-tight",
                        formData.channelPaymentBasis === 'bookingPrice' 
                          ? "bg-black text-white shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Booking Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, channelPaymentBasis: 'deposit' })}
                      className={cn(
                        "flex-1 px-1 text-[9px] font-bold rounded transition-all leading-tight",
                        formData.channelPaymentBasis === 'deposit' 
                          ? "bg-black text-white shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Deposit
                    </button>
                  </div>
                </div>
              </div>

              {/* Recap / Totals */}
              <div className="pt-4 border-t flex flex-col gap-2">
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

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <Trash2 size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="text-sm font-bold text-rose-800 whitespace-pre-line">{error}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          {booking && isAdmin && (
            <div className="flex items-center gap-2">
              {showConfirmDelete ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <span className="text-[10px] font-bold text-gray-500 italic">Delete this booking?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-lg hover:bg-rose-600 transition-colors"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm font-bold"
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
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 px-8 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 text-sm"
                >
                  <Save size={16} /> {isAdmin ? (booking ? 'Update Booking' : 'Create Booking') : 'Save Comment'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
