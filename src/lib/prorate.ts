import { addDays, differenceInDays, endOfDay, parseISO, startOfDay } from 'date-fns';
import { calcTotalCommission, CommissionInput } from '@/lib/commission';
import { ConfigOption } from '@/types';

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface StayFinancials {
  price: number;
  extras?: { amount: number }[];
  deposit: number;
  paidLater1: number;
  paidLater2: number;
}

export interface ProratedStayAmounts {
  revenue: number;
  collected: number;
  remaining: number;
  ratio: number;
  overlapNights: number;
  totalNights: number;
}

/** Occupied nights are [checkIn, checkOut) — checkout day is not an occupied night. */
export function stayTotalNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, differenceInDays(parseISO(checkOut), parseISO(checkIn)));
}

export function stayOverlapsPeriod(
  checkIn: string,
  checkOut: string,
  periodStart: Date,
  periodEnd: Date
): boolean {
  if (!checkIn || !checkOut) return false;
  const inDate = startOfDay(parseISO(checkIn));
  const outDate = startOfDay(parseISO(checkOut));
  const pStart = startOfDay(periodStart);
  const pEnd = startOfDay(periodEnd);
  return inDate <= pEnd && outDate > pStart;
}

export function overlappingNights(
  checkIn: string,
  checkOut: string,
  periodStart: Date,
  periodEnd: Date
): number {
  if (!stayOverlapsPeriod(checkIn, checkOut, periodStart, periodEnd)) return 0;

  const inDate = startOfDay(parseISO(checkIn));
  const outDate = startOfDay(parseISO(checkOut));
  const pStart = startOfDay(periodStart);
  const pEnd = startOfDay(periodEnd);

  const overlapStart = inDate > pStart ? inDate : pStart;
  const periodEndExclusive = addDays(pEnd, 1);
  const overlapEndExclusive = outDate < periodEndExclusive ? outDate : periodEndExclusive;

  return Math.max(0, differenceInDays(overlapEndExclusive, overlapStart));
}

export function prorateRatio(
  checkIn: string,
  checkOut: string,
  periodStart: Date,
  periodEnd: Date
): number {
  const overlap = overlappingNights(checkIn, checkOut, periodStart, periodEnd);
  if (overlap === 0) return 0;
  const total = stayTotalNights(checkIn, checkOut);
  if (total === 0) return 1;
  return overlap / total;
}

export function prorateAmount(
  amount: number,
  checkIn: string,
  checkOut: string,
  periodStart: Date,
  periodEnd: Date
): number {
  return amount * prorateRatio(checkIn, checkOut, periodStart, periodEnd);
}

export function fullStayFinancials(financials: StayFinancials): ProratedStayAmounts {
  const extrasTotal = (financials.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
  const revenue = (financials.price || 0) + extrasTotal;
  const collected =
    (financials.deposit || 0) + (financials.paidLater1 || 0) + (financials.paidLater2 || 0);
  return {
    revenue,
    collected,
    remaining: Math.max(0, revenue - collected),
    ratio: 1,
    overlapNights: 0,
    totalNights: 0,
  };
}

export function prorateStayFinancials(
  checkIn: string,
  checkOut: string,
  periodStart: Date,
  periodEnd: Date,
  financials: StayFinancials
): ProratedStayAmounts {
  const ratio = prorateRatio(checkIn, checkOut, periodStart, periodEnd);
  const full = fullStayFinancials(financials);
  return {
    revenue: full.revenue * ratio,
    collected: full.collected * ratio,
    remaining: Math.max(0, full.revenue * ratio - full.collected * ratio),
    ratio,
    overlapNights: overlappingNights(checkIn, checkOut, periodStart, periodEnd),
    totalNights: stayTotalNights(checkIn, checkOut),
  };
}

export function resolveStayFinancials(
  checkIn: string,
  checkOut: string,
  period: PeriodRange | null,
  financials: StayFinancials
): ProratedStayAmounts {
  if (!period) return fullStayFinancials(financials);
  return prorateStayFinancials(checkIn, checkOut, period.start, period.end, financials);
}

export function proratedCommission(
  input: CommissionInput,
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[],
  ratio: number
): { booking: number; payment: number; total: number } {
  const full = calcTotalCommission(input, bookingChannels, paymentChannels);
  return {
    booking: full.booking * ratio,
    payment: full.payment * ratio,
    total: full.total * ratio,
  };
}

export function stayIncludedInPeriod(
  checkIn: string,
  checkOut: string,
  period: PeriodRange | null
): boolean {
  if (!period) return true;
  return stayOverlapsPeriod(checkIn, checkOut, period.start, period.end);
}
