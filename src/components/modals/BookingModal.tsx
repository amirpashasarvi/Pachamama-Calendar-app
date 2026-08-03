import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Booking, Room, GlobalSettings, BookingStatus, ConfigOption, VenueHire } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { calculateNights, cn } from '@/lib/utils';
import { migrateCommissionFields } from '@/lib/commission';
import CommissionFields from '@/components/modals/CommissionFields';
import { addDays, parseISO, format } from 'date-fns';
import { logActivity } from '@/lib/activityLog';
import { isActiveLifecycle, isCancelledLifecycle } from '@/lib/bookingLifecycle';
import { getCollectedAmount, getLaterPaymentsTotal, paymentsFromLegacy, syncLegacyPaidLaterFields } from '@/lib/bookingFinancials';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Trash2, Save, Plus, X, AlertTriangle, Ban, RotateCcw, Receipt } from 'lucide-react';

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
  paymentChannels: ConfigOption[];
  initialData?: Partial<Booking>;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  elevated?: boolean;
}

const FIN_GRID = 'grid grid-cols-2 gap-x-3 gap-y-3';
const FIN_DELETE_SLOT = 'shrink-0 w-[38px] h-[42px] flex items-center justify-center';
const FIN_INPUT = 'w-full border border-slate-200 rounded-xl bg-white text-sm';
const FIN_FIELD = cn(FIN_INPUT, 'py-2.5');
const FIN_FIELD_ROW = 'h-[42px] flex items-center';
const FIN_LABEL = 'block text-xs font-bold text-gray-400 mb-1 uppercase';

