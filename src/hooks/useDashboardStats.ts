import { useMemo } from 'react';
import { parseISO, isBefore, startOfToday, endOfDay, startOfDay } from 'date-fns';
import { Booking, VenueHire, Room, ConfigOption } from '@/types';
import {
  PeriodRange,
  stayIncludedInPeriod,
  stayTotalNights,
} from '@/lib/prorate';
import { getCollectedAmount, asExtrasList } from '@/lib/bookingFinancials';
import {
  isActiveLifecycle,
  isCancelledLifecycle,
  cancelledIncludedInPeriod,
  resolveReportingFinancials,
  commissionForReporting,
} from '@/lib/bookingLifecycle';
import { commissionInputFromRecord } from '@/lib/commission';
import { isBlockedBooking } from '@/lib/bookingBlock';

export type { PeriodRange };

export interface UpcomingItem {
  id: string;
  name: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  revenue: number;
  remaining: number;
}

export interface OutstandingItem {
  id: string;
  name: string;
  isVenueHire: boolean;
  remaining: number;
  checkIn: string;
  checkOut: string;
}

export interface GlobalStats {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueOutstanding: number;
  expectedOutstanding: number;
  totalCommissions: number;
  bookingCommissions: number;
  paymentCommissions: number;
  bookingCount: number;
  unpaidCount: number;
  futureOutstanding: number;
  revenueByType: { type: string; revenue: number; count: number }[];
  topChannels: { name: string; revenue: number; count: number }[];
  outstandingItems: OutstandingItem[];
}

export interface RetreatStats {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  bookingCount: number;
  totalGuests: number;
  avgRevenue: number;
  avgNights: number;
  topChannel: string;
  upcoming: UpcomingItem[];
}

export interface ColivingStats {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  bookingCount: number;
  avgNights: number;
  avgNightlyRate: number;
  topRooms: { name: string; count: number }[];
  upcoming: UpcomingItem[];
}

export interface VenueHireStats {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  eventCount: number;
  avgDuration: number;
  avgGuestCount: number;
  upcoming: UpcomingItem[];
}

export interface HomeExchangeStats {
  stayCount: number;
  totalNights: number;
  avgNights: number;
  topRooms: { name: string; count: number }[];
  upcoming: UpcomingItem[];
  estimatedValue: number;
}

