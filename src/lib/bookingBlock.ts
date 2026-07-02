import { Booking } from '@/types';

export const BLOCKED_BOOKING_TYPE = 'Blocked';
export const BLOCKED_GUEST_NAME = 'Blocked';

export function isBlockedBooking(booking: { type?: string }): boolean {
  return booking.type?.toLowerCase() === BLOCKED_BOOKING_TYPE.toLowerCase();
}

export function blockedBarLabel(notes?: string): string {
  const reason = notes?.trim();
  return reason ? `${BLOCKED_GUEST_NAME} · ${reason}` : BLOCKED_GUEST_NAME;
}

export function buildBlockedBookingPayload(
  roomId: string,
  checkIn: string,
  checkOut: string,
  notes: string,
  bookingChannel: string,
): Omit<Booking, 'id'> {
  return {
    guestName: BLOCKED_GUEST_NAME,
    additionalNames: '',
    adults: 0,
    kids: 0,
    totalGuests: 0,
    type: BLOCKED_BOOKING_TYPE,
    checkIn,
    checkOut,
    roomId,
    bedSetting: 'Double',
    singleBeds: 0,
    doubleBeds: 0,
    dietary: '',
    notes: notes.trim(),
    comments: '',
    price: 0,
    extras: [],
    deposit: 0,
    paidLater1: 0,
    paidLater2: 0,
    bookingChannelBasis: 'bookingPrice',
    paymentChannelBasis: 'bookingPrice',
    status: 'Paid',
    bookingChannel: bookingChannel || 'Direct',
    paymentChannel: '',
    source: '',
    lifecycleStatus: 'active',
  };
}
