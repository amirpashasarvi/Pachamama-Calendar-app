import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { useBookingSiteData } from '@/hooks/useBookingSiteData';
import { submitPublicBooking } from '@/services/functions';
import PaymentStep from '@/components/PaymentStep';
import {
  groupsForForm,
  totalStayPrice,
  nightCount,
  findAvailableRoom,
  validateStay,
} from '@/lib/bookingLogic';
import type { AccommodationPricing, BookingForm } from '@/types';

type Step = 'search' | 'results' | 'details' | 'payment' | 'confirmed';

export default function FormBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { forms, pricing, seasonalRates, rooms, bookings, ready, error: loadError } = useBookingSiteData();

  const form = forms.find(f => f.slug === slug);
  const pricingMap = useMemo(() => new Map(pricing.map(p => [p.id, p])), [pricing]);

  const [step, setStep] = useState<Step>('search');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!form) return [];
    return groupsForForm(rooms, form.accommodationIds, pricingMap);
  }, [form, rooms, pricingMap]);

  const searchError = form && checkIn && checkOut
    ? validateStay(form, checkIn, checkOut)
    : null;

  const selectedGroup = groups.find(g => g.anchorId === selectedAnchorId);
  const selectedPricing = selectedAnchorId ? pricingMap.get(selectedAnchorId) : undefined;
  const nights = checkIn && checkOut ? nightCount(checkIn, checkOut) : 0;
  const totalPrice = selectedPricing && checkIn && checkOut
    ? totalStayPrice(selectedPricing, adults, checkIn, checkOut, seasonalRates)
    : 0;

  const availableGroups = useMemo(() => {
    if (!checkIn || !checkOut) return [];
    return groups.filter(g => {
      const roomIds = g.rooms.map(r => r.id);
      return findAvailableRoom(roomIds, bookings, checkIn, checkOut) !== null;
    });
  }, [groups, bookings, checkIn, checkOut]);

  const handleSearch = () => {
    if (!form || !checkIn || !checkOut) return;
    const err = validateStay(form, checkIn, checkOut);
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    setStep('results');
  };

  const handleSelect = (anchorId: string) => {
    setSelectedAnchorId(anchorId);
    setStep('details');
  };

  const validateGuestDetails = (): string | null => {
    if (!form) return 'Form not found.';
    if (!guestName.trim() || !guestEmail.trim()) return 'Please enter your name and email.';
    for (const field of form.customFields) {
      if (field.required && !customAnswers[field.id]?.trim()) {
        return `Please fill in: ${field.label}`;
      }
    }
    return null;
  };

  const buildNotes = (bookingForm: BookingForm) => {
    const customNotes = bookingForm.customFields
      .map(f => `${f.label}: ${customAnswers[f.id] ?? ''}`)
      .filter(Boolean)
      .join('\n');
    return [customNotes].filter(Boolean).join('\n');
  };

  const finalizeBooking = async (setupIntentId?: string) => {
    if (!form || !selectedGroup || !selectedPricing || !checkIn || !checkOut || !slug) return;

    const roomIds = selectedGroup.rooms.map(r => r.id);
    if (!findAvailableRoom(roomIds, bookings, checkIn, checkOut)) {
      setSubmitError('Sorry, this accommodation was just booked. Please choose different dates.');
      setStep('results');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const price = totalStayPrice(selectedPricing, adults, checkIn, checkOut, seasonalRates);
      const bookingId = await submitPublicBooking({
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
        adults,
        type: form.name,
        checkIn,
        checkOut,
        price,
        notes: buildNotes(form),
        formSlug: slug,
        roomIds,
        setupIntentId,
        requireCard: form.saveCardDetails,
      });
      setConfirmedId(bookingId);
      setStep('confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not complete booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueFromDetails = () => {
    const err = validateGuestDetails();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    if (form?.saveCardDetails) {
      setStep('payment');
    } else {
      void finalizeBooking();
    }
  };

  const handleCardSaved = (setupIntentId: string) => {
    void finalizeBooking(setupIntentId);
  };

  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center p-6"><p className="text-rose-600 text-sm">{loadError}</p></div>;
  }

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }

  if (!form) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-600">Booking form not found.</p>
        <Link to="/" className="text-sm font-bold text-gray-900 underline">Back to home</Link>
      </div>
    );
  }

  const minCheckOut = checkIn ? format(addDays(new Date(checkIn), form.minNights), 'yyyy-MM-dd') : '';

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">← All stays</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{form.name}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {(step === 'search' || step === 'results') && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Check-in</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={checkIn} onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(''); }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Check-out</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={checkOut} min={minCheckOut || checkIn} onChange={e => setCheckOut(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Guests</label>
                <input type="number" min={1} max={10} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={adults} onChange={e => setAdults(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={handleSearch} className="w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors">
                  Search
                </button>
              </div>
            </div>
            {(searchError || submitError) && step === 'search' && (
              <p className="text-xs text-rose-600 font-medium mt-3">{searchError || submitError}</p>
            )}
          </div>
        )}

        {step === 'search' && (
          <div className="space-y-4">
            {groups.map(g => (
              <AccommodationCard
                key={g.anchorId}
                name={g.label}
                description={g.pricing?.description}
                maxGuests={g.pricing?.maxGuests ?? g.rooms[0]?.guestCount ?? 2}
                priceLabel={g.pricing ? priceLabel(g.pricing, adults) : 'Price not set'}
                searched={false}
              />
            ))}
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            {submitError && <p className="text-xs text-rose-600 font-medium">{submitError}</p>}
            {availableGroups.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">No availability for these dates. Try different dates.</p>
            ) : (
              availableGroups.map(g => {
                const p = g.pricing!;
                const total = totalStayPrice(p, adults, checkIn, checkOut, seasonalRates);
                return (
                  <AccommodationCard
                    key={g.anchorId}
                    name={g.label}
                    description={p.description}
                    maxGuests={p.maxGuests}
                    priceLabel={`€${total} total · ${nights} night${nights === 1 ? '' : 's'}`}
                    searched
                    onBook={() => handleSelect(g.anchorId)}
                  />
                );
              })
            )}
          </div>
        )}

        {(step === 'details' || step === 'payment') && selectedGroup && selectedPricing && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="pb-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">{selectedGroup.label}</p>
              <p className="text-xs text-gray-500 mt-1">
                {format(new Date(checkIn), 'dd MMM yyyy')} → {format(new Date(checkOut), 'dd MMM yyyy')} · {adults} guest{adults === 1 ? '' : 's'} · {nights} night{nights === 1 ? '' : 's'}
              </p>
              <p className="text-sm font-bold text-gray-900 mt-2">€{totalPrice} total</p>
            </div>

            {step === 'details' && (
              <>
                {form.importantBookingInfo && (
                  <div className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-xl p-3 whitespace-pre-wrap">
                    {form.importantBookingInfo}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Full name *</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={guestName} onChange={e => setGuestName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Email *</label>
                  <input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Phone</label>
                  <input type="tel" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                </div>

                {form.customFields.map(field => (
                  <div key={field.id}>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                      {field.label}{field.required ? ' *' : ''}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm min-h-[80px]" value={customAnswers[field.id] ?? ''} onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))} />
                    ) : field.type === 'select' ? (
                      <select className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={customAnswers[field.id] ?? ''} onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}>
                        <option value="">Select…</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={customAnswers[field.id] ?? ''} onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))} />
                    )}
                  </div>
                ))}

                {form.cancellationPolicyUrl && (
                  <p className="text-xs text-gray-500">
                    By booking, you agree to our{' '}
                    <a href={form.cancellationPolicyUrl} target="_blank" rel="noreferrer" className="underline font-bold">terms & policies</a>.
                  </p>
                )}

                {submitError && <p className="text-xs text-rose-600 font-medium">{submitError}</p>}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setStep('results')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">Back</button>
                  <button type="button" disabled={isSubmitting} onClick={handleContinueFromDetails} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50">
                    {isSubmitting ? 'Booking…' : form.saveCardDetails ? 'Continue to payment' : 'Book now'}
                  </button>
                </div>
              </>
            )}

            {step === 'payment' && (
              <PaymentStep
                guestName={guestName}
                guestEmail={guestEmail}
                onBack={() => setStep('details')}
                onCardSaved={handleCardSaved}
                isSubmitting={isSubmitting}
                error={submitError}
              />
            )}
          </div>
        )}

        {step === 'confirmed' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
            <p className="text-2xl">✓</p>
            <h2 className="text-lg font-bold text-gray-900">Booking received</h2>
            <p className="text-sm text-gray-500">
              Thank you, {guestName}! We have received your request and will be in touch shortly.
            </p>
            {form.saveCardDetails && (
              <p className="text-xs text-gray-400">Your card is saved — you will not be charged until we confirm your stay.</p>
            )}
            {confirmedId && <p className="text-[10px] text-gray-400">Reference: {confirmedId.slice(0, 8)}</p>}
            <Link to="/" className="inline-block mt-4 text-sm font-bold text-gray-900 underline">Back to home</Link>
          </div>
        )}
      </main>
    </div>
  );
}

function priceLabel(pricing: AccommodationPricing, guests: number) {
  if (pricing.pricingMode === 'fixed') {
    return pricing.fixedPrice ? `from €${pricing.fixedPrice} / night` : 'Price not set';
  }
  const key = String(Math.min(guests, pricing.maxGuests));
  const rate = pricing.perGuestPrices?.[key];
  return rate ? `from €${rate} / night` : 'Price not set';
}

function AccommodationCard({
  name, description, maxGuests, priceLabel, searched, onBook,
}: {
  name: string;
  description?: string;
  maxGuests: number;
  priceLabel: string;
  searched: boolean;
  onBook?: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col sm:flex-row">
      <div className="sm:w-48 h-36 sm:h-auto bg-gray-100 shrink-0" />
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">× {maxGuests} guests</p>
          {description && <p className="text-xs text-gray-600 mt-2">{description}</p>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-900">{searched ? priceLabel : 'Search dates to see availability'}</p>
          {searched && onBook && (
            <button type="button" onClick={onBook} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black shrink-0">
              Book
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
