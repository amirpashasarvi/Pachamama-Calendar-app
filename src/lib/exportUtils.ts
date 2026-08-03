import { format, parseISO } from 'date-fns';
import { Booking, VenueHire, Room, ConfigOption } from '@/types';
import {
  PeriodRange,
  stayTotalNights,
} from '@/lib/prorate';
import {
  resolveReportingFinancials,
  commissionForReporting,
  getCollectedAmount,
  getLifecycleStatus,
} from '@/lib/bookingLifecycle';
import {
  bookingBasisLabel,
  paymentBasisLabel,
  commissionInputFromRecord,
  resolveBookingChannelBasis,
  resolvePaymentChannelBasis,
} from '@/lib/commission';
import { LifecycleStatus } from '@/types';

// Wrap a field in quotes if it contains commas, quotes, or newlines
function escapeField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows.map(row => row.map(escapeField).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  try { return format(parseISO(iso), 'dd/MM/yyyy'); }
  catch { return iso ?? ''; }
}

function lifecycleLabel(status?: LifecycleStatus): string {
  return getLifecycleStatus({ lifecycleStatus: status }) === 'cancelled' ? 'Cancelled' : 'Active';
}

function displayChannel(name: string | undefined): string {
  return name || 'Direct';
}

function bookingFinancials(b: Booking) {
  return {
    price: b.price || 0,
    extras: b.extras || [],
    deposit: b.deposit || 0,
    payments: b.payments,
    paidLater1: b.paidLater1 || 0,
    paidLater2: b.paidLater2 || 0,
  };
}

