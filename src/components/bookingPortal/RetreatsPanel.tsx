import { useMemo, useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { useBooking } from '@/hooks/useBooking';
import { Retreat, RetreatType, BookingForm, AccommodationPricing } from '@/types';
import { computeAccommodationGroups, groupDisplayName } from '@/lib/accommodationGroups';
import { cn } from '@/lib/utils';
import { ChevronLeft, Save, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const inputClass = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none';
const labelClass = 'block text-[10px] font-bold uppercase text-gray-400 mb-1';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

type ProgramDraft = {
  slug: string;
  shortDescription: string;
  description: string;
  photoUrls: string;
  bookingFormId: string;
  published: boolean;
};

function programToDraft(p: RetreatType): ProgramDraft {
  return {
    slug: p.slug ?? slugify(p.name),
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    photoUrls: (p.photoUrls ?? []).join('\n'),
    bookingFormId: p.bookingFormId ?? '',
    published: p.published ?? false,
  };
}

export default function RetreatsPanel() {
  const { retreatTypes, retreats, bookingForms, rooms, accommodationPricing } = useBooking();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [runPrices, setRunPrices] = useState<Record<string, Record<string, number>>>({});
  const [runPublished, setRunPublished] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selected = retreatTypes.find(p => p.id === selectedId);
  const programRuns = useMemo(
    () => retreats.filter(r => r.retreatTypeId === selectedId).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [retreats, selectedId],
  );

  const linkedForm = useMemo(
    () => bookingForms.find(f => f.id === draft?.bookingFormId),
    [bookingForms, draft?.bookingFormId],
  );

  const accommodationOptions = useMemo(() => {
    if (!linkedForm) return [];
    const pricingMap = new Map<string, AccommodationPricing>(
      accommodationPricing.map(p => [p.id, p]),
    );
    return computeAccommodationGroups(rooms)
      .filter(g => linkedForm.accommodationIds.includes(g.anchorId))
      .map(g => ({
        anchorId: g.anchorId,
        label: groupDisplayName(g, pricingMap),
      }));
  }, [linkedForm, rooms, accommodationPricing]);

  const openProgram = (program: RetreatType) => {
    setSelectedId(program.id);
    setDraft(programToDraft(program));
    const prices: Record<string, Record<string, number>> = {};
    const pub: Record<string, boolean> = {};
    for (const run of retreats.filter(r => r.retreatTypeId === program.id)) {
      prices[run.id] = { ...(run.accommodationPrices ?? {}) };
      pub[run.id] = run.published ?? false;
    }
    setRunPrices(prices);
    setRunPublished(pub);
    setError(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selected || !draft) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const photoUrls = draft.photoUrls
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      await updateDoc(doc(db, 'retreatTypes', selected.id), {
        slug: draft.slug.trim() || slugify(selected.name),
        shortDescription: draft.shortDescription.trim(),
        description: draft.description.trim(),
        photoUrls,
        bookingFormId: draft.bookingFormId || '',
        published: draft.published,
      });

      for (const run of programRuns) {
        await updateDoc(doc(db, 'retreats', run.id), {
          accommodationPrices: runPrices[run.id] ?? {},
          published: runPublished[run.id] ?? false,
        });
      }

      setSaved(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'retreatTypes');
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (retreatTypes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-6 bg-white border border-gray-200 rounded-2xl">
        <h3 className="text-base font-bold text-gray-900 mb-2">No retreat programs yet</h3>
        <p className="text-sm text-gray-500">
          Create retreat programs and runs in Settings → Our Retreats first, then configure public details here.
        </p>
      </div>
    );
  }

  if (selected && draft) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => { setSelectedId(null); setDraft(null); }}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft size={14} /> All retreats
        </button>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">{selected.name}</h3>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {saved && <p className="text-xs text-emerald-600 font-medium">Saved.</p>}

        <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Public information</h4>

          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={e => setDraft({ ...draft, published: e.target.checked })}
            />
            <span className="text-sm font-bold text-gray-900">Published on booking site</span>
          </label>

          <div>
            <label className={labelClass}>URL slug</label>
            <input
              className={inputClass}
              value={draft.slug}
              onChange={e => setDraft({ ...draft, slug: e.target.value })}
              placeholder="womens-retreat"
            />
            <p className="text-[10px] text-gray-400 mt-1">booking.pachamamaretreat.me/retreats/{draft.slug || '…'}</p>
          </div>

          <div>
            <label className={labelClass}>Booking form</label>
            <select
              className={inputClass}
              value={draft.bookingFormId}
              onChange={e => setDraft({ ...draft, bookingFormId: e.target.value })}
            >
              <option value="">Select form…</option>
              {bookingForms.map((f: BookingForm) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Form rules (custom fields, payment, T&C) apply to this retreat.</p>
          </div>

          <div>
            <label className={labelClass}>Short description (card)</label>
            <input
              className={inputClass}
              value={draft.shortDescription}
              onChange={e => setDraft({ ...draft, shortDescription: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass}>Full description</label>
            <textarea
              className={cn(inputClass, 'min-h-[120px]')}
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass}>Photo URLs (one per line)</label>
            <textarea
              className={cn(inputClass, 'min-h-[80px] font-mono text-xs')}
              value={draft.photoUrls}
              onChange={e => setDraft({ ...draft, photoUrls: e.target.value })}
              placeholder="https://…"
            />
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Runs & pricing</h4>
          <p className="text-xs text-gray-500">Dates and facilitators are managed in Settings → Our Retreats. Set total retreat prices per accommodation here.</p>

          {programRuns.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4">No runs for this program yet.</p>
          ) : (
            programRuns.map(run => (
              <RunPricingBlock
                key={run.id}
                run={run}
                accommodations={accommodationOptions}
                prices={runPrices[run.id] ?? {}}
                published={runPublished[run.id] ?? false}
                onPriceChange={(anchorId, price) => {
                  setRunPrices(prev => ({
                    ...prev,
                    [run.id]: { ...(prev[run.id] ?? {}), [anchorId]: price },
                  }));
                }}
                onPublishedChange={v => setRunPublished(prev => ({ ...prev, [run.id]: v }))}
              />
            ))
          )}

          {!draft.bookingFormId && programRuns.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Select a booking form above to configure accommodation prices.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Retreats</h3>
        <p className="text-sm text-gray-500 mt-1">Configure how retreat programs appear on the public booking site.</p>
      </div>

      <div className="grid gap-3">
        {retreatTypes.map(program => {
          const runs = retreats.filter(r => r.retreatTypeId === program.id);
          const publishedRuns = runs.filter(r => r.published !== false).length;
          return (
            <button
              key={program.id}
              type="button"
              onClick={() => openProgram(program)}
              className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-5 text-left hover:shadow-md transition-shadow"
            >
              <div>
                <p className="font-bold text-gray-900">{program.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {runs.length} run{runs.length === 1 ? '' : 's'}
                  {program.published ? ' · Published' : ' · Draft'}
                  {publishedRuns > 0 && ` · ${publishedRuns} on site`}
                </p>
              </div>
              <Pencil size={16} className="text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RunPricingBlock({
  run,
  accommodations,
  prices,
  published,
  onPriceChange,
  onPublishedChange,
}: {
  run: Retreat;
  accommodations: { anchorId: string; label: string }[];
  prices: Record<string, number>;
  published: boolean;
  onPriceChange: (anchorId: string, price: number) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const dateLabel = `${format(parseISO(run.startDate), 'dd MMM yyyy')} → ${format(parseISO(run.endDate), 'dd MMM yyyy')}`;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{dateLabel}</p>
          {run.facilitator && <p className="text-xs text-gray-500">Facilitator: {run.facilitator}</p>}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
          <input type="checkbox" checked={published} onChange={e => onPublishedChange(e.target.checked)} />
          On booking site
        </label>
      </div>

      {accommodations.length > 0 && (
        <div className="space-y-2">
          {accommodations.map(acc => (
            <div key={acc.anchorId} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700 flex-1 min-w-0 truncate">{acc.label}</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-gray-400">€</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right"
                  value={prices[acc.anchorId] ?? ''}
                  onChange={e => onPriceChange(acc.anchorId, parseFloat(e.target.value) || 0)}
                  placeholder="Total"
                />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400">Total price for the full retreat (not per night).</p>
        </div>
      )}
    </div>
  );
}
