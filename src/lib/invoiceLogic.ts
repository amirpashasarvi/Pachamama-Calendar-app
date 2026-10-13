import { format, parseISO } from 'date-fns';
import { Booking, Invoice, InvoiceDiscount, InvoiceItem, InvoicePayment, InvoicePaymentStatus, InvoiceSourceType, Room, VenueHire } from '@/types';
import { calculateNights } from '@/lib/utils';
import { asExtrasList, getPaymentEntries } from '@/lib/bookingFinancials';
import {
  InvoicePaymentDefaults,
  resolveInvoicePaymentDefaults,
} from '@/lib/invoiceDetails';

export interface InvoiceSourceSnapshot {
  sourceType: InvoiceSourceType;
  sourceId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  typeLabel: string;
  checkIn: string;
  checkOut: string;
  roomName: string;
  nights: number;
  price: number;
  extras: { label: string; amount: number }[];
  deposit: number;
  laterPayments: number[];
}

export interface InvoiceTotals {
  itemGross: number[];
  itemDiscountAmounts: number[];
  itemTotals: number[];
  subtotal: number;
  invoiceDiscountAmount: number;
  total: number;
  paid: number;
  remaining: number;
  status: InvoicePaymentStatus;
}

export function newInvoiceId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Firestore may return arrays or map-like objects for `items`. */
export function normalizeInvoiceItems(items: unknown): InvoiceItem[] {
  if (Array.isArray(items)) return items as InvoiceItem[];
  if (items && typeof items === 'object') {
    return Object.values(items as Record<string, InvoiceItem>);
  }
  return [];
}

export function formatInvoiceDate(iso: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso.length === 10 ? iso : iso.slice(0, 10)), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