function venueFinancials(v: VenueHire) {
  return {
    price: v.bookingPrice || 0,
    extras: v.extras || [],
    deposit: v.deposit || 0,
    paidLater1: v.paidLater1 || 0,
    paidLater2: v.paidLater2 || 0,
  };
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export function exportBookingsToCSV(
  bookings: Booking[],
  rooms: Room[],
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[],
  period?: PeriodRange
): void {
  const headers = [
    'Guest Name', 'Additional Names', 'Type',
    'Check In', 'Check Out', 'Nights', 'Nights in Period',
    'Room', 'Adults', 'Kids', 'Total Guests',
    'Price (€)', 'Deposit (€)', 'Paid Later 1 (€)', 'Paid Later 2 (€)', 'Extras (€)',
    'Total (€)', 'Collected (€)', 'Remaining (€)', 'Commission (€)',
    'Lifecycle', 'Status', 'Booking Channel', 'Payment Channel', 'Booking Basis', 'Payment Basis',
    'Dietary', 'Bed Setting', 'Source', 'Notes', 'Created At',
  ];

  const rows = bookings.map(b => {
    const financials = bookingFinancials(b);
    const amounts = resolveReportingFinancials(b.checkIn, b.checkOut, period ?? null, financials, b.lifecycleStatus);
    const collected = getCollectedAmount(financials);
    const comm = commissionForReporting(
      commissionInputFromRecord(b),
      collected,
      bookingChannels,
      paymentChannels,
      b.checkIn,
      b.checkOut,
      period ?? null,
      b.lifecycleStatus
    );
    const room = rooms.find(r => r.id === b.roomId)?.name || '';
    const fullTotal = (b.price || 0) + (b.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
    const status = b.lifecycleStatus === 'cancelled'
      ? 'Cancelled'
      : amounts.remaining <= 0 && fullTotal > 0 ? 'Paid'
        : collected > 0 ? 'Partial' : 'Unpaid';
    const extrasTotal = (b.extras || []).reduce((s, e) => s + (e.amount || 0), 0);

    return [
      b.guestName, b.additionalNames, b.type,
      fmtDate(b.checkIn), fmtDate(b.checkOut),
      stayTotalNights(b.checkIn, b.checkOut),
      amounts.overlapNights,
      room, b.adults, b.kids, b.totalGuests,
      (b.price || 0).toFixed(2), (b.deposit || 0).toFixed(2),
      (b.paidLater1 || 0).toFixed(2), (b.paidLater2 || 0).toFixed(2),
      extrasTotal.toFixed(2),
      fullTotal.toFixed(2), collected.toFixed(2),
      b.lifecycleStatus === 'cancelled' ? '0.00' : Math.max(0, fullTotal - collected).toFixed(2),
      comm.total.toFixed(2),
      lifecycleLabel(b.lifecycleStatus),
      status,
      displayChannel(b.bookingChannel), displayChannel(b.paymentChannel),
      bookingBasisLabel(resolveBookingChannelBasis(commissionInputFromRecord(b))),
      paymentBasisLabel(resolvePaymentChannelBasis(commissionInputFromRecord(b))),
      b.dietary, b.bedSetting, b.source, b.notes,
      fmtDate(b.createdAt),
    ];
  });

  downloadCSV(`bookings_${format(new Date(), 'yyyy-MM-dd')}.csv`, [headers, ...rows]);
}

// ── Venue Hires ───────────────────────────────────────────────────────────────

export function exportVenueHiresToCSV(
  venueHires: VenueHire[],
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[],
  period?: PeriodRange
): void {
  const headers = [
    'Event Name', 'Organizer', 'Start Date', 'End Date', 'Days', 'Days in Period', 'Guests',
    'Price (€)', 'Extras (€)', 'Total (€)',
    'Deposit (€)', 'Paid Later 1 (€)', 'Paid Later 2 (€)',
    'Collected (€)', 'Remaining (€)', 'Commission (€)',
    'Lifecycle', 'Status', 'Booking Channel', 'Payment Channel', 'Booking Basis', 'Payment Basis', 'Notes', 'Created At',
  ];

  const rows = venueHires.map(v => {
    const financials = venueFinancials(v);
    const amounts = resolveReportingFinancials(v.startDate, v.endDate, period ?? null, financials, v.lifecycleStatus);
    const collected = getCollectedAmount(financials);
    const comm = commissionForReporting(
      commissionInputFromRecord(v),
      collected,
      bookingChannels,
      paymentChannels,
      v.startDate,
      v.endDate,
      period ?? null,
      v.lifecycleStatus
    );
    const extrasTotal = (v.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
    const fullTotal = (v.bookingPrice || 0) + extrasTotal;
    const status = v.lifecycleStatus === 'cancelled'
      ? 'Cancelled'
      : collected >= fullTotal && fullTotal > 0 ? 'Paid'
        : collected > 0 ? 'Partial' : 'Unpaid';
    const commInput = commissionInputFromRecord(v);

    return [
      v.name, v.organizer,
      fmtDate(v.startDate), fmtDate(v.endDate),
      stayTotalNights(v.startDate, v.endDate),
      amounts.overlapNights,
      v.guestCount,
      (v.bookingPrice || 0).toFixed(2), extrasTotal.toFixed(2), fullTotal.toFixed(2),
      (v.deposit || 0).toFixed(2), (v.paidLater1 || 0).toFixed(2), (v.paidLater2 || 0).toFixed(2),
      collected.toFixed(2),
      v.lifecycleStatus === 'cancelled' ? '0.00' : Math.max(0, fullTotal - collected).toFixed(2),
      comm.total.toFixed(2),
      lifecycleLabel(v.lifecycleStatus),
      status, displayChannel(v.bookingChannel), displayChannel(v.paymentChannel),
      bookingBasisLabel(resolveBookingChannelBasis(commInput)),
      paymentBasisLabel(resolvePaymentChannelBasis(commInput)),
      v.notes, fmtDate(v.createdAt),
    ];
  });

  downloadCSV(`venue_hires_${format(new Date(), 'yyyy-MM-dd')}.csv`, [headers, ...rows]);
}

// ── Financial Summary (combined, sorted by date) ──────────────────────────────

export function exportFinancialSummaryToCSV(
  bookings: Booking[],
  venueHires: VenueHire[],
  rooms: Room[],
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[],
  period?: PeriodRange
): void {
  const headers = [
    'Record Type', 'Name / Guest', 'Booking Type',
    'Start Date', 'End Date', 'Nights / Days', 'Nights in Period',
    'Room / Organizer', 'Revenue (€)', 'Collected (€)', 'Remaining (€)',
    'Commission (€)', 'Lifecycle', 'Status', 'Booking Channel', 'Payment Channel', 'Created At',
  ];

  const bookingRows = bookings.map(b => {
    const financials = bookingFinancials(b);
    const amounts = resolveReportingFinancials(b.checkIn, b.checkOut, period ?? null, financials, b.lifecycleStatus);
    const collected = getCollectedAmount(financials);
    const comm = commissionForReporting(
      commissionInputFromRecord(b),
      collected,
      bookingChannels,
      paymentChannels,
      b.checkIn,
      b.checkOut,
      period ?? null,
      b.lifecycleStatus
    );
    const room = rooms.find(r => r.id === b.roomId)?.name || '';
    const status = b.lifecycleStatus === 'cancelled' ? 'Cancelled'
      : amounts.remaining <= 0 && amounts.revenue > 0 ? 'Paid'
        : collected > 0 ? 'Partial' : 'Unpaid';
    return [
      'Booking', b.guestName, b.type,
      fmtDate(b.checkIn), fmtDate(b.checkOut),
      stayTotalNights(b.checkIn, b.checkOut),
      amounts.overlapNights,
      room, amounts.revenue.toFixed(2), amounts.collected.toFixed(2), amounts.remaining.toFixed(2),
      comm.total.toFixed(2), lifecycleLabel(b.lifecycleStatus), status,
      displayChannel(b.bookingChannel), displayChannel(b.paymentChannel),
      fmtDate(b.createdAt),
    ];
  });

  const venueRows = venueHires.map(v => {
    const financials = venueFinancials(v);
    const amounts = resolveReportingFinancials(v.startDate, v.endDate, period ?? null, financials, v.lifecycleStatus);
    const collected = getCollectedAmount(financials);
    const comm = commissionForReporting(
      commissionInputFromRecord(v),
      collected,
      bookingChannels,
      paymentChannels,
      v.startDate,
      v.endDate,
      period ?? null,
      v.lifecycleStatus
    );
    const status = v.lifecycleStatus === 'cancelled' ? 'Cancelled'
      : amounts.remaining <= 0 && amounts.revenue > 0 ? 'Paid'
        : collected > 0 ? 'Partial' : 'Unpaid';
    return [
      'Venue Hire', v.name, 'Venue Hire',
      fmtDate(v.startDate), fmtDate(v.endDate),
      stayTotalNights(v.startDate, v.endDate),
      amounts.overlapNights,
      v.organizer, amounts.revenue.toFixed(2), amounts.collected.toFixed(2), amounts.remaining.toFixed(2),
      comm.total.toFixed(2), lifecycleLabel(v.lifecycleStatus), status,
      displayChannel(v.bookingChannel), displayChannel(v.paymentChannel),
      fmtDate(v.createdAt),
    ];
  });

  const allRows = [...bookingRows, ...venueRows].sort((a, b) =>
    String(a[3]).localeCompare(String(b[3]))
  );

  downloadCSV(`financial_summary_${format(new Date(), 'yyyy-MM-dd')}.csv`, [headers, ...allRows]);
}
