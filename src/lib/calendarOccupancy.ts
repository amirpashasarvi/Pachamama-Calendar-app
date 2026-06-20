import { addDays, format, parseISO } from 'date-fns';
import { Booking } from '@/types';

export const EMPTY_OCCUPIED_DATES = new Set<string>();

function occupiedDatesForBookings(bookings: Booking[]): Set<string> {
  const dates = new Set<string>();
  for (const booking of bookings) {
    let day = parseISO(booking.checkIn);
    const checkOut = parseISO(booking.checkOut);
    while (day < checkOut) {
      dates.add(format(day, 'yyyy-MM-dd'));
      day = addDays(day, 1);
    }
  }
  return dates;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/** True when two per-room lists show the same bookings on the calendar. */
function roomBookingListEqual(prev: Booking[], next: Booking[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id) return false;
    if (a.updatedAt !== b.updatedAt) return false;
    if (a.commentsUpdatedAt !== b.commentsUpdatedAt) return false;
    if (!a.updatedAt && !b.updatedAt) {
      if (
        a.checkIn !== b.checkIn ||
        a.checkOut !== b.checkOut ||
        a.roomId !== b.roomId ||
        a.guestName !== b.guestName ||
        a.type !== b.type ||
        a.status !== b.status ||
        a.lifecycleStatus !== b.lifecycleStatus ||
        a.adults !== b.adults ||
        a.kids !== b.kids ||
        a.notes !== b.notes ||
        a.comments !== b.comments ||
        a.bookingChannel !== b.bookingChannel ||
        a.dietary !== b.dietary
      ) {
        return false;
      }
    }
  }
  return true;
}

export function buildBookingsByRoom(
  bookings: Booking[],
  previous: Map<string, Booking[]> = new Map(),
): Map<string, Booking[]> {
  const grouped = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (!booking.roomId) continue;
    const list = grouped.get(booking.roomId);
    if (list) list.push(booking);
    else grouped.set(booking.roomId, [booking]);
  }

  if (grouped.size !== previous.size) {
    return finalizeBookingsByRoom(grouped, previous, false);
  }

  let allReused = true;
  for (const roomId of previous.keys()) {
    if (!grouped.has(roomId)) {
      allReused = false;
      break;
    }
  }

  if (allReused) {
    for (const [roomId, list] of grouped) {
      const prevList = previous.get(roomId);
      if (!prevList || !roomBookingListEqual(prevList, list)) {
        allReused = false;
        break;
      }
    }
  }

  if (allReused) return previous;

  return finalizeBookingsByRoom(grouped, previous, true);
}

function finalizeBookingsByRoom(
  grouped: Map<string, Booking[]>,
  previous: Map<string, Booking[]>,
  trackReuse: boolean,
): Map<string, Booking[]> {
  const result = new Map<string, Booking[]>();
  let allReused = trackReuse;

  for (const [roomId, list] of grouped) {
    const prevList = previous.get(roomId);
    if (prevList && roomBookingListEqual(prevList, list)) {
      result.set(roomId, prevList);
    } else {
      result.set(roomId, list);
      allReused = false;
    }
  }

  return allReused ? previous : result;
}

export function buildOccupiedDatesByRoom(
  bookingsByRoom: Map<string, Booking[]>,
  previous: Map<string, Set<string>> = new Map(),
  previousBookingsByRoom: Map<string, Booking[]> = new Map(),
): Map<string, Set<string>> {
  if (bookingsByRoom === previousBookingsByRoom) return previous;

  if (bookingsByRoom.size !== previous.size) {
    return finalizeOccupiedDatesByRoom(bookingsByRoom, previous, previousBookingsByRoom, false);
  }

  let allReused = true;
  for (const roomId of previous.keys()) {
    if (!bookingsByRoom.has(roomId)) {
      allReused = false;
      break;
    }
  }

  if (allReused) {
    for (const [roomId, list] of bookingsByRoom) {
      if (list !== previousBookingsByRoom.get(roomId)) {
        allReused = false;
        break;
      }
    }
  }

  if (allReused) return previous;

  return finalizeOccupiedDatesByRoom(bookingsByRoom, previous, previousBookingsByRoom, true);
}

function finalizeOccupiedDatesByRoom(
  bookingsByRoom: Map<string, Booking[]>,
  previous: Map<string, Set<string>>,
  previousBookingsByRoom: Map<string, Booking[]>,
  trackReuse: boolean,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  let allReused = trackReuse;

  for (const [roomId, list] of bookingsByRoom) {
    if (list === previousBookingsByRoom.get(roomId)) {
      const prevSet = previous.get(roomId);
      if (prevSet) {
        result.set(roomId, prevSet);
        continue;
      }
    }

    const dates = occupiedDatesForBookings(list);
    const prevSet = previous.get(roomId);
    if (prevSet && setsEqual(prevSet, dates)) {
      result.set(roomId, prevSet);
    } else {
      result.set(roomId, dates);
      allReused = false;
    }
  }

  return allReused ? previous : result;
}