export function invoiceFilename(invoice: Pick<Invoice, 'invoiceNumber' | 'guestName'>): string {
  const name = (invoice.guestName || 'Guest')
    .trim()
    .replace(/[^\w]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'Guest';
  return `${name}_${invoice.invoiceNumber}.pdf`;
}

function hasDiscount(discount?: InvoiceDiscount | null): boolean {
  return !!discount && Number(discount.value) > 0;
}

export function discountAmountOn(base: number, discount?: InvoiceDiscount | null): number {
  if (!hasDiscount(discount) || base <= 0) return 0;
  const value = Number(discount!.value) || 0;
  if (discount!.kind === 'percent') {
    return Math.min(base, (base * value) / 100);
  }
  return Math.min(base, value);
}

/** Nights multiplier. Missing, zero, or invalid values count as 1 so older invoices stay unchanged. */
export function lineNights(item: Pick<InvoiceItem, 'nights'>): number {
  const n = Number(item.nights);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

export function invoiceShowsNights(items: unknown): boolean {
  return normalizeInvoiceItems(items).some(item => lineNights(item) !== 1);
}

export function lineGross(item: InvoiceItem): number {
  return (Number(item.quantity) || 0) * lineNights(item) * (Number(item.unitPrice) || 0);
}

export function lineDiscountAmount(item: InvoiceItem): number {
  return discountAmountOn(lineGross(item), item.discount);
}

export function lineTotal(item: InvoiceItem): number {
  return Math.max(0, lineGross(item) - lineDiscountAmount(item));
}

export function calculateInvoiceTotals(invoice: Pick<Invoice, 'items' | 'invoiceDiscount' | 'payments'>): InvoiceTotals {
  const items = normalizeInvoiceItems(invoice.items);
  const itemGross = items.map(lineGross);
  const itemDiscountAmounts = items.map(lineDiscountAmount);
  const itemTotals = items.map(lineTotal);
  const subtotal = itemTotals.reduce((sum, n) => sum + n, 0);
  const invoiceDiscountAmount = discountAmountOn(subtotal, invoice.invoiceDiscount);
  const total = Math.max(0, subtotal - invoiceDiscountAmount);
  const paid = (invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, total - paid);
  let status: InvoicePaymentStatus = 'UNPAID';
  if (remaining <= 0.005 && (total > 0 || paid > 0)) status = 'PAID';
  else if (paid > 0) status = 'PARTIALLY PAID';
  return {
    itemGross,
    itemDiscountAmounts,
    itemTotals,
    subtotal,
    invoiceDiscountAmount,
    total,
    paid,
    remaining,
    status,
  };
}

export function formatEuro(amount: number, showZero = true): string {
  if (!Number.isFinite(amount)) return '—';
  if (!showZero && amount === 0) return '—';
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `€ ${formatted}`;
}

export function formatDiscountDisplay(amount: number): string {
  if (!amount) return '—';
  return `- ${formatEuro(amount)}`;
}

export function formatItemDiscountLabel(item: InvoiceItem): string | null {
  const discount = item.discount;
  if (!hasDiscount(discount)) return null;
  if (lineDiscountAmount(item) <= 0) return null;
  const value = Number(discount!.value) || 0;
  if (discount!.kind === 'percent') {
    const pct = value % 1 === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
    return `${pct}% discount`;
  }
  return 'Discount';
}

export function formatItemDiscountAmount(item: InvoiceItem): string | null {
  const amount = lineDiscountAmount(item);
  if (amount <= 0) return null;
  return formatDiscountDisplay(amount);
}

function defaultDescription(snapshot: InvoiceSourceSnapshot): string {
  const from = formatInvoiceDate(snapshot.checkIn);
  const to = formatInvoiceDate(snapshot.checkOut);
  if (snapshot.sourceType === 'venueHire') {
    return `Venue hire from ${from} to ${to}`;
  }
  return `Booking from ${from} to ${to}`;
}

function accommodationDescription(snapshot: InvoiceSourceSnapshot): string {
  if (snapshot.sourceType === 'venueHire') {
    const nights = snapshot.nights;
    const event = snapshot.roomName || snapshot.typeLabel || 'Venue hire';
    if (nights > 0) return `${nights} ${nights === 1 ? 'day' : 'days'} · ${event}`;
    return event;
  }
  const nights = snapshot.nights;
  const room = snapshot.roomName || 'accommodation';
  if (nights > 0) return `${nights} ${nights === 1 ? 'night' : 'nights'} in ${room}`;
  return room;
}

function paymentsFromSnapshot(snapshot: InvoiceSourceSnapshot): InvoicePayment[] {
  const payments: InvoicePayment[] = [];
  if (snapshot.deposit > 0) {
    payments.push({ id: newInvoiceId('pay'), label: 'Deposit', amount: snapshot.deposit });
  }
  snapshot.laterPayments.forEach((amount, index) => {
    if (amount > 0) {
      payments.push({
        id: newInvoiceId('pay'),
        label: `Payment ${index + 1}`,
        amount,
      });
    }
  });
  return payments;
}

export function itemsFromSnapshot(snapshot: InvoiceSourceSnapshot): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  if (snapshot.price > 0 || snapshot.roomName || snapshot.sourceType === 'venueHire') {
    const nights = snapshot.nights > 0 ? snapshot.nights : 1;
    items.push({
      id: newInvoiceId('item'),
      description: accommodationDescription(snapshot),
      quantity: 1,
      nights,
      // The booking stores a stay total, not a per-night rate. For stays longer than one night, leave the unit price blank.
      unitPrice: nights > 1 ? 0 : (snapshot.price || 0),
      discount: null,
    });
  }
  for (const extra of snapshot.extras) {
    const label = (extra.label || '').trim() || snapshot.typeLabel || 'Extra';
    items.push({
      id: newInvoiceId('item'),
      description: label,
      quantity: 1,
      nights: 1,
      unitPrice: extra.amount || 0,
      discount: null,
    });
  }
  return items;
}

export function applySnapshotToInvoice(
  invoice: Invoice,
  snapshot: InvoiceSourceSnapshot,
  options?: { keepInvoiceDiscount?: boolean }
): Invoice {
  return {
    ...invoice,
    guestName: snapshot.guestName,
    guestEmail: snapshot.guestEmail,
    guestPhone: snapshot.guestPhone || undefined,
    description: defaultDescription(snapshot),
    items: itemsFromSnapshot(snapshot),
    payments: paymentsFromSnapshot(snapshot),
    invoiceDiscount: options?.keepInvoiceDiscount ? invoice.invoiceDiscount : null,
    updatedAt: new Date().toISOString(),
  };
}

export function invoiceDiscountTitle(invoice: Pick<Invoice, 'invoiceDiscountLabel'>): string {
  return invoice.invoiceDiscountLabel?.trim() || 'Invoice discount';
}

export function createInvoiceDraft(
  snapshot: InvoiceSourceSnapshot,
  invoiceNumber: string,
  invoiceDate: string,
  paymentDefaults?: InvoicePaymentDefaults | null,
): Invoice {
  const { paymentMethod, paymentDetails } = resolveInvoicePaymentDefaults(paymentDefaults);
  const now = new Date().toISOString();
  return {
    id: '',
    invoiceNumber,
    invoiceDate,
    sourceType: snapshot.sourceType,
    sourceId: snapshot.sourceId,
    guestName: snapshot.guestName,
    guestEmail: snapshot.guestEmail,
    guestPhone: snapshot.guestPhone || undefined,
    description: defaultDescription(snapshot),
    items: itemsFromSnapshot(snapshot),
    invoiceDiscount: null,
    payments: paymentsFromSnapshot(snapshot),
    note: '',
    paymentMethod,
    paymentDetails,
    createdAt: now,
    updatedAt: now,
  };
}

export function snapshotFromBooking(
  booking: Partial<Booking>,
  sourceId: string,
  room?: Room | null,
): InvoiceSourceSnapshot {
  return {
    sourceType: 'booking',
    sourceId,
    guestName: booking.guestName || '',
    guestEmail: booking.guestEmail || '',
    guestPhone: booking.guestPhone || '',
    typeLabel: booking.type || '',
    checkIn: booking.checkIn || '',
    checkOut: booking.checkOut || '',
    roomName: room?.name || '',
    nights: calculateNights(booking.checkIn || '', booking.checkOut || ''),
    price: booking.price || 0,
    extras: asExtrasList(booking.extras).map(e => ({
      label: e.label || '',
      amount: e.amount || 0,
    })),
    deposit: booking.deposit || 0,
    laterPayments: getPaymentEntries(booking),
  };
}

export function snapshotFromVenueHire(
  venueHire: Partial<VenueHire>,
  sourceId: string,
): InvoiceSourceSnapshot {
  return {
    sourceType: 'venueHire',
    sourceId,
    guestName: venueHire.organizer || venueHire.name || '',
    guestEmail: '',
    guestPhone: '',
    typeLabel: 'Venue Hire',
    checkIn: venueHire.startDate || '',
    checkOut: venueHire.endDate || '',
    roomName: venueHire.name || 'Venue hire',
    nights: calculateNights(venueHire.startDate || '', venueHire.endDate || ''),
    price: venueHire.bookingPrice || 0,
    extras: asExtrasList(venueHire.extras).map(e => ({
      label: e.label || '',
      amount: e.amount || 0,
    })),
    deposit: venueHire.deposit || 0,
    laterPayments: getPaymentEntries({
      paidLater1: venueHire.paidLater1,
      paidLater2: venueHire.paidLater2,
    }),
  };
}

export function invoiceToFirestore(invoice: Invoice): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    sourceType: invoice.sourceType,
    sourceId: invoice.sourceId,
    guestName: invoice.guestName,
    guestEmail: invoice.guestEmail || '',
    description: invoice.description,
    items: normalizeInvoiceItems(invoice.items).map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      nights: lineNights(item),
      unitPrice: item.unitPrice,
      discount: hasDiscount(item.discount)
        ? { kind: item.discount!.kind, value: item.discount!.value }
        : null,
    })),
    invoiceDiscount: hasDiscount(invoice.invoiceDiscount)
      ? { kind: invoice.invoiceDiscount!.kind, value: invoice.invoiceDiscount!.value }
      : null,
    invoiceDiscountLabel: invoice.invoiceDiscountLabel || '',
    payments: (invoice.payments || []).map(p => ({
      id: p.id,
      label: p.label,
      amount: p.amount,
    })),
    note: invoice.note || '',
    paymentMethod: invoice.paymentMethod || '',
    paymentDetails: invoice.paymentDetails || '',
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
  if (invoice.guestPhone) payload.guestPhone = invoice.guestPhone;
  if (invoice.pdfGeneratedAt) payload.pdfGeneratedAt = invoice.pdfGeneratedAt;
  return payload;
}
