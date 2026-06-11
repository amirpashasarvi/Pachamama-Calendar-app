import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, differenceInDays(parseISO(checkOut), parseISO(checkIn)));
}

/** True when two inclusive date ranges share at least one day (ISO yyyy-MM-dd strings). */
export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

interface PeriodRecord {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface PeriodOverlapOptions {
  retreats: PeriodRecord[];
  venueHires: PeriodRecord[];
  excludeRetreatId?: string;
  excludeVenueHireId?: string;
  /** Other date ranges in the same form (e.g. multiple retreat runs). */
  siblingRuns?: { startDate: string; endDate: string }[];
  excludeSiblingIndex?: number;
}

export function findPeriodOverlapError(
  startDate: string,
  endDate: string,
  opts: PeriodOverlapOptions
): string | null {
  if (!startDate || !endDate) return null;

  for (const r of opts.retreats) {
    if (opts.excludeRetreatId && r.id === opts.excludeRetreatId) continue;
    if (periodsOverlap(startDate, endDate, r.startDate, r.endDate)) {
      return `Overlaps with Retreat: ${r.name} (${r.startDate} to ${r.endDate})`;
    }
  }

  for (const vh of opts.venueHires) {
    if (opts.excludeVenueHireId && vh.id === opts.excludeVenueHireId) continue;
    if (periodsOverlap(startDate, endDate, vh.startDate, vh.endDate)) {
      return `Overlaps with Venue Hire: ${vh.name} (${vh.startDate} to ${vh.endDate})`;
    }
  }

  if (opts.siblingRuns) {
    for (let i = 0; i < opts.siblingRuns.length; i++) {
      if (opts.excludeSiblingIndex === i) continue;
      const sib = opts.siblingRuns[i];
      if (!sib.startDate || !sib.endDate) continue;
      if (periodsOverlap(startDate, endDate, sib.startDate, sib.endDate)) {
        return `Overlaps with another run in this form (${sib.startDate} to ${sib.endDate})`;
      }
    }
  }

  return null;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}
