import { ConfigOption } from '@/types';
import { extrasTotal } from '@/lib/bookingFinancials';

export type BookingChannelBasis = 'bookingPrice' | 'deposit' | 'custom';
export type PaymentChannelBasis = 'bookingPrice' | 'remaining' | 'custom';

export interface CommissionInput {
  price: number;
  deposit: number;
  extras?: { amount: number }[];
  bookingChannelBasis?: BookingChannelBasis;
  bookingChannelCustomAmount?: number;
  paymentChannelBasis?: PaymentChannelBasis;
  paymentChannelCustomAmount?: number;
  /** @deprecated — migrated to bookingChannelBasis / paymentChannelBasis */
  channelPaymentBasis?: BookingChannelBasis;
  /** @deprecated */
  commissionCustomAmount?: number;
  bookingChannel: string;
  paymentChannel?: string;
}

export function bookingTotal(input: Pick<CommissionInput, 'price' | 'extras'>): number {
  return (input.price || 0) + extrasTotal(input.extras);
}

export function migrateCommissionFields(record: {
  channelPaymentBasis?: BookingChannelBasis;
  commissionCustomAmount?: number;
  bookingChannelBasis?: BookingChannelBasis;
  bookingChannelCustomAmount?: number;
  paymentChannelBasis?: PaymentChannelBasis;
  paymentChannelCustomAmount?: number;
}) {
  const legacyBasis = record.channelPaymentBasis ?? 'bookingPrice';
  const legacyCustom = record.commissionCustomAmount ?? 0;

  return {
    bookingChannelBasis: record.bookingChannelBasis ?? legacyBasis,
    bookingChannelCustomAmount: record.bookingChannelCustomAmount ?? legacyCustom,
    paymentChannelBasis: record.paymentChannelBasis ?? (
      legacyBasis === 'deposit' ? 'remaining' as const
        : legacyBasis === 'custom' ? 'custom' as const
          : 'bookingPrice' as const
    ),
    paymentChannelCustomAmount: record.paymentChannelCustomAmount ?? legacyCustom,
  };
}

export function resolveBookingChannelBasis(input: CommissionInput): BookingChannelBasis {
  return input.bookingChannelBasis ?? input.channelPaymentBasis ?? 'bookingPrice';
}

export function resolvePaymentChannelBasis(input: CommissionInput): PaymentChannelBasis {
  if (input.paymentChannelBasis) return input.paymentChannelBasis;
  const legacy = input.channelPaymentBasis;
  if (legacy === 'deposit') return 'remaining';
  if (legacy === 'custom') return 'custom';
  return 'bookingPrice';
}

export function getBookingChannelBase(input: CommissionInput): number {
  const basis = resolveBookingChannelBasis(input);
  if (basis === 'custom') return input.bookingChannelCustomAmount ?? input.commissionCustomAmount ?? 0;
  if (basis === 'bookingPrice') return bookingTotal(input);
  return input.deposit || 0;
}

export function getPaymentChannelBase(input: CommissionInput): number {
  const basis = resolvePaymentChannelBasis(input);
  if (basis === 'custom') return input.paymentChannelCustomAmount ?? input.commissionCustomAmount ?? 0;
  if (basis === 'bookingPrice') return bookingTotal(input);
  return Math.max(0, bookingTotal(input) - (input.deposit || 0));
}

export function channelCommissionAmount(
  base: number,
  channelName: string,
  channels: ConfigOption[]
): number {
  if (!channelName) return 0;
  const ch = channels.find(c => c.name === channelName);
  if (!ch?.commission) return 0;
  return (base * ch.commission) / 100;
}

export function calcTotalCommission(
  input: CommissionInput,
  bookingChannels: ConfigOption[],
  paymentChannels: ConfigOption[]
): { bookingBase: number; paymentBase: number; booking: number; payment: number; total: number } {
  const bookingBase = getBookingChannelBase(input);
  const paymentBase = getPaymentChannelBase(input);
  const booking = channelCommissionAmount(bookingBase, input.bookingChannel, bookingChannels);
  const payment = channelCommissionAmount(paymentBase, input.paymentChannel || '', paymentChannels);
  return { bookingBase, paymentBase, booking, payment, total: booking + payment };
}

export function commissionInputFromRecord(record: {
  price?: number;
  bookingPrice?: number;
  deposit?: number;
  extras?: { amount: number }[];
  bookingChannel: string;
  paymentChannel?: string;
  channelPaymentBasis?: BookingChannelBasis;
  commissionCustomAmount?: number;
  bookingChannelBasis?: BookingChannelBasis;
  bookingChannelCustomAmount?: number;
  paymentChannelBasis?: PaymentChannelBasis;
  paymentChannelCustomAmount?: number;
}): CommissionInput {
  return {
    price: record.price ?? record.bookingPrice ?? 0,
    deposit: record.deposit || 0,
    extras: record.extras,
    bookingChannel: record.bookingChannel,
    paymentChannel: record.paymentChannel,
    ...migrateCommissionFields(record),
  };
}

export function bookingBasisLabel(basis: BookingChannelBasis | string | undefined): string {
  if (basis === 'deposit') return 'Deposit';
  if (basis === 'custom') return 'Custom';
  return 'Full Booking';
}

export function paymentBasisLabel(basis: PaymentChannelBasis | string | undefined): string {
  if (basis === 'remaining') return 'Remaining';
  if (basis === 'custom') return 'Custom';
  return 'Full Booking';
}

/** @deprecated use getBookingChannelBase / getPaymentChannelBase */
export function getCommissionBase(input: CommissionInput): number {
  return getBookingChannelBase(input);
}
