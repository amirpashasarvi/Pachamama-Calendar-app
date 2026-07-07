import { useMemo, useRef, useState } from 'react';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '@/services/firebase';
import { useBooking } from '@/hooks/useBooking';
import { Room, AccommodationPricing, SeasonalRate, PricingMode, DayOfWeek } from '@/types';
import { computeAccommodationGroups, WEEKDAYS, type AccommodationGroup } from '@/lib/accommodationGroups';
import DatePicker from '@/components/ui/DatePicker';
import { cn } from '@/lib/utils';
import { ChevronDown, Save, Plus, Trash2, Pencil, Users2, Upload, X } from 'lucide-react';

type SubTab = 'accommodations' | 'seasonalRates';

const DAYS = WEEKDAYS;

function priceSummary(pricing: AccommodationPricing | undefined): string {
  if (!pricing) return 'Not priced yet';
  if (pricing.pricingMode === 'fixed') {
    return pricing.fixedPrice ? `€${pricing.fixedPrice} / night` : 'Not priced yet';
  }
  const values = Object.values(pricing.perGuestPrices ?? {}).filter(v => v > 0);
  if (values.length === 0) return 'Not priced yet';
  const min = Math.min(...values);
  return `from €${min} / night`;
}

const inputClass = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none';
const labelClass = 'block text-[10px] font-bold uppercase text-gray-400 mb-1';

