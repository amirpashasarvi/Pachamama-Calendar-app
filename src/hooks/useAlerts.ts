import { useMemo } from 'react';
import { Booking, Room, HousekeepingRecord } from '@/types';
import { isActiveLifecycle } from '@/lib/bookingLifecycle';
import {
  isToday, isSameDay, addDays, startOfToday,
  parseISO, differenceInDays,
} from 'date-fns';
import { isBlockedBooking } from '@/lib/bookingBlock';

export interface ArrivalAlert {
  bookingId: string;
  guestName: string;
  room: string;
  checkIn: string;
  isToday: boolean;
  adults: number;
  kids: number;
  paymentStatus: string;
}

export interface BalanceAlert {
  bookingId: string;
  guestName: string;
  room: string;
  checkIn: string;
  remaining: number;
  paymentStatus: string;
  daysUntilCheckIn: number;
  isToday: boolean;
}

export interface NoteAlert {
  roomId: string;
  roomName: string;
  note: string;
  updatedAt: string; // ISO
  updatedByName?: string;
}

export interface CommentAlert {
  bookingId: string;
  guestName: string;
  room: string;
  checkIn: string;
  comment: string;
  updatedAt: string; // ISO
}

export function useAlerts(
  bookings: Booking[],
  rooms: Room[],
  housekeeping: HousekeepingRecord[] = [],
) {

  const activeBookings = useMemo(
    () => bookings.filter(b => isActiveLifecycle(b) && !isBlockedBooking(b)),
    [bookings],
  );

  const arrivalAlerts = useMemo((): ArrivalAlert[] => {
    const today = startOfToday();
    const tomorrow = addDays(today, 1);

    return activeBookings
      .filter(b => isToday(parseISO(b.checkIn)) || isSameDay(parseISO(b.checkIn), tomorrow))
      .map(b => ({
        bookingId: b.id,
        guestName: b.guestName,
        room: rooms.find(r => r.id === b.roomId)?.name || '',
        checkIn: b.checkIn,
        isToday: isToday(parseISO(b.checkIn)),
        adults: b.adults || 0,
        kids: b.kids || 0,
        paymentStatus: b.status,
      }))
      .sort((a, b) => (a.isToday === b.isToday ? 0 : a.isToday ? -1 : 1));
  }, [activeBookings, rooms]);

  const balanceAlerts = useMemo((): BalanceAlert[] => {
    const today = startOfToday();
    const in7days = addDays(today, 7);

    return activeBookings
      .filter(b => {
        const d = parseISO(b.checkIn);
        return d >= today && d <= in7days && b.status !== 'Paid';
      })
      .map(b => {
        const extrasTotal = (b.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
        const total = (b.price || 0) + extrasTotal;
        const collected = (b.deposit || 0) + (b.paidLater1 || 0) + (b.paidLater2 || 0);
        const checkInDate = parseISO(b.checkIn);
        const now = startOfToday();
        return {
          bookingId: b.id,
          guestName: b.guestName,
          room: rooms.find(r => r.id === b.roomId)?.name || '',
          checkIn: b.checkIn,
          remaining: total - collected,
          paymentStatus: b.status,
          daysUntilCheckIn: differenceInDays(checkInDate, now),
          isToday: isToday(checkInDate),
        };
      })
      .sort((a, b) => a.daysUntilCheckIn - b.daysUntilCheckIn);
  }, [activeBookings, rooms]);

  // Staff comments saved within the last 24 hours
  const commentAlerts = useMemo((): CommentAlert[] => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return activeBookings
      .filter(b => b.comments && b.commentsUpdatedAt && new Date(b.commentsUpdatedAt).getTime() > cutoff)
      .map(b => ({
        bookingId: b.id,
        guestName: b.guestName,
        room: rooms.find(r => r.id === b.roomId)?.name || '',
        checkIn: b.checkIn,
        comment: b.comments,
        updatedAt: b.commentsUpdatedAt!,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [activeBookings, rooms]);

  // Notes added/updated within the last 24 hours
  const noteAlerts = useMemo((): NoteAlert[] => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return housekeeping
      .filter(h => h.notes && h.notesUpdatedAt && new Date(h.notesUpdatedAt).getTime() > cutoff)
      .map(h => ({
        roomId: h.roomId,
        roomName: rooms.find(r => r.id === h.roomId)?.name || h.roomId,
        note: h.notes!,
        updatedAt: h.notesUpdatedAt!,
        updatedByName: h.history?.slice().reverse().find(e => e.action === 'Marked cleaned' || e.action === 'Reset to dirty' || e.action === 'Marked ready')?.userName,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [housekeeping, rooms]);

  // Badge count: today's arrivals + today's unpaid balances (deduped by booking ID)
  const criticalCount = useMemo(() => {
    const ids = new Set([
      ...arrivalAlerts.filter(a => a.isToday).map(a => a.bookingId),
      ...balanceAlerts.filter(a => a.isToday && a.paymentStatus === 'Unpaid').map(a => a.bookingId),
    ]);
    return ids.size;
  }, [arrivalAlerts, balanceAlerts]);

  const totalCount = arrivalAlerts.length + balanceAlerts.length + noteAlerts.length + commentAlerts.length;

  return { arrivalAlerts, balanceAlerts, noteAlerts, commentAlerts, criticalCount, totalCount };
}
