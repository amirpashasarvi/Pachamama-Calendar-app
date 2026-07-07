import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useBookingSiteData } from '@/hooks/useBookingSiteData';
import { submitPublicBooking } from '@/services/functions';
import PaymentStep from '@/components/PaymentStep';
import { groupsForForm, findAvailableRoom } from '@/lib/bookingLogic';
import { upcomingRunsForProgram } from '@/lib/retreatLogic';
import type { RetreatRun, BookingForm } from '@/types';

type Step = 'book' | 'details' | 'payment' | 'confirmed';

export default function RetreatBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const {
    retreatTypes, retreatRuns, forms, pricing, rooms, bookings, ready, error: loadError,
  } = useBookingSiteData();

  const program = retreatTypes.find(p => p.slug === slug && p.published);
  const linkedForm = forms.find(f => f.id === program?.bookingFormId);
  const pricingMap = useMemo(() => new Map(pricing.map(p => [p.id, p])), [pricing]);

  const runs = useMemo(
    () => (program ? upcomingRunsForProgram(program.id, retreatRuns) : []),
    [program, retreatRuns],
  );

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [adults, setAdults] = useState(1);
  const [step, setStep] = useState<Step>('book');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const selectedRun = runs.find(r => r.id === selectedRunId) ?? runs[0];
  const effectiveRunId = selectedRun?.id ?? null;

  const groups = useMemo(() => {
    if (!linkedForm) return [];
    return groupsForForm(rooms, linkedForm.accommodationIds, pricingMap);
  }, [linkedForm, rooms, pricingMap]);

  const availableGroups = useMemo(() => {
    if (!selectedRun) return [];
    return groups.filter(g => {
      const price = selectedRun.accommodationPrices?.[g.anchorId];
      if (!price || price <= 0) return false;
      return findAvailableRoom(g.rooms.map(r => r.id), bookings, selectedRun.startDate, selectedRun.endDate) !== null;
    });
  }, [groups, bookings, selectedRun]);

  const selectedGroup = groups.find(g => g.anchorId === selectedAnchorId);
  const totalPrice = selectedRun && selectedAnchorId
    ? selectedRun.accommodationPrices?.[selectedAnchorId] ?? 0
    : 0;

  const validateGuestDetails = (form: BookingForm): string | null => {
    if (!guestName.trim() || !guestEmail.trim()) return 'Please enter your name and email.';
    for (const field of form.customFields) {
      if (field.required && !customAnswers[field.id]?.trim()) {
        return `Please fill in: ${field.label}`;
      }
    }
    return null;
  };

  const buildNotes = (form: BookingForm) =>
    form.customFields
      .map(f => `${f.label}: ${customAnswers[f.id] ?? ''}`)
      .filter(Boolean)
      .join('\n');

  const finalizeBooking = async (setupIntentId?: string) => {
    if (!program || !linkedForm || !selectedRun || !selectedGroup || !selectedAnchorId || !slug) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const bookingId = await submitPublicBooking({
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
        adults,
        type: program.name,
        checkIn: selectedRun.startDate,
        checkOut: selectedRun.endDate,
        price: totalPrice,
        notes: buildNotes(linkedForm),
        formSlug: linkedForm.slug,
        roomIds: selectedGroup.rooms.map(r => r.id),
        setupIntentId,
        requireCard: linkedForm.saveCardDetails,
        retreatRunId: selectedRun.id,
        retreatTypeId: program.id,
        accommodationAnchorId: selectedAnchorId,
      });
      setConfirmedId(bookingId);
      setStep('confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not complete booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectAccommodation = (anchorId: string) => {
    setSelectedAnchorId(anchorId);
    setStep('details');
  };

  const handleContinueDetails = () => {
    if (!linkedForm) return;
    const err = validateGuestDetails(linkedForm);
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    if (linkedForm.saveCardDetails) setStep('payment');
    else void finalizeBooking();
  };

  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center p-6"><p className="text-rose-600 text-sm">{loadError}</p></div>;
  }
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }
  if (!program || !linkedForm) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-600">Retreat not found or not configured for booking.</p>
        <Link to="/retreats" className="text-sm font-bold underline">All retreats</Link>
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-600">No upcoming dates for this retreat.</p>
        <Link to="/retreats" className="text-sm font-bold underline">All retreats</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-3xl mx-auto">
          <Link to="/retreats" className="text-xs text-gray-400 hover:text-gray-600">← All retreats</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{program.name}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {program.photoUrls?.[0] && step === 'book' && (
          <img src={program.photoUrls[0]} alt="" className="w-full h-56 object-cover rounded-2xl" />
        )}

        {program.description && step === 'book' && (
          <div className="text-sm text-gray-600 whitespace-pre-wrap">{program.description}</div>
        )}

        {(step === 'book' || step === 'details' || step === 'payment') && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-[10px] font-bold uppercase text-gray-400">Choose your dates</p>
            <div className="flex flex-wrap gap-2">
              {runs.map((run: RetreatRun) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => { setSelectedRunId(run.id); setSelectedAnchorId(null); setStep('book'); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    effectiveRunId === run.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {format(parseISO(run.startDate), 'dd MMM')} – {format(parseISO(run.endDate), 'dd MMM yyyy')}
                </button>
              ))}
            </div>
            {selectedRun?.facilitator && (
              <p className="text-xs text-gray-500">Facilitator: {selectedRun.facilitator}</p>
            )}
          </div>
        )}

        {step === 'book' && selectedRun && (
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase text-gray-400">Choose accommodation</p>
            {availableGroups.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Fully booked for these dates.</p>
            ) : (
              availableGroups.map(g => {
                const price = selectedRun.accommodationPrices?.[g.anchorId] ?? 0;
                const p = g.pricing;
                return (
                  <div key={g.anchorId} className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 shadow-sm">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{g.label}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">× {p?.maxGuests ?? g.rooms[0]?.guestCount ?? 2} guests</p>
                      {p?.description && <p className="text-xs text-gray-600 mt-2">{p.description}</p>}
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                      <p className="text-sm font-bold text-gray-900">€{price} total</p>
                      <button
                        type="button"
                        onClick={() => handleSelectAccommodation(g.anchorId)}
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
          </div>
        )}

        {(step === 'details' || step === 'payment') && selectedGroup && selectedRun && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="pb-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">{selectedGroup.label}</p>
              <p className="text-xs text-gray-500 mt-1">
                {format(parseISO(selectedRun.startDate), 'dd MMM yyyy')} → {format(parseISO(selectedRun.endDate), 'dd MMM yyyy')}
              </p>
              <p className="text-sm font-bold text-gray-900 mt-2">€{totalPrice} total</p>
            </div>

            {step === 'details' && (
              <>
                {linkedForm.importantBookingInfo && (
                  <div className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-xl p-3 whitespace-pre-wrap">
                    {linkedForm.importantBookingInfo}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Guests</label>
                  <input type="number" min={1} max={10} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={adults} onChange={e => setAdults(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>

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

                {linkedForm.customFields.map(field => (
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

                {linkedForm.cancellationPolicyUrl && (
                  <p className="text-xs text-gray-500">
                    By booking, you agree to our{' '}
                    <a href={linkedForm.cancellationPolicyUrl} target="_blank" rel="noreferrer" className="underline font-bold">terms & policies</a>.
                  </p>
                )}

                {submitError && <p className="text-xs text-rose-600 font-medium">{submitError}</p>}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setStep('book')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">Back</button>
                  <button type="button" disabled={isSubmitting} onClick={handleContinueDetails} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50">
                    {isSubmitting ? 'Booking…' : linkedForm.saveCardDetails ? 'Continue to payment' : 'Book now'}
                  </button>
                </div>
              </>
            )}

            {step === 'payment' && (
              <PaymentStep
                guestName={guestName}
                guestEmail={guestEmail}
                onBack={() => setStep('details')}
                onCardSaved={id => void finalizeBooking(id)}
                isSubmitting={isSubmitting}
                error={submitError}
              />
            )}
          </div>
        )}

        {step === 'confirmed' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
            <p className="text-2xl">✓</p>
            <h2 className="text-lg font-bold text-gray-900">Retreat booking received</h2>
            <p className="text-sm text-gray-500">Thank you, {guestName}! We will be in touch shortly.</p>
            {confirmedId && <p className="text-[10px] text-gray-400">Reference: {confirmedId.slice(0, 8)}</p>}
            <Link to="/retreats" className="inline-block mt-4 text-sm font-bold underline">All retreats</Link>
          </div>
        )}
      </main>
    </div>
  );
}
