import CurrencyInput from '@/components/ui/CurrencyInput';
import { cn } from '@/lib/utils';
import {
  BookingChannelBasis,
  PaymentChannelBasis,
  calcTotalCommission,
  getBookingChannelBase,
  getPaymentChannelBase,
} from '@/lib/commission';
import { ConfigOption } from '@/types';
import { useMemo } from 'react';

interface CommissionFieldsProps {
  price: number;
  deposit: number;
  extras?: { label: string; amount: number }[];
  bookingChannel: string;
  paymentChannel?: string;
  bookingChannelBasis: BookingChannelBasis;
  bookingChannelCustomAmount?: number;
  paymentChannelBasis: PaymentChannelBasis;
  paymentChannelCustomAmount?: number;
  bookingChannels: ConfigOption[];
  paymentChannels: ConfigOption[];
  onChange: (patch: Partial<{
    bookingChannel: string;
    paymentChannel: string;
    bookingChannelBasis: BookingChannelBasis;
    bookingChannelCustomAmount: number;
    paymentChannelBasis: PaymentChannelBasis;
    paymentChannelCustomAmount: number;
  }>) => void;
}

function BasisPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 p-0.5 bg-slate-200/60 rounded-xl shrink-0 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'py-1 px-2.5 rounded-lg text-xs font-bold transition-all',
            value === opt.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function BaseAmount({
  basis,
  customAmount,
  computedBase,
  onCustomAmountChange,
}: {
  basis: string;
  customAmount?: number;
  computedBase: number;
  onCustomAmountChange: (v: number) => void;
}) {
  if (basis === 'custom') {
    return (
      <div className="relative shrink-0 w-28">
        <span className="absolute left-2.5 top-[9px] text-xs text-gray-400">€</span>
        <CurrencyInput
          value={customAmount ?? 0}
          onChange={onCustomAmountChange}
          className="pl-6 pr-2 py-2 border border-slate-200 rounded-xl text-sm bg-white"
        />
      </div>
    );
  }
  return (
    <div className="shrink-0 w-28 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-sm text-gray-500 text-right select-none">
      €{computedBase.toFixed(2)}
    </div>
  );
}

export default function CommissionFields({
  price,
  deposit,
  extras,
  bookingChannel,
  paymentChannel,
  bookingChannelBasis,
  bookingChannelCustomAmount,
  paymentChannelBasis,
  paymentChannelCustomAmount,
  bookingChannels,
  paymentChannels,
  onChange,
}: CommissionFieldsProps) {
  const commissionInput = useMemo(() => ({
    price,
    deposit,
    extras,
    bookingChannelBasis,
    bookingChannelCustomAmount,
    paymentChannelBasis,
    paymentChannelCustomAmount,
    bookingChannel,
    paymentChannel,
  }), [
    price, deposit, extras,
    bookingChannelBasis, bookingChannelCustomAmount,
    paymentChannelBasis, paymentChannelCustomAmount,
    bookingChannel, paymentChannel,
  ]);

  const liveCommission = useMemo(
    () => calcTotalCommission(commissionInput, bookingChannels, paymentChannels),
    [commissionInput, bookingChannels, paymentChannels]
  );

  const bookingBase = getBookingChannelBase(commissionInput);
  const paymentBase = getPaymentChannelBase(commissionInput);

  const selectedBookingChannel = bookingChannels.find(c => c.name === bookingChannel);
  const selectedPaymentChannel = paymentChannels.find(c => c.name === paymentChannel);
  const bookingChannelRate = selectedBookingChannel?.commission ?? 0;
  const paymentChannelRate = selectedPaymentChannel?.commission ?? 0;

  return (
    <div className="space-y-4 pt-3 border-t border-slate-200">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">Channel &amp; Commission</h4>

      {/* Booking channel */}
      <div className="space-y-2 p-3 bg-white/70 border border-slate-200/80 rounded-xl">
        <label className="block text-[10px] font-bold text-slate-600 uppercase">
          Booking channel <span className="text-rose-500">*</span>
        </label>
        <select
          className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white text-sm"
          value={bookingChannel || ''}
          onChange={e => onChange({ bookingChannel: e.target.value })}
          aria-label="Booking channel"
          required
        >
          <option value="">Select channel…</option>
          {bookingChannels.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <BasisPills
            options={[
              { value: 'bookingPrice', label: 'Full Booking' },
              { value: 'deposit', label: 'Deposit' },
              { value: 'custom', label: 'Custom' },
            ] as const}
            value={bookingChannelBasis}
            onChange={v => onChange({ bookingChannelBasis: v })}
          />
          <BaseAmount
            basis={bookingChannelBasis}
            customAmount={bookingChannelCustomAmount}
            computedBase={bookingBase}
            onCustomAmountChange={v => onChange({ bookingChannelCustomAmount: v })}
          />
        </div>
        <p className="text-[10px] text-gray-400 font-mono">
          {bookingChannelRate}% of €{bookingBase.toFixed(2)} = €{liveCommission.booking.toFixed(2)}
        </p>
      </div>

      {/* Payment channel */}
      <div className="space-y-2 p-3 bg-white/70 border border-slate-200/80 rounded-xl">
        <label className="block text-[10px] font-bold text-slate-600 uppercase">
          Payment channel
          <span className="ml-1 font-normal normal-case text-gray-400">(required if Paid Later is used)</span>
        </label>
        <select
          className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white text-sm"
          value={paymentChannel || ''}
          onChange={e => onChange({ paymentChannel: e.target.value })}
          aria-label="Payment channel"
        >
          <option value="">Select channel…</option>
          {paymentChannels.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <BasisPills
            options={[
              { value: 'bookingPrice', label: 'Full Booking' },
              { value: 'remaining', label: 'Remaining' },
              { value: 'custom', label: 'Custom' },
            ] as const}
            value={paymentChannelBasis}
            onChange={v => onChange({ paymentChannelBasis: v })}
          />
          <BaseAmount
            basis={paymentChannelBasis}
            customAmount={paymentChannelCustomAmount}
            computedBase={paymentBase}
            onCustomAmountChange={v => onChange({ paymentChannelCustomAmount: v })}
          />
        </div>
        <p className="text-[10px] text-gray-400 font-mono">
          {paymentChannelRate}% of €{paymentBase.toFixed(2)} = €{liveCommission.payment.toFixed(2)}
          {paymentChannelBasis === 'remaining' && (
            <span className="ml-1 text-gray-300">· total minus deposit</span>
          )}
        </p>
      </div>

      <p className="text-xs font-bold text-gray-500 font-mono pt-1 border-t border-slate-200/80">
        Total commission · €{liveCommission.total.toFixed(2)}
      </p>
    </div>
  );
}
