import { useMemo } from 'react';
import { Booking, Room } from '@/types';
import { isActiveLifecycle } from '@/lib/bookingLifecycle';
import { getCollectedAmount, asExtrasList } from '@/lib/bookingFinancials';
import {
  startOfDay, startOfToday,
  parseISO, differenceInDays, addDays,
} from 'date-fns';
import { isBlockedBooking } from '@/lib/bookingBlock';

export interface BalanceAlert {
  bookingId: string;
  guestName: string;
  room: string;
  checkIn: string;
  checkOut: string;
  remaining: number;
  daysUntilCheckIn: number;
  daysUntilCheckOut: number;
  daysSinceCheckout: number;
}

function bookingRemaining(b: Booking): number {
  const extrasTotal = asExtrasList(b.extras).reduce((s, e) => s + (e.amount || 0), 0);
  const total = (b.price || 0) + extrasTotal;
  const collected = getCollectedAmount(b);
  return Math.max(0, total - collected);
}

export function useAlerts(bookings: Booking[], rooms: Room[]) {
  const activeBookings = useMemo(
    () => bookings.filter(b => isActiveLifecycle(b) && !isBlockedBooking(b)),
    [bookings],
  );

  /** Orange — balance due before checkout (from 10 days pre-arrival through last night of stay). */
  const preDepartureBalanceAlerts = useMemo((): BalanceAlert[] => {
    const today = startOfToday();

    return activeBookings
      .map(b => {
        const checkIn = startOfDay(parseISO(b.checkIn));
        const checkOut = startOfDay(parseISO(b.checkOut));
        const remaining = bookingRemaining(b);
        const windowStart = addDays(checkIn, -10);
        const inWindow = today >= windowStart && today < checkOut;
        if (!inWindow || remaining <= 0) return null;

        return {
          bookingId: b.id,
          guestName: b.guestName,
          room: rooms.find(r => r.id === b.roomId)?.name || '',
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          remaining,
          daysUntilCheckIn: differenceInDays(checkIn, today),
          daysUntilCheckOut: differenceInDays(checkOut, today),
          daysSinceCheckout: differenceInDays(today, checkOut),
        };
      })
      .filter((a): a is BalanceAlert => a != null)
      .sort((a, b) => {
        const aInHouse = a.daysUntilCheckIn <= 0;
        const bInHouse = b.daysUntilCheckIn <= 0;
        if (aInHouse !== bInHouse) return aInHouse ? -1 : 1;
        if (aInHouse) return a.daysUntilCheckOut - b.daysUntilCheckOut;
        return a.daysUntilCheckIn - b.daysUntilCheckIn;
      });
  }, [activeBookings, rooms]);

  /** Red — balance still owed after checkout day. */
  const postDepartureBalanceAlerts = useMemo((): BalanceAlert[] => {
    const today = startOfToday();

    return activeBookings
      .map(b => {
        const checkIn = startOfDay(parseISO(b.checkIn));
        const checkOut = startOfDay(parseISO(b.checkOut));
        const remaining = bookingRemaining(b);
        if (today < checkOut || remaining <= 0) return null;

        return {
          bookingId: b.id,
          guestName: b.guestName,
          room: rooms.find(r => r.id === b.roomId)?.name || '',
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          remaining,
          daysUntilCheckIn: differenceInDays(checkIn, today),
          daysUntilCheckOut: differenceInDays(checkOut, today),
          daysSinceCheckout: differenceInDays(today, checkOut),
        };
      })
      .filter((a): a is BalanceAlert => a != null)
      .sort((a, b) => b.daysSinceCheckout - a.daysSinceCheckout);
  }, [activeBookings, rooms]);

  const criticalCount = postDepartureBalanceAlerts.length;
  const totalCount = preDepartureBalanceAlerts.length + postDepartureBalanceAlerts.length;

  return { preDepartureBalanceAlerts, postDepartureBalanceAlerts, criticalCount, totalCount };
}
