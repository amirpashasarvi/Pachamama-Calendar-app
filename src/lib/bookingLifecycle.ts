import { startOfDay, parseISO } from 'date-fns';
import { ConfigOption, LifecycleStatus } from '@/types';
import { calcTotalCommission, CommissionInput } from '@/lib/commission';
import {
  PeriodRange,
  prorateRatio,
  resolveStayFinancials,
  stayTotalNights,
  StayFinancials,
  ProratedStayAmounts,
} from '@/lib/prorate';

export type { LifecycleStatus };

export function getLifecycleStatus(item: { lifecycleStatus?: LifecycleStatus }): LifecycleStatus {
  return item.lifecycleStatus ?? 'active';
}

export function isActiveLifecycle(item: { lifecycleStatus?: LifecycleStatus; deletedAt?: string }): boolean {
  if (item.deletedAt) return false;
  return getLifecycleStatus(item) === 'active';
}

export function isCancelledLifecycle(item: { lifecycleStatus?: LifecycleStatus }): boolean {
  return getLifecycleStatus(item) === 'cancelled';
}

export function getCollectedAmount(financials: StayFinancials): number {
  return (financials.deposit || 0) + (financials.paidLater1 || 0) + (financials.paidLater2 || 0);
}

export function getFullRevenue(financials: StayFinancials): number {
  const extrasTotal = (financials.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
  return (financials.price || 0) + extrasTotal;
}

/** Cancelled bookings count in a period by original check-in date. */
export function checkInInPeriod(checkIn: string, periodStart: Date, periodEnd: Date): boolean {
  const d = startOfDay(parseISO(checkIn));
  const pStart = startOfDay(periodStart);
  const pEnd = startOfDay(periodEnd);
  return d >= pStart && d <= pEnd;
}

export function cancelledIncludedInPeriod(
  checkIn: string,
  period: PeriodRange | null
): boolean {
  if (!period) return true;
  return checkInInPeriod(checkIn, period.start, period.end);
}

/** Financial amounts for reports — active stays use pro-rata; cancelled uses retained payments on check-in date. */
export function resolveReportingFinancials(
  checkIn: string,
  checkOut: string,
  period: PeriodRange | null,
  financials: StayFinancials,
  lifecycleStatus?: LifecycleStatus
): ProratedStayAmounts {
  const totalNights = stayTotalNights(checkIn, checkOut);

  if (getLifecycleStatus({ lifecycleStatus }) === 'cancelled') {
    const collected = getCollectedAmount(financials);
    if (period && !checkInInPeriod(checkIn, period.start, period.end)) {
      return { revenue: 0, collected: 0, remaining: 0, ratio: 0, overlapNights: 0, totalNights };
    }
    return {
      revenue: collected,
      collected,
      remaining: 0,
      ratio: collected > 0 ? 1 : 0,
      overlapNights: 0,
      totalNights,
    };
  }

  return resolveStayFinancials(checkIn, checkOut, period, financials);
}

export function commissionForReporting(
  input: CommissionInput,
  collected: number,
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[],
  checkIn: string,
  checkOut: string,
  period: PeriodRange | null,
  lifecycleStatus?: LifecycleStatus
): { booking: number; payment: number; total: number } {
  if (getLifecycleStatus({ lifecycleStatus }) === 'cancelled') {
    if (period && !checkInInPeriod(checkIn, period.start, period.end)) {
      return { booking: 0, payment: 0, total: 0 };
    }
    if (collected <= 0) return { booking: 0, payment: 0, total: 0 };
    return calcTotalCommission(
      { ...input, price: collected, channelPaymentBasis: 'bookingPrice' },
      bookingChannels,
      paymentChannels
    );
  }

  const ratio = period
    ? prorateRatio(checkIn, checkOut, period.start, period.end)
    : 1;
  const full = calcTotalCommission(input, bookingChannels, paymentChannels);
  return {
    booking: full.booking * ratio,
    payment: full.payment * ratio,
    total: full.total * ratio,
  };
}
