import { ConfigOption } from '@/types';

export interface CommissionInput {
  price: number;
  deposit: number;
  channelPaymentBasis: 'bookingPrice' | 'deposit' | 'custom';
  commissionCustomAmount?: number;
  bookingChannel: string;
  paymentChannel?: string;
}

export function getCommissionBase(input: CommissionInput): number {
  if (input.channelPaymentBasis === 'custom') return input.commissionCustomAmount ?? 0;
  if (input.channelPaymentBasis === 'bookingPrice') return input.price;
  return input.deposit;
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
): { base: number; booking: number; payment: number; total: number } {
  const base = getCommissionBase(input);
  const booking = channelCommissionAmount(base, input.bookingChannel, bookingChannels);
  const payment = channelCommissionAmount(base, input.paymentChannel || '', paymentChannels);
  return { base, booking, payment, total: booking + payment };
}
