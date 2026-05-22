import { format, differenceInDays, parseISO } from 'date-fns';
import { Booking, VenueHire, Room, ConfigOption } from '@/types';

// Wrap a field in quotes if it contains commas, quotes, or newlines
function escapeField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Trigger a UTF-8 CSV file download in the browser
// UTF-8 BOM (\uFEFF) ensures Excel opens the file with correct encoding
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

function calcNights(checkIn: string, checkOut: string): number {
  try { return Math.max(0, differenceInDays(parseISO(checkOut), parseISO(checkIn))); }
  catch { return 0; }
}

function calcCommission(
  price: number,
  deposit: number,
  channelName: string,
  paymentBasis: string,
  channels: ConfigOption[]
): number {
  const ch = channels.find(c => c.name === channelName);
  if (!ch?.commission) return 0;
  const base = paymentBasis === 'bookingPrice' ? price : deposit;
  return (base * ch.commission) / 100;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export function exportBookingsToCSV(
  bookings: Booking[],
  rooms: Room[],
  channels: ConfigOption[]
): void {
  const headers = [
    'Guest Name', 'Additional Names', 'Type',
    'Check In', 'Check Out', 'Nights',
    'Room', 'Adults', 'Kids', 'Total Guests',
    'Price (€)', 'Deposit (€)', 'Paid Later 1 (€)', 'Paid Later 2 (€)', 'Extras (€)',
    'Total (€)', 'Collected (€)', 'Remaining (€)', 'Commission (€)',
    'Status', 'Booking Channel', 'Payment Basis',
    'Dietary', 'Bed Setting', 'Source', 'Notes', 'Created At',
  ];

  const rows = bookings.map(b => {
    const extrasTotal = (b.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
    const total = (b.price || 0) + extrasTotal;
    const collected = (b.deposit || 0) + (b.paidLater1 || 0) + (b.paidLater2 || 0);
    const remaining = total - collected;
    const room = rooms.find(r => r.id === b.roomId)?.name || '';
    const commission = calcCommission(b.price || 0, b.deposit || 0, b.bookingChannel, b.channelPaymentBasis, channels);

    return [
      b.guestName, b.additionalNames, b.type,
      fmtDate(b.checkIn), fmtDate(b.checkOut), calcNights(b.checkIn, b.checkOut),
      room, b.adults, b.kids, b.totalGuests,
      (b.price || 0).toFixed(2), (b.deposit || 0).toFixed(2),
      (b.paidLater1 || 0).toFixed(2), (b.paidLater2 || 0).toFixed(2),
      extrasTotal.toFixed(2), total.toFixed(2),
      collected.toFixed(2), remaining.toFixed(2), commission.toFixed(2),
      b.status, b.bookingChannel,
      b.channelPaymentBasis === 'bookingPrice' ? 'Full Price' : 'Deposit Only',
      b.dietary, b.bedSetting, b.source, b.notes,
      fmtDate(b.createdAt),
    ];
  });

  downloadCSV(`bookings_${format(new Date(), 'yyyy-MM-dd')}.csv`, [headers, ...rows]);
}

// ── Venue Hires ───────────────────────────────────────────────────────────────

export function exportVenueHiresToCSV(
  venueHires: VenueHire[],
  channels: ConfigOption[]
): void {
  const headers = [
    'Event Name', 'Organizer', 'Start Date', 'End Date', 'Days', 'Guests',
    'Price (€)', 'Extras (€)', 'Total (€)',
    'Deposit (€)', 'Paid Later 1 (€)', 'Paid Later 2 (€)',
    'Collected (€)', 'Remaining (€)', 'Commission (€)',
    'Status', 'Booking Channel', 'Payment Basis', 'Notes', 'Created At',
  ];

  const rows = venueHires.map(v => {
    const extrasTotal = (v.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
    const total = (v.bookingPrice || 0) + extrasTotal;
    const collected = (v.deposit || 0) + (v.paidLater1 || 0) + (v.paidLater2 || 0);
    const remaining = total - collected;
    const commission = calcCommission(v.bookingPrice || 0, v.deposit || 0, v.bookingChannel, v.channelPaymentBasis, channels);
    const status = remaining <= 0 && total > 0 ? 'Paid' : collected > 0 ? 'Partial' : 'Unpaid';

    return [
      v.name, v.organizer,
      fmtDate(v.startDate), fmtDate(v.endDate), calcNights(v.startDate, v.endDate), v.guestCount,
      (v.bookingPrice || 0).toFixed(2), extrasTotal.toFixed(2), total.toFixed(2),
      (v.deposit || 0).toFixed(2), (v.paidLater1 || 0).toFixed(2), (v.paidLater2 || 0).toFixed(2),
      collected.toFixed(2), remaining.toFixed(2), commission.toFixed(2),
      status, v.bookingChannel,
      v.channelPaymentBasis === 'bookingPrice' ? 'Full Price' : 'Deposit Only',
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
  channels: ConfigOption[]
): void {
  const headers = [
    'Record Type', 'Name / Guest', 'Booking Type',
    'Start Date', 'End Date', 'Nights / Days',
    'Room / Organizer', 'Revenue (€)', 'Collected (€)', 'Remaining (€)',
    'Commission (€)', 'Status', 'Booking Channel', 'Created At',
  ];

  const bookingRows = bookings.map(b => {
    const extrasTotal = (b.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
    const total = (b.price || 0) + extrasTotal;
    const collected = (b.deposit || 0) + (b.paidLater1 || 0) + (b.paidLater2 || 0);
    const remaining = total - collected;
    const room = rooms.find(r => r.id === b.roomId)?.name || '';
    const commission = calcCommission(b.price || 0, b.deposit || 0, b.bookingChannel, b.channelPaymentBasis, channels);
    return [
      'Booking', b.guestName, b.type,
      fmtDate(b.checkIn), fmtDate(b.checkOut), calcNights(b.checkIn, b.checkOut),
      room, total.toFixed(2), collected.toFixed(2), remaining.toFixed(2),
      commission.toFixed(2), b.status, b.bookingChannel, fmtDate(b.createdAt),
    ];
  });

  const venueRows = venueHires.map(v => {
    const extrasTotal = (v.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
    const total = (v.bookingPrice || 0) + extrasTotal;
    const collected = (v.deposit || 0) + (v.paidLater1 || 0) + (v.paidLater2 || 0);
    const remaining = total - collected;
    const commission = calcCommission(v.bookingPrice || 0, v.deposit || 0, v.bookingChannel, v.channelPaymentBasis, channels);
    const status = remaining <= 0 && total > 0 ? 'Paid' : collected > 0 ? 'Partial' : 'Unpaid';
    return [
      'Venue Hire', v.name, 'Venue Hire',
      fmtDate(v.startDate), fmtDate(v.endDate), calcNights(v.startDate, v.endDate),
      v.organizer, total.toFixed(2), collected.toFixed(2), remaining.toFixed(2),
      commission.toFixed(2), status, v.bookingChannel, fmtDate(v.createdAt),
    ];
  });

  // Sort combined rows by start date ascending
  const allRows = [...bookingRows, ...venueRows].sort((a, b) =>
    String(a[3]).localeCompare(String(b[3]))
  );

  downloadCSV(`financial_summary_${format(new Date(), 'yyyy-MM-dd')}.csv`, [headers, ...allRows]);
}