export default function RoomPricingPanel() {
  const [subTab, setSubTab] = useState<SubTab>('accommodations');
  const { rooms, accommodationPricing, seasonalRates } = useBooking();

  const groups = useMemo(() => computeAccommodationGroups(rooms), [rooms]);
  const pricingById = useMemo(() => {
    const map = new Map<string, AccommodationPricing>();
    accommodationPricing.forEach(p => map.set(p.id, p));
    return map;
  }, [accommodationPricing]);

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setSubTab('accommodations')}
          className={cn('px-4 py-2.5 text-xs font-bold border-b-2 transition-all', subTab === 'accommodations' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-700')}
        >
          Accommodations
        </button>
        <button
          type="button"
          onClick={() => setSubTab('seasonalRates')}
          className={cn('px-4 py-2.5 text-xs font-bold border-b-2 transition-all', subTab === 'seasonalRates' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-700')}
        >
          Seasonal Rates
        </button>
      </div>

      {subTab === 'accommodations' ? (
        <AccommodationsTab rooms={rooms} groups={groups} pricingById={pricingById} />
      ) : (
        <SeasonalRatesTab groups={groups} pricingById={pricingById} seasonalRates={seasonalRates} />
      )}
    </div>
  );
}

// ── Accommodations tab ───────────────────────────────────────────────────────

function AccommodationsTab({
  rooms, groups, pricingById,
}: {
  rooms: Room[];
  groups: AccommodationGroup[];
  pricingById: Map<string, AccommodationPricing>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGrouping, setShowGrouping] = useState(false);

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGrouping(v => !v)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Group your rooms</p>
            <p className="text-xs text-gray-500">Give rooms the same booking group to price and show them to guests as one accommodation (e.g. "Stone House Shared").</p>
          </div>
          <ChevronDown size={16} className={cn('shrink-0 text-gray-400 transition-transform', showGrouping && 'rotate-180')} />
        </button>
        {showGrouping && (
          <div className="p-4 space-y-2 bg-white">
            {rooms.map(room => (
              <RoomGroupRow key={room.id} room={room} />
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-6 text-center">No rooms found. Add rooms in Settings → Rooms first.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map(group => {
            const pricing = pricingById.get(group.anchorId);
            const isExpanded = expandedId === group.anchorId;
            return (
              <div
                key={group.anchorId}
                className={cn(
                  'border rounded-2xl transition-all overflow-hidden sm:col-span-1',
                  isExpanded && 'sm:col-span-2',
                  isExpanded ? 'border-gray-300 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white',
                )}
              >
                {!isExpanded ? (
                  <button
                    type="button"
                    onClick={() => setExpandedId(group.anchorId)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{pricing?.publicName || group.label}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Users2 size={11} /> {pricing?.maxGuests ?? Math.max(...group.rooms.map(r => r.guestCount || 1), 1)} guest{(pricing?.maxGuests ?? 1) === 1 ? '' : 's'} · {group.rooms.length} unit{group.rooms.length === 1 ? '' : 's'}
                      </p>
                      <p className={cn('text-xs font-bold mt-1', pricing ? 'text-gray-700' : 'text-gray-400 italic')}>
                        {priceSummary(pricing)}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
                      Edit <ChevronDown size={14} />
                    </span>
                  </button>
                ) : (
                  <AccommodationEditor
                    group={group}
                    pricing={pricing}
                    onClose={() => setExpandedId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoomGroupRow({ room }: { room: Room }) {
  const [value, setValue] = useState(room.bookingGroup ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleBlur = async () => {
    const trimmed = value.trim();
    if (trimmed === (room.bookingGroup ?? '').trim()) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'rooms', room.id), { bookingGroup: trimmed }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: room.color }} />
      <span className="text-xs font-bold text-gray-700 w-40 truncate shrink-0">{room.name}</span>
      <input
        className={cn(inputClass, 'flex-1', isSaving && 'opacity-60')}
        placeholder="Booking group (optional)"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={isSaving}
      />
    </div>
  );
}

function AccommodationEditor({
  group, pricing, onClose,
}: {
  group: AccommodationGroup;
  pricing: AccommodationPricing | undefined;
  onClose: () => void;
}) {
  const defaultMaxGuests = Math.max(...group.rooms.map(r => r.guestCount || 1), 1);
  const [publicName, setPublicName] = useState(pricing?.publicName ?? group.label);
  const [description, setDescription] = useState(pricing?.description ?? '');
  const [maxGuests, setMaxGuests] = useState(pricing?.maxGuests ?? defaultMaxGuests);
  const [pricingMode, setPricingMode] = useState<PricingMode>(pricing?.pricingMode ?? 'fixed');
  const [fixedPrice, setFixedPrice] = useState(pricing?.fixedPrice?.toString() ?? '');
  const [perGuestPrices, setPerGuestPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (let g = 1; g <= (pricing?.maxGuests ?? defaultMaxGuests); g++) {
      initial[g] = pricing?.perGuestPrices?.[g]?.toString() ?? '';
    }
    return initial;
  });
  const [photos, setPhotos] = useState(pricing?.photos ?? []);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose a JPG, PNG or WEBP image.');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const path = `accommodationPhotos/${group.anchorId}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotos(prev => [...prev, { url, path }]);
    } catch (err) {
      setError('Could not upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (photo: { url: string; path: string }) => {
    setPhotos(prev => prev.filter(p => p.path !== photo.path));
    try {
      await deleteObject(ref(storage, photo.path));
    } catch {
      // Non-fatal — the reference is already removed from this accommodation either way.
    }
  };

  const updateMaxGuests = (val: number) => {
    setMaxGuests(val);
    setPerGuestPrices(prev => {
      const next: Record<string, string> = {};
      for (let g = 1; g <= val; g++) next[g] = prev[g] ?? '';
      return next;
    });
  };

  const handleSave = async () => {
    const name = publicName.trim();
    if (!name) {
      setError('Please enter a public name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const data: Omit<AccommodationPricing, 'id'> = {
        kind: group.kind,
        label: group.label,
        publicName: name,
        description: description.trim(),
        maxGuests,
        pricingMode,
        photos,
        updatedAt: new Date().toISOString(),
      };
      if (pricingMode === 'fixed') {
        data.fixedPrice = Number(fixedPrice) || 0;
      } else {
        const perGuest: Record<string, number> = {};
        for (let g = 1; g <= maxGuests; g++) {
          const raw = perGuestPrices[g];
          if (raw !== undefined && raw !== '') perGuest[g] = Number(raw) || 0;
        }
        data.perGuestPrices = perGuest;
      }
      await setDoc(doc(db, 'accommodationPricing', group.anchorId), data, { merge: true });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accommodationPricing/${group.anchorId}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <label className={labelClass}>Public name</label>
          <input className={inputClass} value={publicName} onChange={e => setPublicName(e.target.value)} />
        </div>
        <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg mt-5">
          <ChevronDown size={16} className="rotate-180" />
        </button>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          className={cn(inputClass, 'min-h-[70px] resize-none')}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Shown to guests on the public site"
        />
      </div>

      <div>
        <label className={labelClass}>Photos</label>
        <div className="flex flex-wrap gap-2">
          {photos.map(photo => (
            <div key={photo.path} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePhoto(photo)}
                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                title="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            <span className="text-[9px] font-bold text-center leading-tight px-1">{isUploading ? 'Uploading…' : 'Upload image'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUploadPhoto(file);
            }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">JPG, PNG, WEBP</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Max guests</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={maxGuests}
            onChange={e => updateMaxGuests(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className={labelClass}>Price model</label>
          <select
            className={inputClass}
            value={pricingMode}
            onChange={e => setPricingMode(e.target.value as PricingMode)}
          >
            <option value="fixed">Fixed</option>
            <option value="perGuest">Flexible - depends on guests number</option>
          </select>
        </div>
      </div>

      <div>
        {pricingMode === 'fixed' ? (
          <div className="w-40 relative">
            <label className={labelClass}>Price</label>
            <input
              type="number"
              min={0}
              className={cn(inputClass, 'pr-14')}
              value={fixedPrice}
              onChange={e => setFixedPrice(e.target.value)}
              placeholder="0"
            />
            <span className="absolute right-3 bottom-2.5 text-xs font-bold text-gray-400">/ night</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map(g => (
              <div key={g} className="relative">
                <label className={labelClass}>Price for {g} guest{g === 1 ? '' : 's'}</label>
                <input
                  type="number"
                  min={0}
                  className={cn(inputClass, 'pr-14')}
                  value={perGuestPrices[g] ?? ''}
                  onChange={e => setPerGuestPrices(prev => ({ ...prev, [g]: e.target.value }))}
                  placeholder="0"
                />
                <span className="absolute right-3 bottom-2.5 text-xs font-bold text-gray-400">/ night</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Units in this accommodation</p>
        <div className="flex flex-wrap gap-1.5">
          {group.rooms.map(r => (
            <span key={r.id} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600">
              {r.name}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onClose} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold">
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={13} /> {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Seasonal Rates tab ───────────────────────────────────────────────────────

function guestTiersFor(pricing: AccommodationPricing): number[] {
  if (pricing.pricingMode === 'fixed') return [0]; // 0 = sentinel for "fixed" single tier
  return Array.from({ length: pricing.maxGuests }, (_, i) => i + 1);
}

function baseValueFor(pricing: AccommodationPricing, tier: number): number {
  if (pricing.pricingMode === 'fixed') return pricing.fixedPrice ?? 0;
  return pricing.perGuestPrices?.[tier] ?? 0;
}

function SeasonalRatesTab({
  groups, pricingById, seasonalRates,
}: {
  groups: AccommodationGroup[];
  pricingById: Map<string, AccommodationPricing>;
  seasonalRates: SeasonalRate[];
}) {
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const pricedGroups = groups.filter(g => pricingById.has(g.anchorId));

  const editingRate = editingId && editingId !== 'new' ? seasonalRates.find(r => r.id === editingId) ?? null : null;

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'seasonalRates', id));
      setConfirmDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `seasonalRates/${id}`);
    }
  };

  if (editingId) {
    return (
      <SeasonalRateEditor
        rate={editingRate}
        pricedGroups={pricedGroups}
        pricingById={pricingById}
        onClose={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEditingId('new')}
        disabled={pricedGroups.length === 0}
        className="w-full py-2.5 flex items-center justify-center gap-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={14} /> New seasonal rate
      </button>
      {pricedGroups.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center">Price at least one accommodation first.</p>
      )}

      {seasonalRates.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-6 text-center">No seasonal rates yet.</p>
      ) : (
        <div className="space-y-2">
          {seasonalRates.map(rate => (
            <div key={rate.id} className="flex items-center justify-between gap-2 p-3 bg-white border border-gray-200 rounded-xl">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{rate.name}</p>
                <p className="text-xs text-gray-500">
                  {rate.startDate} → {rate.endDate} · {Object.keys(rate.overrides).length} accommodation{Object.keys(rate.overrides).length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {confirmDeleteId === rate.id ? (
                  <>
                    <button type="button" onClick={() => handleDelete(rate.id)} className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-lg">Delete</button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg">Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setEditingId(rate.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(rate.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonalRateEditor({
  rate, pricedGroups, pricingById, onClose,
}: {
  rate: SeasonalRate | null;
  pricedGroups: AccommodationGroup[];
  pricingById: Map<string, AccommodationPricing>;
  onClose: () => void;
}) {
  const [name, setName] = useState(rate?.name ?? '');
  const [startDate, setStartDate] = useState(rate?.startDate ?? '');
  const [endDate, setEndDate] = useState(rate?.endDate ?? '');
  const [applyDays, setApplyDays] = useState<DayOfWeek[]>(rate?.applyDays ?? []);
  const [bulkPct, setBulkPct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // draft[accommodationId][tier] = raw "New" price input string (empty = no override for that tier)
  const [draft, setDraft] = useState<Record<string, Record<number, string>>>(() => {
    const initial: Record<string, Record<number, string>> = {};
    for (const g of pricedGroups) {
      const pricing = pricingById.get(g.anchorId)!;
      const existingOverride = rate?.overrides[g.anchorId];
      const tiers: Record<number, string> = {};
      for (const tier of guestTiersFor(pricing)) {
        if (!existingOverride) {
          tiers[tier] = '';
        } else if (pricing.pricingMode === 'fixed') {
          tiers[tier] = existingOverride.fixedPrice !== undefined ? String(existingOverride.fixedPrice) : '';
        } else {
          tiers[tier] = existingOverride.perGuestPrices?.[tier] !== undefined ? String(existingOverride.perGuestPrices![tier]) : '';
        }
      }
      initial[g.anchorId] = tiers;
    }
    return initial;
  });

  const toggleDay = (day: DayOfWeek) => {
    setApplyDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const applyBulkPct = () => {
    const pct = Number(bulkPct);
    if (!bulkPct || Number.isNaN(pct)) return;
    setDraft(prev => {
      const next = { ...prev };
      for (const g of pricedGroups) {
        const pricing = pricingById.get(g.anchorId)!;
        const tiers = { ...next[g.anchorId] };
        for (const tier of guestTiersFor(pricing)) {
          const base = baseValueFor(pricing, tier);
          if (base > 0) tiers[tier] = String(Math.round(base * (1 + pct / 100)));
        }
        next[g.anchorId] = tiers;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Please enter a name.'); return; }
    if (!startDate || !endDate) { setError('Please select start and end dates.'); return; }
    if (endDate <= startDate) { setError('End date must be after start date.'); return; }

    const overrides: SeasonalRate['overrides'] = {};
    for (const g of pricedGroups) {
      const pricing = pricingById.get(g.anchorId)!;
      const tiers = draft[g.anchorId] ?? {};
      if (pricing.pricingMode === 'fixed') {
        const raw = tiers[0];
        if (raw !== undefined && raw !== '') {
          overrides[g.anchorId] = { pricingMode: 'fixed', fixedPrice: Number(raw) || 0 };
        }
      } else {
        const perGuestPrices: Record<string, number> = {};
        for (const [tier, raw] of Object.entries(tiers)) {
          if (raw !== '') perGuestPrices[tier] = Number(raw) || 0;
        }
        if (Object.keys(perGuestPrices).length > 0) {
          overrides[g.anchorId] = { pricingMode: 'perGuest', perGuestPrices };
        }
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      const id = rate?.id ?? doc(collection(db, 'seasonalRates')).id;
      await setDoc(doc(db, 'seasonalRates', id), {
        name: name.trim(),
        startDate,
        endDate,
        applyDays,
        overrides,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      onClose();
    } catch (err) {
      handleFirestoreError(err, rate ? OperationType.UPDATE : OperationType.CREATE, `seasonalRates/${rate?.id ?? 'new'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-4">
      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3">
        Leave "New" empty to keep the accommodation's base price during this season. For per-guest pricing, set a new price for every guest count you want to override.
      </p>

      <div>
        <label className={labelClass}>Name</label>
        <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. High Season" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Start</label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div>
          <label className={labelClass}>End</label>
          <DatePicker value={endDate} min={startDate} defaultMonth={startDate || undefined} onChange={setEndDate} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Apply on days (empty = all days)</label>
        <div className="flex gap-1.5">
          {DAYS.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDay(d.id)}
              className={cn('w-9 h-9 rounded-lg text-xs font-bold transition-all', applyDays.includes(d.id) ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100')}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Change all rates by (%)</label>
        <div className="flex gap-2">
          <input
            type="number"
            className={cn(inputClass, 'flex-1')}
            value={bulkPct}
            onChange={e => setBulkPct(e.target.value)}
            placeholder="e.g. 15 or -10"
          />
          <button type="button" onClick={applyBulkPct} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors">
            Apply
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
        {pricedGroups.map(g => {
          const pricing = pricingById.get(g.anchorId)!;
          const tiers = guestTiersFor(pricing);
          return (
            <div key={g.anchorId} className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-900 mb-2">{pricing.publicName}</p>
              <div className="space-y-1.5">
                {tiers.map(tier => (
                  <div key={tier} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-[11px] font-bold text-gray-400">
                      {pricing.pricingMode === 'fixed' ? 'Base' : `${tier} guest${tier === 1 ? '' : 's'}`}
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      €{baseValueFor(pricing, tier)}
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={cn(inputClass, 'py-1.5')}
                      placeholder="New"
                      value={draft[g.anchorId]?.[tier] ?? ''}
                      onChange={e => setDraft(prev => ({
                        ...prev,
                        [g.anchorId]: { ...prev[g.anchorId], [tier]: e.target.value },
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onClose} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold">
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={13} /> {isSaving ? 'Saving…' : 'Save seasonal rate'}
        </button>
      </div>
    </div>
  );
}

