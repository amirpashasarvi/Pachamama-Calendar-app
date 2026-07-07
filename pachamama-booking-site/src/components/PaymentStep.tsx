import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { requestSetupIntent } from '@/services/functions';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

interface PaymentStepProps {
  guestName: string;
  guestEmail: string;
  onBack: () => void;
  onCardSaved: (setupIntentId: string) => void;
  isSubmitting: boolean;
  error: string | null;
}

export default function PaymentStep(props: PaymentStepProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await requestSetupIntent(props.guestEmail, props.guestName);
        if (cancelled) return;
        setClientSecret(result.clientSecret);
        setSetupIntentId(result.setupIntentId);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load payment form.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [props.guestEmail, props.guestName]);

  if (!stripePromise) {
    return (
      <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-4">
        Stripe is not configured. Add <code className="font-mono">VITE_STRIPE_PUBLISHABLE_KEY</code> to your environment.
      </div>
    );
  }

  if (loadError) {
    return <p className="text-xs text-rose-600 font-medium">{loadError}</p>;
  }

  if (!clientSecret || !setupIntentId) {
    return <p className="text-xs text-gray-400">Loading secure payment form…</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <PaymentFormInner {...props} setupIntentId={setupIntentId} />
    </Elements>
  );
}

function PaymentFormInner({
  onBack, onCardSaved, isSubmitting, error, setupIntentId,
}: PaymentStepProps & { setupIntentId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    setConfirming(true);
    setLocalError(null);
    const { error: stripeError } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });
    setConfirming(false);
    if (stripeError) {
      setLocalError(stripeError.message ?? 'Card could not be saved.');
      return;
    }
    onCardSaved(setupIntentId);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        Your card will be saved securely. You will not be charged now — we review every booking first.
      </p>
      <PaymentElement />
      {(error || localError) && (
        <p className="text-xs text-rose-600 font-medium">{error || localError}</p>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">
          Back
        </button>
        <button
          type="button"
          disabled={!stripe || !elements || confirming || isSubmitting}
          onClick={handleConfirm}
          className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50"
        >
          {confirming || isSubmitting ? 'Saving card…' : 'Save card & book'}
        </button>
      </div>
    </div>
  );
}
