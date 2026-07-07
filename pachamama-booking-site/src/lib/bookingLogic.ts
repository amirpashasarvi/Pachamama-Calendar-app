import { parseISO, differenceInCalendarDays, getDay } from 'date-fns';
import type { AccommodationPricing, SeasonalRate, DayOfWeek, Booking, Room } from '@/types';

const DAY_MAP: DayOfWeek[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function nightCount(checkIn: string, checkOut: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
}

export function rateAppliesOnDate(rate: SeasonalRate, dateStr: string): boolean {
  const d = parseISO(dateStr);
  if (dateStr < rate.startDate || dateStr >= rate.endDate) return false;
  if (rate.applyDays.length === 0) return true;
  return rate.applyDays.includes(DAY_MAP[getDay(d)]);
}

export function nightlyRateForDate(
  pricing: AccommodationPricing,
  guestCount: number,
  dateStr: string,
  seasonalRates: SeasonalRate[],
): number {
  let effective = pricing;
  for (const rate of seasonalRates) {
    if (!rateAppliesOnDate(rate, dateStr)) continue;
    const override = rate.overrides[pricing.id];
    if (override) {
      effective = { ...pricing, ...override, id: pricing.id, label: pricing.label, publicName: pricing.publicName, maxGuests: pricing.maxGuests };
    }
  }
  if (effective.pricingMode === 'fixed') return effective.fixedPrice ?? 0;
  const key = String(Math.min(guestCount, effective.maxGuests));
  return effective.perGuestPrices?.[key] ?? effective.perGuestPrices?.[String(effective.maxGuests)] ?? 0;
}

export function totalStayPrice(
  pricing: AccommodationPricing,
  guestCount: number,
  checkIn: string,
  checkOut: string,
  seasonalRates: SeasonalRate[],
): number {
  const nights = nightCount(checkIn, checkOut);
  if (nights === 0) return 0;
  let total = 0;
  const start = parseISO(checkIn);
  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    total += nightlyRateForDate(pricing, guestCount, dateStr, seasonalRates);
  }
  return total;
}

export function findAvailableRoom(
  roomIds: string[],
  bookings: Booking[],
  checkIn: string,
  checkOut: string,
): string | null {
  const busy = new Set(
    bookings
      .filter(b => !b.deletedAt && b.lifecycleStatus !== 'cancelled' && datesOverlap(b.checkIn, b.checkOut, checkIn, checkOut))
      .map(b => b.roomId),
  );
  return roomIds.find(id => !busy.has(id)) ?? null;
}

export function groupsForForm(rooms: Room[], accommodationIds: string[], pricing: Map<string, AccommodationPricing>) {
  const result: { anchorId: string; label: string; rooms: Room[]; pricing: AccommodationPricing | undefined }[] = [];
  for (const anchorId of accommodationIds) {
    const anchorRoom = rooms.find(r => r.id === anchorId);
    if (!anchorRoom) continue;
    const members = anchorRoom.bookingGroup
      ? rooms.filter(r => r.bookingGroup === anchorRoom.bookingGroup)
      : [anchorRoom];
    result.push({
      anchorId,
      label: pricing.get(anchorId)?.publicName ?? anchorRoom.bookingGroup ?? anchorRoom.name,
      rooms: members,
      pricing: pricing.get(anchorId),
    });
  }
  return result;
}

export function validateStay(form: { minNights: number; maxNights: number; minAdvanceDays: number; maxAdvanceDays: number; checkInDays: DayOfWeek[]; checkOutDays: DayOfWeek[] }, checkIn: string, checkOut: string): string | null {
  const nights = nightCount(checkIn, checkOut);
  if (nights < form.minNights) return `Minimum stay is ${form.minNights} nights.`;
  if (nights > form.maxNights) return `Maximum stay is ${form.maxNights} nights.`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ci = parseISO(checkIn);
  const advance = differenceInCalendarDays(ci, today);
  if (advance < form.minAdvanceDays) return `Book at least ${form.minAdvanceDays} day(s) in advance.`;
  if (advance > form.maxAdvanceDays) return `Cannot book more than ${form.maxAdvanceDays} days in advance.`;
  if (form.checkInDays.length > 0 && !form.checkInDays.includes(DAY_MAP[getDay(ci)])) {
    return 'Check-in is not allowed on this day of the week.';
  }
  const co = parseISO(checkOut);
  if (form.checkOutDays.length > 0 && !form.checkOutDays.includes(DAY_MAP[getDay(co)])) {
    return 'Check-out is not allowed on this day of the week.';
  }
  return null;
}