function FinInputRow({
  label,
  children,
  onDelete,
  reserveDelete = true,
  labelHidden = false,
}: {
  label?: string;
  children: React.ReactNode;
  onDelete?: () => void;
  reserveDelete?: boolean;
  labelHidden?: boolean;
}) {
  return (
    <div className="min-w-0">
      {label != null && (
        <label
          className={cn(FIN_LABEL, labelHidden && 'invisible select-none')}
          aria-hidden={labelHidden}
        >
          {labelHidden ? '\u00A0' : label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">{children}</div>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className={cn(FIN_DELETE_SLOT, 'text-rose-500 hover:bg-rose-50 rounded-lg')}
            aria-label="Remove"
          >
            <X size={14} />
          </button>
        ) : reserveDelete ? (
          <div className={FIN_DELETE_SLOT} aria-hidden />
        ) : null}
      </div>
    </div>
  );
}

function FinActionCell({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FinInputRow labelHidden label="\u00A0">
      <div className={cn(FIN_FIELD_ROW, 'justify-center w-full')}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 text-xs font-bold',
            disabled
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-blue-600 hover:text-blue-700'
          )}
        >
          {children}
        </button>
      </div>
    </FinInputRow>
  );
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
  paymentChannels,
  venueHires = [],
  initialData,
  isAdmin = false,
  currentUserName = '',
  currentUserEmail = '',
  elevated = false,
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
    payments: [],
    paidLater1: 0,
    paidLater2: 0,
    bookingChannelBasis: 'bookingPrice' as const,
    bookingChannelCustomAmount: 0,
    paymentChannelBasis: 'bookingPrice' as const,
    paymentChannelCustomAmount: 0,
    source: '',
    bookingChannel: '',
    paymentChannel: '',
    status: 'Unpaid' as BookingStatus,
    comments: ''
  };

  const [formData, setFormData] = useState<Partial<Booking>>(INITIAL_BOOKING_STATE);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isReactivating, setIsReactivating] = useState(false);
  const [showBedConfig, setShowBedConfig] = useState(false);

  const isCancelled = isCancelledLifecycle(booking ?? {});

  useEffect(() => {
    if (booking) {
      // Map old fields if they exist for backward compatibility
      const mappedBooking = {
        ...booking,
        extras: Array.isArray(booking.extras) && booking.extras.length > 0
          ? booking.extras
          : (booking as any).extraCharges
            ? [{ label: 'Extras', amount: (booking as any).extraCharges }]
            : [],
        paidLater1: booking.paidLater1 ?? (booking as any).paidLater ?? 0,
        paidLater2: booking.paidLater2 ?? 0,
        payments: paymentsFromLegacy(booking.paidLater1, booking.paidLater2, booking.payments),
        ...migrateCommissionFields(booking),
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
    setIsDeleting(false);
    setShowConfirmCancel(false);
    setShowConfirmRestore(false);
    setIsCancelling(false);
    setCancelReason('');
    setIsReactivating(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, initialData, isOpen]);

  useEffect(() => {
    if (!showConfirmDelete && !showConfirmCancel && !showConfirmRestore) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfirmDelete(false);
        setShowConfirmCancel(false);
        setShowConfirmRestore(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showConfirmDelete, showConfirmCancel, showConfirmRestore]);

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
  const collected = getCollectedAmount(formData);
  const remaining = total - collected;

  let calculatedStatus: BookingStatus = 'Unpaid';
  if (remaining <= 0 && total > 0) calculatedStatus = 'Paid';
  else if (collected > 0) calculatedStatus = 'Partial';

  const nights = calculateNights(formData.checkIn || '', formData.checkOut || '');

  const checkOverlaps = (targetRoomId: string) => {
    if (!targetRoomId || !formData.checkIn || !formData.checkOut) return null;

    const overlappingBooking = bookings.find(existing => {
      if (booking?.id && existing.id === booking.id) return false;
      if (!isActiveLifecycle(existing)) return false;
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
      if (!isActiveLifecycle(vh)) return false;
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

    if (isAdmin && !formData.bookingChannel?.trim()) {
      setError('Please select a booking channel before saving.');
      return;
    }

    if (isAdmin && getLaterPaymentsTotal(formData) > 0 && !formData.paymentChannel?.trim()) {
      setError('Please select a payment channel when payment amounts are entered.');
      return;
    }

    // Filter out empty extras
    const filteredExtras = (formData.extras || []).filter(e => e.label || e.amount > 0);
    const filteredPayments = (formData.payments || []).filter(amount => amount > 0);
    const legacyPaidLater = syncLegacyPaidLaterFields(filteredPayments);

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

    const { id, channelPaymentBasis: _legacyBasis, commissionCustomAmount: _legacyCustom, ...dataToSave } = formData;
    const data = removeUndefinedDeep({
      ...dataToSave,
      bookingChannelBasis: formData.bookingChannelBasis || 'bookingPrice',
      paymentChannelBasis: formData.paymentChannelBasis || 'bookingPrice',
      extras: filteredExtras,
      payments: filteredPayments,
      ...legacyPaidLater,
      status: calculatedStatus,
      totalGuests: (formData.adults || 0) + (formData.kids || 0),
      updatedAt: new Date().toISOString(),
    }) as Record<string, unknown>;

    setIsSaving(true);
    try {
      const room = rooms.find(r => r.id === formData.roomId);
      const roomName = room?.name ?? formData.roomId ?? '';
      const guest = formData.guestName || 'Unknown guest';
      const dates = `${formData.checkIn} → ${formData.checkOut}`;
      const logBase = { userName: currentUserName || currentUserEmail, userEmail: currentUserEmail, entityType: 'booking' as const };

      if (booking?.id) {
        if (isAdmin) {
          await updateDoc(doc(db, 'bookings', booking.id), data);
          logActivity({ ...logBase, action: 'updated', entityId: booking.id, summary: `Booking updated for ${guest} · ${roomName} · ${dates}` });
        } else {
          // If staff, only update comments
          await updateDoc(doc(db, 'bookings', booking.id), {
            comments: formData.comments || '',
            commentsUpdatedAt: new Date().toISOString(),
          });
          logActivity({ ...logBase, action: 'updated', entityId: booking.id, summary: `Comment added on booking for ${guest} · ${roomName}` });
        }
      } else if (formData.roomId === 'ALL') {
        // Bulk Create
        const promises = rooms.map(room => {
          const bulkData = { ...data, roomId: room.id, createdAt: new Date().toISOString() };
          return addDoc(collection(db, 'bookings'), bulkData);
        });
        const results = await Promise.all(promises);
        results.forEach((ref, i) => {
          logActivity({ ...logBase, action: 'created', entityId: ref.id, summary: `Booking created for ${guest} · ${rooms[i]?.name} · ${dates}` });
        });
      } else {
        const createData = { ...data, createdAt: new Date().toISOString() };
        const ref = await addDoc(collection(db, 'bookings'), createData);
        logActivity({ ...logBase, action: 'created', entityId: ref.id, summary: `Booking created for ${guest} · ${roomName} · ${dates}` });
      }
      onClose();
    } catch (err) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : 'Failed to save booking. Please try again.';
      setError(msg);
    }
  };

  const handleDelete = async () => {
    if (!booking?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { deletedAt: new Date().toISOString() });
      logActivity({ action: 'deleted', entityType: 'booking', entityId: booking.id, summary: `Booking deleted for ${booking.guestName}`, userName: currentUserName || currentUserEmail, userEmail: currentUserEmail });
      setShowConfirmDelete(false);
      onClose();
    } catch (err) {
      setIsDeleting(false);
      setShowConfirmDelete(false);
      handleFirestoreError(err, OperationType.DELETE, `bookings/${booking.id}`);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking?.id || isCancelling) return;
    setIsCancelling(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'bookings', booking.id), {
        lifecycleStatus: 'cancelled',
        cancelledAt: now,
        cancellationReason: cancelReason.trim() || '',
        updatedAt: now,
      });
      const roomName = rooms.find(r => r.id === booking.roomId)?.name ?? '';
      logActivity({
        action: 'cancelled',
        entityType: 'booking',
        entityId: booking.id,
        summary: `Booking cancelled for ${booking.guestName}${roomName ? ` · ${roomName}` : ''}`,
        userName: currentUserName || currentUserEmail,
        userEmail: currentUserEmail,
      });
      setShowConfirmCancel(false);
      onClose();
    } catch (err) {
      setIsCancelling(false);
      const msg = err instanceof Error ? err.message : 'Failed to cancel booking.';
      setError(msg);
    }
  };

  const handleRestoreBooking = async () => {
    if (!booking?.id || isReactivating) return;

    const overlapMessage = checkOverlaps(booking.roomId);
    if (overlapMessage) {
      setError(`Cannot restore booking: ${overlapMessage}`);
      setShowConfirmRestore(false);
      return;
    }

    setIsReactivating(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'bookings', booking.id), {
        lifecycleStatus: 'active',
        cancelledAt: null,
        cancellationReason: '',
        updatedAt: now,
      });
      logActivity({
        action: 'restored',
        entityType: 'booking',
        entityId: booking.id,
        summary: `Booking restored for ${booking.guestName}`,
        userName: currentUserName || currentUserEmail,
        userEmail: currentUserEmail,
      });
      setShowConfirmRestore(false);
      onClose();
    } catch (err) {
      setIsReactivating(false);
      const msg = err instanceof Error ? err.message : 'Failed to restore booking.';
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

  const addPayment = () => {
    setFormData(prev => ({
      ...prev,
      payments: [...(prev.payments || []), 0],
    }));
  };

  const updatePayment = (index: number, value: number) => {
    const newPayments = [...(formData.payments || [])];
    newPayments[index] = value;
    setFormData({ ...formData, payments: newPayments });
  };

  const removePayment = (index: number) => {
    setFormData({
      ...formData,
      payments: (formData.payments || []).filter((_, i) => i !== index),
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      {booking && isAdmin && (
        <div className="flex items-center gap-1 sm:gap-2">
          {isCancelled ? (
            <button
              type="button"
              onClick={() => setShowConfirmRestore(true)}
              disabled={isReactivating}
              className="flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-3 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-[11px] sm:text-sm font-bold disabled:opacity-50"
            >
              {isReactivating ? (
                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-emerald-400/40 border-t-emerald-700 rounded-full animate-spin" />
              ) : (
                <RotateCcw size={14} className="sm:w-4 sm:h-4" />
              )}
              <span className="sm:hidden">Restore</span>
              <span className="hidden sm:inline">Restore Booking</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmCancel(true)}
              className="flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-3 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors text-[11px] sm:text-sm font-bold"
            >
              <Ban size={14} className="sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden">Cancel Bkg</span>
              <span className="hidden sm:inline">Cancel Booking</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-3 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-[11px] sm:text-sm font-bold"
          >
            <Trash2 size={14} className="sm:w-4 sm:h-4 shrink-0" /> Delete
          </button>
        </div>
      )}
      <div className="flex gap-1.5 sm:gap-3 ml-auto">
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 sm:px-6 sm:py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-[11px] sm:text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="booking-form"
            className="flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-8 sm:py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 text-[11px] sm:text-sm"
          >
            <Save size={14} className="sm:w-4 sm:h-4 shrink-0" />
            {isAdmin ? (
              booking ? (
                <>
                  <span className="sm:hidden">Update</span>
                  <span className="hidden sm:inline">Update Booking</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Create</span>
                  <span className="hidden sm:inline">Create Booking</span>
                </>
              )
            ) : (
              <>
                <span className="sm:hidden">Save</span>
                <span className="hidden sm:inline">Save Comment</span>
              </>
            )}
          </button>
        </>
      </div>
    </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={booking ? (isAdmin ? (isCancelled ? 'Cancelled Booking' : 'Edit Booking') : 'Booking Details') : 'New Booking'} footer={modalFooter} dismissible={!error} elevated={elevated}>
      <form id="booking-form" onSubmit={handleSave} autoComplete="off" className="space-y-5">

        {isCancelled && (
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
            This booking is cancelled and hidden from the calendar.
            {booking?.cancellationReason && (
              <span className="block mt-1 font-medium text-slate-500">Reason: {booking.cancellationReason}</span>
            )}
          </div>
        )}
        
        {/* Basic Info */}
        <section className="space-y-3">
          {(formData.source === 'booking-site' || formData.guestEmail || formData.cardSaved) && (
            <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Public booking</p>
              {formData.guestEmail && (
                <p className="text-xs text-gray-700"><span className="font-bold">Email:</span> {formData.guestEmail}</p>
              )}
              {formData.guestPhone && (
                <p className="text-xs text-gray-700"><span className="font-bold">Phone:</span> {formData.guestPhone}</p>
              )}
              {formData.formSlug && (
                <p className="text-xs text-gray-500">Form: {formData.formSlug}</p>
              )}
              {formData.retreatRunId && (
                <p className="text-xs text-gray-500">Retreat run: {formData.retreatRunId.slice(0, 8)}…</p>
              )}
              {formData.cardSaved && (
                <p className="text-xs font-bold text-emerald-700">Card saved on file — charge manually in Stripe when approved.</p>
              )}
            </div>
          )}
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
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showBedConfig ? (
                  <>▾ Hide bed configuration</>
                ) : (
                  <>
                    <Plus size={12} /> Add bed configuration
                  </>
                )}
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
                    setFormData(prev => {
                      const prevNights = calculateNights(prev.checkIn || '', prev.checkOut || '');
                      const n = prevNights > 0 ? prevNights : 6;
                      return {
                        ...prev,
                        checkIn: val,
                        checkOut: val ? format(addDays(parseISO(val), n), 'yyyy-MM-dd') : '',
                      };
                    });
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
                  defaultMonth={formData.checkIn || undefined}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of nights</label>
              {isAdmin ? (
                <div className="flex items-center w-full border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                  <button
                    type="button"
                    disabled={!formData.checkIn || nights <= 1}
                    onClick={() => {
                      if (!formData.checkIn) return;
                      const newNights = Math.max(1, nights - 1);
                      setFormData(prev => ({
                        ...prev,
                        checkOut: format(addDays(parseISO(prev.checkIn!), newNights), 'yyyy-MM-dd'),
                      }));
                      setError(null);
                    }}
                    className="px-4 py-2.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-gray-200 font-bold text-lg leading-none"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center text-sm font-bold text-gray-900 py-2.5">
                    {nights}
                  </div>
                  <button
                    type="button"
                    disabled={!formData.checkIn}
                    onClick={() => {
                      if (!formData.checkIn) return;
                      setFormData(prev => ({
                        ...prev,
                        checkOut: format(addDays(parseISO(prev.checkIn!), nights + 1), 'yyyy-MM-dd'),
                      }));
                      setError(null);
                    }}
                    className="px-4 py-2.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-gray-200 font-bold text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2.5 bg-gray-100/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 italic text-center">
                  {nights} nights
                </div>
              )}
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
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[56px] resize-none placeholder:text-gray-400 placeholder:font-normal"
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
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[56px] resize-none placeholder:text-gray-400 placeholder:font-normal"
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
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[72px] resize-none placeholder:text-gray-400 placeholder:font-normal"
              placeholder="Internal notes, observations..."
              value={formData.comments || ''}
              onChange={e => setFormData({ ...formData, comments: e.target.value })}
            />
          </div>
        </section>

        {/* Financial info */}
        {isAdmin && (
          <section className="-mx-6 px-6 py-5 mt-1 space-y-4 bg-[#ACDDDE] border-y border-teal-200/60">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700">
              <Receipt size={14} className="text-slate-500 shrink-0" />
              Financials
            </h3>

            {/* Summary card */}
            <div className="grid grid-cols-3 gap-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex flex-col items-center justify-center py-3 px-1 sm:py-4 sm:px-2 border-r border-slate-200 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5 sm:mb-1">Total</span>
                <span className="text-sm sm:text-xl font-black text-gray-900 tabular-nums leading-tight truncate max-w-full">€{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col items-center justify-center py-3 px-1 sm:py-4 sm:px-2 border-r border-slate-200 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5 sm:mb-1">Remaining</span>
                <span className="text-sm sm:text-xl font-black text-blue-600 tabular-nums leading-tight truncate max-w-full">€{remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col items-center justify-center py-3 px-1 sm:py-4 sm:px-2 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5 sm:mb-1">Status</span>
                <span className={cn(
                  "px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black italic uppercase tracking-tighter shadow-sm",
                  calculatedStatus === 'Paid' ? 'bg-green-100 text-green-700' :
                  calculatedStatus === 'Partial' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                )}>
                  {calculatedStatus}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Pricing */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Pricing</h4>
                <div className={FIN_GRID}>
                  <FinInputRow label="Booking Price">
                    <div className="relative font-mono text-sm">
                      <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                      <CurrencyInput
                        value={formData.price ?? 0}
                        onChange={v => setFormData({ ...formData, price: v })}
                        className={cn(FIN_FIELD, 'pl-8 pr-3')}
                      />
                    </div>
                  </FinInputRow>
                  <FinActionCell
                    onClick={addExtra}
                    disabled={(formData.extras || []).length >= 5}
                  >
                    <Plus size={12} /> Add Extra
                  </FinActionCell>
                  {nights > 0 && (formData.price || 0) > 0 && (
                    <>
                      <span className="block text-right text-xs font-mono text-gray-400 -mt-1">
                        ≈ €{((formData.price || 0) / nights).toFixed(2)} / night
                      </span>
                      <div aria-hidden />
                    </>
                  )}

                  {(formData.extras || []).map((extra, idx) => (
                    <React.Fragment key={idx}>
                      <FinInputRow>
                        <div className="relative font-mono text-sm">
                          <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                          <CurrencyInput
                            value={extra.amount ?? 0}
                            onChange={v => updateExtra(idx, 'amount' as any, v)}
                            className={cn(FIN_FIELD, 'pl-8 pr-3')}
                          />
                        </div>
                      </FinInputRow>
                      <FinInputRow onDelete={() => removeExtra(idx)}>
                        <input
                          className={cn(FIN_FIELD, 'px-3 outline-none')}
                          placeholder="e.g. Airport transfer"
                          value={extra.label || ''}
                          onChange={e => updateExtra(idx, 'label', e.target.value)}
                        />
                      </FinInputRow>
                    </React.Fragment>
                  ))}
                </div>
                {(formData.extras || []).length >= 5 && (
                  <span className="text-[10px] text-gray-400 italic">Maximum 5 extras reached</span>
                )}
              </div>

              {/* Payments */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Payments</h4>
                <div className={FIN_GRID}>
                  <FinInputRow label="Deposit">
                    <div className="relative font-mono text-sm">
                      <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                      <CurrencyInput
                        value={formData.deposit ?? 0}
                        onChange={v => setFormData({ ...formData, deposit: v })}
                        className={cn(FIN_FIELD, 'pl-8 pr-3')}
                      />
                    </div>
                  </FinInputRow>
                  <FinActionCell onClick={addPayment}>
                    <Plus size={12} /> Add Payment
                  </FinActionCell>

                  {(formData.payments || []).map((amount, idx) => (
                    <FinInputRow
                      key={idx}
                      label={`Payment ${idx + 1}`}
                      onDelete={() => removePayment(idx)}
                    >
                      <div className="relative font-mono text-sm">
                        <span className="absolute left-3 top-2.5 text-gray-400">€</span>
                        <CurrencyInput
                          value={amount ?? 0}
                          onChange={v => updatePayment(idx, v)}
                          className={cn(FIN_FIELD, 'pl-8 pr-3')}
                        />
                      </div>
                    </FinInputRow>
                  ))}
                </div>
              </div>

              <CommissionFields
                price={formData.price || 0}
                deposit={formData.deposit || 0}
                extras={formData.extras}
                bookingChannel={formData.bookingChannel || ''}
                paymentChannel={formData.paymentChannel || ''}
                bookingChannelBasis={formData.bookingChannelBasis || 'bookingPrice'}
                bookingChannelCustomAmount={formData.bookingChannelCustomAmount}
                paymentChannelBasis={formData.paymentChannelBasis || 'bookingPrice'}
                paymentChannelCustomAmount={formData.paymentChannelCustomAmount}
                bookingChannels={bookingChannels}
                paymentChannels={paymentChannels}
                onChange={patch => setFormData(prev => ({ ...prev, ...patch }))}
              />

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

      {/* Restore confirmation overlay */}
      {showConfirmRestore && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          onMouseDown={() => !isReactivating && setShowConfirmRestore(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 mb-5">
              <h3 className="text-base font-bold text-gray-900">Restore this booking?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                The booking will return to the calendar as active. Make sure the room is still available for these dates.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmRestore(false)}
                disabled={isReactivating}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Keep Cancelled
              </button>
              <button
                type="button"
                onClick={handleRestoreBooking}
                disabled={isReactivating}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isReactivating ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                {isReactivating ? 'Restoring…' : 'Restore Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation overlay */}
      {showConfirmCancel && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          onMouseDown={() => !isCancelling && setShowConfirmCancel(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-base font-bold text-gray-900">Cancel this booking?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                The booking will be removed from the calendar. Any deposit or payments received will count toward revenue on the check-in date.
              </p>
            </div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Reason (optional)</label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={2}
              className="w-full mb-5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-100 resize-none"
              placeholder="Guest cancelled, date change, etc."
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmCancel(false)}
                disabled={isCancelling}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Ban size={14} />
                )}
                {isCancelling ? 'Cancelling…' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {showConfirmDelete && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          onMouseDown={() => setShowConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 mb-5">
              <h3 className="text-base font-bold text-gray-900">Delete this booking?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">The booking will be moved to Trash and can be restored later.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {isDeleting ? 'Deleting…' : 'Delete Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
