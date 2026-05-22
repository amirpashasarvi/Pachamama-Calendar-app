import { useMemo } from 'react';
import { parseISO, differenceInDays, isBefore, isAfter, subDays, startOfToday } from 'date-fns';
import { Booking, VenueHire, Room, ConfigOption } from '@/types';

export type DashboardPeriod = 'all' | '90d' | '12m' | 'upcoming';

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

export interface GlobalStats {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  totalCommissions: number;
  bookingCount: number;
  unpaidCount: number;
  futureOutstanding: number;
  revenueByType: { type: string; revenue: number; count: number }[];
  topChannels: { name: string; revenue: number; count: number }[];
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

// ── Pure helpers ──────────────────────────────────────────────────────────────

function calcNights(checkIn: string, checkOut: string): number {
  try {
    return Math.max(0, differenceInDays(parseISO(checkOut), parseISO(checkIn)));
  } catch {
    return 0;
  }
}

function bookingRevenue(b: Booking): number {
  return (b.price || 0) + (b.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
}

function bookingCollected(b: Booking): number {
  return (b.deposit || 0) + (b.paidLater1 || 0) + (b.paidLater2 || 0);
}

function vhRevenue(vh: VenueHire): number {
  return (vh.bookingPrice || 0) + (vh.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
}

function vhCollected(vh: VenueHire): number {
  return (vh.deposit || 0) + (vh.paidLater1 || 0) + (vh.paidLater2 || 0);
}

function bookingCommission(b: Booking, channels: ConfigOption[]): number {
  const ch = channels.find(c => c.name === b.bookingChannel);
  if (!ch?.commission) return 0;
  const base = b.channelPaymentBasis === 'custom'
    ? (b.commissionCustomAmount ?? 0)
    : b.channelPaymentBasis === 'bookingPrice'
      ? (b.price || 0)
      : (b.deposit || 0);
  return (base * ch.commission) / 100;
}

function inPeriod(dateStr: string, period: DashboardPeriod, today: Date): boolean {
  try {
    const d = parseISO(dateStr);
    if (period === 'all') return true;
    if (period === 'upcoming') return !isBefore(d, today);
    if (period === '90d') return isAfter(d, subDays(today, 90));
    if (period === '12m') return isAfter(d, subDays(today, 365));
    return true;
  } catch {
    return false;
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useDashboardStats(
  bookings: Booking[],
  venueHires: VenueHire[],
  rooms: Room[],
  bookingChannels: ConfigOption[],
  period: DashboardPeriod
) {
  const today = startOfToday();
  const roomName = (id: string) => rooms.find(r => r.id === id)?.name ?? 'Unknown';

  const filteredBookings = useMemo(
    () => bookings.filter(b => inPeriod(b.checkIn, period, today)),
    [bookings, period]
  );

  const filteredVH = useMemo(
    () => venueHires.filter(vh => inPeriod(vh.startDate, period, today)),
    [venueHires, period]
  );

  // ── Global ───────────────────────────────────────────────────────────────────
  const global = useMemo((): GlobalStats => {
    let totalRevenue = 0, totalCollected = 0, totalCommissions = 0, unpaidCount = 0;
    const byType: Record<string, { revenue: number; count: number }> = {};
    const byChannel: Record<string, { revenue: number; count: number }> = {};

    for (const b of filteredBookings) {
      const rev = bookingRevenue(b);
      const col = bookingCollected(b);
      totalRevenue += rev;
      totalCollected += col;
      totalCommissions += bookingCommission(b, bookingChannels);
      if (col === 0 && rev > 0) unpaidCount++;
      const t = b.type || 'Other';
      byType[t] = { revenue: (byType[t]?.revenue ?? 0) + rev, count: (byType[t]?.count ?? 0) + 1 };
      const ch = b.bookingChannel || 'Direct';
      byChannel[ch] = { revenue: (byChannel[ch]?.revenue ?? 0) + rev, count: (byChannel[ch]?.count ?? 0) + 1 };
    }

    for (const vh of filteredVH) {
      const rev = vhRevenue(vh);
      const col = vhCollected(vh);
      totalRevenue += rev;
      totalCollected += col;
      if (col === 0 && rev > 0) unpaidCount++;
      byType['Venue Hire'] = {
        revenue: (byType['Venue Hire']?.revenue ?? 0) + rev,
        count: (byType['Venue Hire']?.count ?? 0) + 1,
      };
    }

    // Future outstanding — always computed from all data, regardless of period
    let futureOutstanding = 0;
    for (const b of bookings) {
      if (!isBefore(parseISO(b.checkIn), today)) {
        futureOutstanding += Math.max(0, bookingRevenue(b) - bookingCollected(b));
      }
    }
    for (const vh of venueHires) {
      if (!isBefore(parseISO(vh.startDate), today)) {
        futureOutstanding += Math.max(0, vhRevenue(vh) - vhCollected(vh));
      }
    }

    return {
      totalRevenue,
      totalCollected,
      totalOutstanding: Math.max(0, totalRevenue - totalCollected),
      totalCommissions,
      bookingCount: filteredBookings.length + filteredVH.length,
      unpaidCount,
      futureOutstanding,
      revenueByType: Object.entries(byType)
        .map(([type, d]) => ({ type, ...d }))
        .sort((a, b) => b.revenue - a.revenue),
      topChannels: Object.entries(byChannel)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    };
  }, [filteredBookings, filteredVH, bookings, venueHires, bookingChannels]);

  // ── Retreats ─────────────────────────────────────────────────────────────────
  const retreats = useMemo((): RetreatStats => {
    const rb = filteredBookings.filter(b => b.type?.toLowerCase() === 'retreat');
    let totalRevenue = 0, totalCollected = 0, totalGuests = 0, totalNights = 0;
    const channelCount: Record<string, number> = {};

    for (const b of rb) {
      const rev = bookingRevenue(b);
      totalRevenue += rev;
      totalCollected += bookingCollected(b);
      totalGuests += (b.adults || 0) + (b.kids || 0);
      totalNights += calcNights(b.checkIn, b.checkOut);
      const ch = b.bookingChannel || 'Direct';
      channelCount[ch] = (channelCount[ch] ?? 0) + 1;
    }

    const upcoming: UpcomingItem[] = bookings
      .filter(b => b.type?.toLowerCase() === 'retreat' && !isBefore(parseISO(b.checkIn), today))
      .map(b => ({
        id: b.id, name: b.guestName, roomName: roomName(b.roomId),
        checkIn: b.checkIn, checkOut: b.checkOut,
        nights: calcNights(b.checkIn, b.checkOut),
        revenue: bookingRevenue(b),
        remaining: Math.max(0, bookingRevenue(b) - bookingCollected(b)),
      }))
      .filter(x => x.remaining > 0)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
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
  }, [filteredBookings, bookings]);

  // ── Coliving ─────────────────────────────────────────────────────────────────
  const coliving = useMemo((): ColivingStats => {
    const cb = filteredBookings.filter(b => b.type?.toLowerCase() === 'coliving');
    let totalRevenue = 0, totalCollected = 0, totalNights = 0;
    let rateSum = 0, rateCount = 0;
    const roomCount: Record<string, number> = {};

    for (const b of cb) {
      const rev = bookingRevenue(b);
      const n = calcNights(b.checkIn, b.checkOut);
      totalRevenue += rev;
      totalCollected += bookingCollected(b);
      totalNights += n;
      if (n > 0 && (b.price || 0) > 0) { rateSum += (b.price || 0) / n; rateCount++; }
      roomCount[b.roomId] = (roomCount[b.roomId] ?? 0) + 1;
    }

    const upcoming: UpcomingItem[] = bookings
      .filter(b => b.type?.toLowerCase() === 'coliving' && !isBefore(parseISO(b.checkIn), today))
      .map(b => ({
        id: b.id, name: b.guestName, roomName: roomName(b.roomId),
        checkIn: b.checkIn, checkOut: b.checkOut,
        nights: calcNights(b.checkIn, b.checkOut),
        revenue: bookingRevenue(b),
        remaining: Math.max(0, bookingRevenue(b) - bookingCollected(b)),
      }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
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
  }, [filteredBookings, bookings]);

  // ── Venue Hire ───────────────────────────────────────────────────────────────
  const venueHire = useMemo((): VenueHireStats => {
    let totalRevenue = 0, totalCollected = 0, totalDuration = 0, totalGuests = 0;

    for (const vh of filteredVH) {
      totalRevenue += vhRevenue(vh);
      totalCollected += vhCollected(vh);
      totalDuration += calcNights(vh.startDate, vh.endDate);
      totalGuests += vh.guestCount || 0;
    }

    const upcoming: UpcomingItem[] = venueHires
      .filter(vh => !isBefore(parseISO(vh.startDate), today))
      .map(vh => ({
        id: vh.id, name: vh.name || vh.organizer, roomName: 'Full property',
        checkIn: vh.startDate, checkOut: vh.endDate,
        nights: calcNights(vh.startDate, vh.endDate),
        revenue: vhRevenue(vh),
        remaining: Math.max(0, vhRevenue(vh) - vhCollected(vh)),
      }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
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
  }, [filteredVH, venueHires]);

  // ── Home Exchange ────────────────────────────────────────────────────────────
  const homeExchange = useMemo((): HomeExchangeStats => {
    const hb = filteredBookings.filter(b => b.type?.toLowerCase().includes('exchange'));
    let totalNights = 0;
    const roomCount: Record<string, number> = {};

    for (const b of hb) {
      totalNights += calcNights(b.checkIn, b.checkOut);
      roomCount[b.roomId] = (roomCount[b.roomId] ?? 0) + 1;
    }

    const upcoming: UpcomingItem[] = bookings
      .filter(b => b.type?.toLowerCase().includes('exchange') && !isBefore(parseISO(b.checkIn), today))
      .map(b => ({
        id: b.id, name: b.guestName, roomName: roomName(b.roomId),
        checkIn: b.checkIn, checkOut: b.checkOut,
        nights: calcNights(b.checkIn, b.checkOut),
        revenue: 0, remaining: 0,
      }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
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
  }, [filteredBookings, bookings, coliving.avgNightlyRate]);

  return { global, retreats, coliving, venueHire, homeExchange };
}