function safeParseISO(value: string | undefined | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function bookingFinancials(b: Booking) {
  return {
    price: b.price || 0,
    extras: asExtrasList(b.extras),
    deposit: b.deposit || 0,
    payments: b.payments,
    paidLater1: b.paidLater1 || 0,
    paidLater2: b.paidLater2 || 0,
  };
}

function vhFinancials(vh: VenueHire) {
  return {
    price: vh.bookingPrice || 0,
    extras: asExtrasList(vh.extras),
    deposit: vh.deposit || 0,
    paidLater1: vh.paidLater1 || 0,
    paidLater2: vh.paidLater2 || 0,
  };
}

function commissionInputFromBooking(b: Booking) {
  return commissionInputFromRecord(b);
}

function commissionInputFromVenueHire(vh: VenueHire) {
  return commissionInputFromRecord(vh);
}

export function useDashboardStats(
  bookings: Booking[],
  venueHires: VenueHire[],
  rooms: Room[],
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[],
  periodRange: PeriodRange | null,
) {
  const today = startOfToday();
  const roomName = (id: string) => rooms.find(r => r.id === id)?.name ?? 'Unknown';

  const activeBookings = useMemo(
    () => bookings.filter(b => isActiveLifecycle(b) && !isBlockedBooking(b)),
    [bookings]
  );

  const cancelledBookings = useMemo(
    () => bookings.filter(isCancelledLifecycle),
    [bookings]
  );

  const activeVenueHires = useMemo(
    () => venueHires.filter(isActiveLifecycle),
    [venueHires]
  );

  const cancelledVenueHires = useMemo(
    () => venueHires.filter(isCancelledLifecycle),
    [venueHires]
  );

  const filteredBookings = useMemo(
    () => activeBookings.filter(b => stayIncludedInPeriod(b.checkIn, b.checkOut, periodRange)),
    [activeBookings, periodRange]
  );

  const filteredCancelledBookings = useMemo(
    () => cancelledBookings.filter(b => cancelledIncludedInPeriod(b.checkIn, periodRange)),
    [cancelledBookings, periodRange]
  );

  const filteredVH = useMemo(
    () => activeVenueHires.filter(vh => stayIncludedInPeriod(vh.startDate, vh.endDate, periodRange)),
    [activeVenueHires, periodRange]
  );

  const filteredCancelledVH = useMemo(
    () => cancelledVenueHires.filter(vh => cancelledIncludedInPeriod(vh.startDate, periodRange)),
    [cancelledVenueHires, periodRange]
  );

  const applyReporting = (
    checkIn: string,
    checkOut: string,
    financials: ReturnType<typeof bookingFinancials>,
    lifecycleStatus: Booking['lifecycleStatus'] | VenueHire['lifecycleStatus'],
    commissionInput: ReturnType<typeof commissionInputFromBooking>
  ) => {
    const amounts = resolveReportingFinancials(checkIn, checkOut, periodRange, financials, lifecycleStatus);
    const collected = getCollectedAmount(financials);
    const comm = commissionForReporting(
      commissionInput,
      collected,
      bookingChannels,
      paymentChannels,
      checkIn,
      checkOut,
      periodRange,
      lifecycleStatus
    );
    return { amounts, comm };
  };

  const global = useMemo((): GlobalStats => {
    let totalRevenue = 0, totalCollected = 0, totalCommissions = 0;
    let bookingCommissions = 0, paymentCommissions = 0;
    let overdueOutstanding = 0, expectedOutstanding = 0;
    let unpaidCount = 0;
    const outstandingItems: OutstandingItem[] = [];
    const byType: Record<string, { revenue: number; count: number }> = {};
    const byChannel: Record<string, { revenue: number; count: number }> = {};

    const accumulate = (
      id: string,
      name: string,
      isVenueHire: boolean,
      checkIn: string,
      checkOut: string,
      financials: ReturnType<typeof bookingFinancials>,
      lifecycleStatus: Booking['lifecycleStatus'] | VenueHire['lifecycleStatus'],
      commissionInput: ReturnType<typeof commissionInputFromBooking>,
      typeKey: string,
      channelKey?: string,
    ) => {
      const { amounts, comm } = applyReporting(
        checkIn, checkOut, financials, lifecycleStatus, commissionInput
      );
      totalRevenue += amounts.revenue;
      totalCollected += amounts.collected;
      totalCommissions += comm.total;
      bookingCommissions += comm.booking;
      paymentCommissions += comm.payment;
      if (amounts.collected === 0 && amounts.revenue > 0) unpaidCount++;

      if (!isCancelledLifecycle({ lifecycleStatus }) && amounts.remaining > 0) {
        outstandingItems.push({
          id,
          name,
          isVenueHire,
          remaining: amounts.remaining,
          checkIn,
          checkOut,
        });
        const checkoutDate = safeParseISO(checkOut);
        if (checkoutDate && isBefore(checkoutDate, today)) {
          overdueOutstanding += amounts.remaining;
        } else {
          expectedOutstanding += amounts.remaining;
        }
      }

      byType[typeKey] = {
        revenue: (byType[typeKey]?.revenue ?? 0) + amounts.revenue,
        count: (byType[typeKey]?.count ?? 0) + 1,
      };

      if (channelKey) {
        byChannel[channelKey] = {
          revenue: (byChannel[channelKey]?.revenue ?? 0) + amounts.revenue,
          count: (byChannel[channelKey]?.count ?? 0) + 1,
        };
      }
    };

    const safeAccumulate = (
      id: string,
      name: string,
      isVenueHire: boolean,
      checkIn: string,
      checkOut: string,
      financials: ReturnType<typeof bookingFinancials>,
      lifecycleStatus: Booking['lifecycleStatus'] | VenueHire['lifecycleStatus'],
      commissionInput: ReturnType<typeof commissionInputFromBooking>,
      typeKey: string,
      channelKey?: string,
    ) => {
      try {
        accumulate(id, name, isVenueHire, checkIn, checkOut, financials, lifecycleStatus, commissionInput, typeKey, channelKey);
      } catch (err) {
        console.error('Dashboard stats skipped record', { id, checkIn, checkOut, err });
      }
    };

    for (const b of filteredBookings) {
      safeAccumulate(
        b.id, b.guestName, false, b.checkIn, b.checkOut,
        bookingFinancials(b), b.lifecycleStatus,
        commissionInputFromBooking(b), b.type || 'Other', b.bookingChannel || 'Direct'
      );
    }

    for (const b of filteredCancelledBookings) {
      safeAccumulate(
        b.id, b.guestName, false, b.checkIn, b.checkOut,
        bookingFinancials(b), b.lifecycleStatus,
        commissionInputFromBooking(b), 'Cancelled'
      );
    }

    for (const vh of filteredVH) {
      safeAccumulate(
        vh.id, vh.organizer, true, vh.startDate, vh.endDate,
        vhFinancials(vh), vh.lifecycleStatus,
        commissionInputFromVenueHire(vh), 'Venue Hire'
      );
    }

    for (const vh of filteredCancelledVH) {
      safeAccumulate(
        vh.id, vh.organizer, true, vh.startDate, vh.endDate,
        vhFinancials(vh), vh.lifecycleStatus,
        commissionInputFromVenueHire(vh), 'Cancelled Venue Hire'
      );
    }

    outstandingItems.sort((a, b) => b.remaining - a.remaining);

    let futureOutstanding = 0;
    for (const b of activeBookings) {
      const checkInDate = safeParseISO(b.checkIn);
      if (checkInDate && !isBefore(checkInDate, today)) {
        const full = resolveReportingFinancials(b.checkIn, b.checkOut, null, bookingFinancials(b), b.lifecycleStatus);
        futureOutstanding += full.remaining;
      }
    }
    for (const vh of activeVenueHires) {
      const startDate = safeParseISO(vh.startDate);
      if (startDate && !isBefore(startDate, today)) {
        const full = resolveReportingFinancials(vh.startDate, vh.endDate, null, vhFinancials(vh), vh.lifecycleStatus);
        futureOutstanding += full.remaining;
      }
    }

    return {
      totalRevenue,
      totalCollected,
      totalOutstanding: Math.max(0, totalRevenue - totalCollected),
      overdueOutstanding,
      expectedOutstanding,
      totalCommissions,
      bookingCommissions,
      paymentCommissions,
      bookingCount: filteredBookings.length + filteredVH.length + filteredCancelledBookings.length + filteredCancelledVH.length,
      unpaidCount,
      futureOutstanding,
      revenueByType: Object.entries(byType)
        .map(([type, d]) => ({ type, ...d }))
        .sort((a, b) => b.revenue - a.revenue),
      topChannels: Object.entries(byChannel)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      outstandingItems,
    };
  }, [filteredBookings, filteredCancelledBookings, filteredVH, filteredCancelledVH, activeBookings, activeVenueHires, bookingChannels, paymentChannels, periodRange, today]);

  const retreats = useMemo((): RetreatStats => {
    const rb = filteredBookings.filter(b => b.type?.toLowerCase() === 'retreat');
    let totalRevenue = 0, totalCollected = 0, totalGuests = 0, totalNights = 0;
    const channelCount: Record<string, number> = {};

    for (const b of rb) {
      const amounts = resolveReportingFinancials(b.checkIn, b.checkOut, periodRange, bookingFinancials(b), b.lifecycleStatus);
      totalRevenue += amounts.revenue;
      totalCollected += amounts.collected;
      totalGuests += (b.adults || 0) + (b.kids || 0);
      totalNights += amounts.overlapNights || stayTotalNights(b.checkIn, b.checkOut);
      const ch = b.bookingChannel || 'Direct';
      channelCount[ch] = (channelCount[ch] ?? 0) + 1;
    }

    const upcoming: UpcomingItem[] = activeBookings
      .filter(b => b.type?.toLowerCase() === 'retreat' && safeParseISO(b.checkIn) && !isBefore(safeParseISO(b.checkIn)!, today))
      .map(b => {
        const full = resolveReportingFinancials(b.checkIn, b.checkOut, null, bookingFinancials(b), b.lifecycleStatus);
        return {
          id: b.id, name: b.guestName, roomName: roomName(b.roomId),
          checkIn: b.checkIn, checkOut: b.checkOut,
          nights: stayTotalNights(b.checkIn, b.checkOut),
          revenue: full.revenue,
          remaining: full.remaining,
        };
      })
      .filter(x => x.remaining > 0)
      .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''))
      .slice(0, 8);

    return {
      totalRevenue,
      totalCollected,
      totalOutstanding: Math.max(0, totalRevenue - totalCollected),
      bookingCount: rb.length,
      totalGuests,
      avgRevenue: rb.length ? totalRevenue / rb.length : 0,
      avgNights: rb.length ? totalNights / rb.length : 0,
      topChannel: Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      upcoming,
    };
  }, [filteredBookings, bookings, periodRange]);

  const coliving = useMemo((): ColivingStats => {
    const cb = filteredBookings.filter(b => b.type?.toLowerCase() === 'coliving');
    let totalRevenue = 0, totalCollected = 0, totalNights = 0;
    let rateSum = 0, rateCount = 0;
    const roomCount: Record<string, number> = {};

    for (const b of cb) {
      const amounts = resolveReportingFinancials(b.checkIn, b.checkOut, periodRange, bookingFinancials(b), b.lifecycleStatus);
      const n = stayTotalNights(b.checkIn, b.checkOut);
      totalRevenue += amounts.revenue;
      totalCollected += amounts.collected;
      totalNights += amounts.overlapNights || n;
      if (n > 0 && (b.price || 0) > 0) { rateSum += (b.price || 0) / n; rateCount++; }
      roomCount[b.roomId] = (roomCount[b.roomId] ?? 0) + 1;
    }

    const upcoming: UpcomingItem[] = activeBookings
      .filter(b => b.type?.toLowerCase() === 'coliving' && safeParseISO(b.checkIn) && !isBefore(safeParseISO(b.checkIn)!, today))
      .map(b => {
        const full = resolveReportingFinancials(b.checkIn, b.checkOut, null, bookingFinancials(b), b.lifecycleStatus);
        return {
          id: b.id, name: b.guestName, roomName: roomName(b.roomId),
          checkIn: b.checkIn, checkOut: b.checkOut,
          nights: stayTotalNights(b.checkIn, b.checkOut),
          revenue: full.revenue,
          remaining: full.remaining,
        };
      })
      .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''))
      .slice(0, 8);

    return {
      totalRevenue,
      totalCollected,
      totalOutstanding: Math.max(0, totalRevenue - totalCollected),
      bookingCount: cb.length,
      avgNights: cb.length ? totalNights / cb.length : 0,
      avgNightlyRate: rateCount ? rateSum / rateCount : 0,
      topRooms: Object.entries(roomCount)
        .map(([id, count]) => ({ name: roomName(id), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      upcoming,
    };
  }, [filteredBookings, bookings, periodRange]);

  const venueHire = useMemo((): VenueHireStats => {
    let totalRevenue = 0, totalCollected = 0, totalDuration = 0, totalGuests = 0;

    for (const vh of filteredVH) {
      const amounts = resolveReportingFinancials(vh.startDate, vh.endDate, periodRange, vhFinancials(vh), vh.lifecycleStatus);
      totalRevenue += amounts.revenue;
      totalCollected += amounts.collected;
      totalDuration += amounts.overlapNights || stayTotalNights(vh.startDate, vh.endDate);
      totalGuests += vh.guestCount || 0;
    }

    const upcoming: UpcomingItem[] = activeVenueHires
      .filter(vh => safeParseISO(vh.startDate) && !isBefore(safeParseISO(vh.startDate)!, today))
      .map(vh => {
        const full = resolveReportingFinancials(vh.startDate, vh.endDate, null, vhFinancials(vh), vh.lifecycleStatus);
        return {
          id: vh.id, name: vh.name || vh.organizer, roomName: 'Full property',
          checkIn: vh.startDate, checkOut: vh.endDate,
          nights: stayTotalNights(vh.startDate, vh.endDate),
          revenue: full.revenue,
          remaining: full.remaining,
        };
      })
      .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''))
      .slice(0, 8);

    return {
      totalRevenue,
      totalCollected,
      totalOutstanding: Math.max(0, totalRevenue - totalCollected),
      eventCount: filteredVH.length,
      avgDuration: filteredVH.length ? totalDuration / filteredVH.length : 0,
      avgGuestCount: filteredVH.length ? totalGuests / filteredVH.length : 0,
      upcoming,
    };
  }, [filteredVH, venueHires, periodRange]);

  const homeExchange = useMemo((): HomeExchangeStats => {
    const hb = filteredBookings.filter(b => b.type?.toLowerCase().includes('exchange'));
    let totalNights = 0;
    const roomCount: Record<string, number> = {};

    for (const b of hb) {
      const amounts = resolveReportingFinancials(b.checkIn, b.checkOut, periodRange, bookingFinancials(b), b.lifecycleStatus);
      totalNights += amounts.overlapNights || stayTotalNights(b.checkIn, b.checkOut);
      roomCount[b.roomId] = (roomCount[b.roomId] ?? 0) + 1;
    }

    const upcoming: UpcomingItem[] = activeBookings
      .filter(b => b.type?.toLowerCase().includes('exchange') && safeParseISO(b.checkIn) && !isBefore(safeParseISO(b.checkIn)!, today))
      .map(b => ({
        id: b.id, name: b.guestName, roomName: roomName(b.roomId),
        checkIn: b.checkIn, checkOut: b.checkOut,
        nights: stayTotalNights(b.checkIn, b.checkOut),
        revenue: 0, remaining: 0,
      }))
      .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''))
      .slice(0, 8);

    return {
      stayCount: hb.length,
      totalNights,
      avgNights: hb.length ? totalNights / hb.length : 0,
      topRooms: Object.entries(roomCount)
        .map(([id, count]) => ({ name: roomName(id), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      upcoming,
      estimatedValue: totalNights * coliving.avgNightlyRate,
    };
  }, [filteredBookings, bookings, coliving.avgNightlyRate, periodRange]);

  return { global, retreats, coliving, venueHire, homeExchange };
}
