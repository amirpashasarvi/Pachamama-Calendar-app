import { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { useBooking } from '@/hooks/useBooking';
import {
  BookingForm,
  BookingFormCustomField,
  BookingFormDatePeriod,
  DayOfWeek,
} from '@/types';
import {
  computeAccommodationGroups,
  groupDisplayName,
  WEEKDAYS,
  type AccommodationGroup,
} from '@/lib/accommodationGroups';
import DatePicker from '@/components/ui/DatePicker';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Save, Trash2, Pencil, ChevronDown } from 'lucide-react';

type FormTab =
  | 'information'
  | 'customFields'
  | 'payments'
  | 'restrictions'
  | 'appearance'
  | 'advanced';

const FORM_TABS: { id: FormTab; label: string }[] = [
  { id: 'information', label: 'Information' },
  { id: 'customFields', label: 'Custom Fields' },
  { id: 'payments', label: 'Payments & Policies' },
  { id: 'restrictions', label: 'Restrictions' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'advanced', label: 'Advanced' },
];

const inputClass = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none';
const labelClass = 'block text-[10px] font-bold uppercase text-gray-400 mb-1';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function defaultDraft(): Omit<BookingForm, 'id'> {
  return {
    name: '',
    slug: '',
    accommodationIds: [],
    extraIds: [],
    customFields: [],
    chargeUpfront: false,
    saveCardDetails: true,
    cancellationPolicyUrl: '',
    minNights: 2,
    maxNights: 90,
    minAdvanceDays: 1,
    maxAdvanceDays: 180,
    checkInDays: [],
    checkOutDays: [],
    checkInMonthDays: [],
    checkOutMonthDays: [],
    fixedCheckIn: '',
    fixedCheckOut: '',
    unavailablePeriods: [],
    availablePeriods: [],
    hideAvailabilityCalendar: false,
    hideGuestAddress: true,
    hideCouponForm: false,
    openCalendarByDefault: false,
    hideCalendarOnMobile: false,
    hideAccommodationsUntilSearch: false,
    canBookMultiplePeriods: false,
    minNightsPerPeriod: 1,
    allowBookingRequest: false,
    importantBookingInfo: '',
  };
}

function formToDraft(form: BookingForm): Omit<BookingForm, 'id'> {
  const { id: _id, ...rest } = form;
  return rest;
}

function CheckboxRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 rounded border-gray-300"
      />
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function WeekdayPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
}) {
  const toggle = (day: DayOfWeek) => {
    onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day]);
  };
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggle(d.id)}
            className={cn(
              'w-9 h-9 rounded-lg text-xs font-bold transition-all',
              value.includes(d.id) ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100',
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Empty = all days allowed</p>
    </div>
  );
}

export default function BookingFormsPanel() {
  const { bookingForms, rooms, accommodationPricing } = useBooking();
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const groups = useMemo(() => computeAccommodationGroups(rooms), [rooms]);
  const pricingById = useMemo(() => {
    const map = new Map<string, (typeof accommodationPricing)[0]>();
    accommodationPricing.forEach(p => map.set(p.id, p));
    return map;
  }, [accommodationPricing]);

  const editingForm = editingId && editingId !== 'new'
    ? bookingForms.find(f => f.id === editingId) ?? null
    : null;

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bookingForms', id));
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookingForms/${id}`);
    }
  };

  if (editingId) {
    return (
      <FormEditor
        form={editingForm}
        isNew={editingId === 'new'}
        groups={groups}
        pricingById={pricingById}
        onBack={() => setEditingId(null)}
        onSaved={id => setEditingId(id)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Booking forms</h3>
          <p className="text-xs text-gray-500 mt-0.5">Create and manage forms to allow guests to book your property.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingId('new')}
          className="shrink-0 px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {bookingForms.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-12 text-center border border-dashed border-gray-200 rounded-2xl">
          No booking forms yet. Click New to create your first form (e.g. Coliving, Retreats).
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bookingForms.map(form => {
            const unitCount = form.accommodationIds.length;
            const nightsLabel = `${form.minNights}–${form.maxNights} nights`;
            return (
              <div key={form.id} className="border border-gray-200 rounded-2xl bg-white overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex gap-1 p-3 pb-0">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex-1 aspect-[4/3] bg-gray-100 rounded-lg" />
                  ))}
                </div>
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-900">{form.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {nightsLabel} · {unitCount} unit{unitCount === 1 ? '' : 's'}
                    {form.extraIds.length > 0 && ` · ${form.extraIds.length} extra${form.extraIds.length === 1 ? '' : 's'}`}
                  </p>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingId(form.id)}
                      className="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    {confirmDeleteId === form.id ? (
                      <>
                        <button type="button" onClick={() => handleDelete(form.id)} className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-lg">Delete</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg">Cancel</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(form.id)}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormEditor({
  form,
  isNew,
  groups,
  pricingById,
  onBack,
  onSaved,
}: {
  form: BookingForm | null;
  isNew: boolean;
  groups: AccommodationGroup[];
  pricingById: Map<string, { publicName?: string }>;
  onBack: () => void;
  onSaved: (id: string) => void;
}) {
  const [tab, setTab] = useState<FormTab>('information');
  const [draft, setDraft] = useState<Omit<BookingForm, 'id'>>(() => form ? formToDraft(form) : defaultDraft());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(groups.map(g => g.anchorId)));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodTab, setPeriodTab] = useState<'unavailable' | 'available'>('unavailable');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  const patch = (updates: Partial<Omit<BookingForm, 'id'>>) => setDraft(prev => ({ ...prev, ...updates }));

  const toggleAccommodation = (anchorId: string) => {
    const ids = draft.accommodationIds.includes(anchorId)
      ? draft.accommodationIds.filter(id => id !== anchorId)
      : [...draft.accommodationIds, anchorId];
    patch({ accommodationIds: ids });
  };

  const selectAllAccommodations = () => {
    patch({ accommodationIds: groups.map(g => g.anchorId) });
  };

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Please enter a form name.');
      setTab('information');
      return;
    }
    const slug = draft.slug.trim() || slugify(name);
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        name,
        slug,
        updatedAt: new Date().toISOString(),
      };
      if (form?.id) {
        await updateDoc(doc(db, 'bookingForms', form.id), payload);
        onSaved(form.id);
      } else {
        const ref = await addDoc(collection(db, 'bookingForms'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        onSaved(ref.id);
      }
    } catch (err) {
      handleFirestoreError(err, form ? OperationType.UPDATE : OperationType.CREATE, form ? `bookingForms/${form.id}` : 'bookingForms');
    } finally {
      setIsSaving(false);
    }
  };

  const addCustomField = () => {
    const field: BookingFormCustomField = {
      id: crypto.randomUUID(),
      label: 'New field',
      type: 'text',
      required: false,
    };
    patch({ customFields: [...draft.customFields, field] });
  };

  const updateCustomField = (id: string, updates: Partial<BookingFormCustomField>) => {
    patch({
      customFields: draft.customFields.map(f => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const removeCustomField = (id: string) => {
    patch({ customFields: draft.customFields.filter(f => f.id !== id) });
  };

  const addPeriod = () => {
    if (!newPeriodStart || !newPeriodEnd || newPeriodEnd <= newPeriodStart) {
      setError('Please select a valid start and end date for the period.');
      return;
    }
    const period: BookingFormDatePeriod = { startDate: newPeriodStart, endDate: newPeriodEnd };
    if (periodTab === 'unavailable') {
      patch({ unavailablePeriods: [...draft.unavailablePeriods, period] });
    } else {
      patch({ availablePeriods: [...draft.availablePeriods, period] });
    }
    setNewPeriodStart('');
    setNewPeriodEnd('');
    setError(null);
  };

  const removePeriod = (index: number, kind: 'unavailable' | 'available') => {
    if (kind === 'unavailable') {
      patch({ unavailablePeriods: draft.unavailablePeriods.filter((_, i) => i !== index) });
    } else {
      patch({ availablePeriods: draft.availablePeriods.filter((_, i) => i !== index) });
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-bold text-gray-900 flex-1 truncate">
          {isNew ? 'New booking form' : draft.name || 'Edit form'}
        </h3>
      </div>

      <div className="flex overflow-x-auto border-b border-gray-100 -mx-1 px-1">
        {FORM_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0',
              tab === t.id ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'information' && (
          <>
            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={draft.name}
                onChange={e => patch({ name: e.target.value, slug: slugify(e.target.value) })}
                placeholder="e.g. Pachamama Coliving"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Accommodation units</label>
                <button type="button" onClick={selectAllAccommodations} className="text-[10px] font-bold text-blue-600 hover:underline">
                  Select all
                </button>
              </div>
              <div className="space-y-1 border border-gray-200 rounded-2xl overflow-hidden">
                {groups.length === 0 ? (
                  <p className="text-xs text-gray-400 italic p-4">No rooms found. Add rooms in Settings and group them in Room Pricing.</p>
                ) : (
                  groups.map(group => {
                    const isExpanded = expandedGroups.has(group.anchorId);
                    const displayName = groupDisplayName(group, pricingById);
                    const checked = draft.accommodationIds.includes(group.anchorId);
                    return (
                      <div key={group.anchorId} className="border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAccommodation(group.anchorId)}
                            className="rounded border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedGroups(prev => {
                                const next = new Set(prev);
                                if (next.has(group.anchorId)) next.delete(group.anchorId);
                                else next.add(group.anchorId);
                                return next;
                              });
                            }}
                            className="flex-1 flex items-center justify-between text-left min-w-0"
                          >
                            <span className="text-xs font-bold text-gray-800 truncate">{displayName}</span>
                            <ChevronDown size={14} className={cn('shrink-0 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                          <span className="text-[10px] text-gray-400 shrink-0">{group.rooms.length} unit{group.rooms.length === 1 ? '' : 's'}</span>
                        </div>
                        {isExpanded && (
                          <div className="px-3 py-2 bg-white space-y-1">
                            {group.rooms.map(r => (
                              <p key={r.id} className="text-[11px] text-gray-500 pl-6">{r.name}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>Extras</label>
              <p className="text-xs text-gray-400 italic p-4 border border-dashed border-gray-200 rounded-xl">
                Extras can be configured in the Extras section. Once created, they will appear here for selection.
              </p>
            </div>
          </>
        )}

        {tab === 'customFields' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Custom guest fields shown during checkout.</p>
              <button type="button" onClick={addCustomField} className="text-xs font-bold text-black hover:underline">
                + Add field
              </button>
            </div>
            {draft.customFields.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">No custom fields yet.</p>
            ) : (
              draft.customFields.map(field => (
                <div key={field.id} className="p-3 border border-gray-200 rounded-xl space-y-2 bg-white">
                  <div className="flex gap-2">
                    <input
                      className={cn(inputClass, 'flex-1')}
                      value={field.label}
                      onChange={e => updateCustomField(field.id, { label: e.target.value })}
                      placeholder="Field label"
                    />
                    <select
                      className={cn(inputClass, 'w-28')}
                      value={field.type}
                      onChange={e => updateCustomField(field.id, { type: e.target.value as BookingFormCustomField['type'] })}
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Long text</option>
                      <option value="select">Select</option>
                    </select>
                    <button type="button" onClick={() => removeCustomField(field.id)} className="p-2 text-gray-400 hover:text-rose-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {field.type === 'select' && (
                    <input
                      className={inputClass}
                      value={(field.options ?? []).join(', ')}
                      onChange={e => updateCustomField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="Options, comma-separated"
                    />
                  )}
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <input
                      type="checkbox"
                      checked={!!field.required}
                      onChange={e => updateCustomField(field.id, { required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'payments' && (
          <div className="space-y-3">
            <CheckboxRow
              label="Charge payment upfront"
              checked={draft.chargeUpfront}
              onChange={v => patch({ chargeUpfront: v })}
            />
            <CheckboxRow
              label="Save card details"
              description="Card details are stored securely. Charge manually after screening guests."
              checked={draft.saveCardDetails}
              onChange={v => patch({ saveCardDetails: v })}
            />
            <div>
              <label className={labelClass}>Cancellation & refund policies</label>
              <input
                className={inputClass}
                value={draft.cancellationPolicyUrl}
                onChange={e => patch({ cancellationPolicyUrl: e.target.value })}
                placeholder="https://pachamamaretreat.me/terms-policies"
              />
            </div>
          </div>
        )}

        {tab === 'restrictions' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Min. stay nights</label>
                <input type="number" min={1} className={inputClass} value={draft.minNights} onChange={e => patch({ minNights: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div>
                <label className={labelClass}>Max. stay nights</label>
                <input type="number" min={1} className={inputClass} value={draft.maxNights} onChange={e => patch({ maxNights: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div>
                <label className={labelClass}>Min. booking in advance (days)</label>
                <input type="number" min={0} className={inputClass} value={draft.minAdvanceDays} onChange={e => patch({ minAdvanceDays: Math.max(0, parseInt(e.target.value) || 0) })} />
              </div>
              <div>
                <label className={labelClass}>Max. booking in advance (days)</label>
                <input type="number" min={1} className={inputClass} value={draft.maxAdvanceDays} onChange={e => patch({ maxAdvanceDays: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
            </div>

            <WeekdayPicker label="Check-in weekday" value={draft.checkInDays} onChange={days => patch({ checkInDays: days })} />
            <WeekdayPicker label="Check-out weekday" value={draft.checkOutDays} onChange={days => patch({ checkOutDays: days })} />

            <div>
              <label className={labelClass}>Check-in month day</label>
              <div className="flex gap-3">
                {[1, 15].map(day => (
                  <label key={day} className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.checkInMonthDays.includes(day)}
                      onChange={e => {
                        const days = e.target.checked
                          ? [...draft.checkInMonthDays, day]
                          : draft.checkInMonthDays.filter(d => d !== day);
                        patch({ checkInMonthDays: days });
                      }}
                    />
                    {day === 1 ? '1st of the month' : '15th of the month'}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Check-out month day</label>
              <div className="flex gap-3">
                {[1, 15].map(day => (
                  <label key={day} className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.checkOutMonthDays.includes(day)}
                      onChange={e => {
                        const days = e.target.checked
                          ? [...draft.checkOutMonthDays, day]
                          : draft.checkOutMonthDays.filter(d => d !== day);
                        patch({ checkOutMonthDays: days });
                      }}
                    />
                    {day === 1 ? '1st of the month' : '15th of the month'}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fixed check-in</label>
                <DatePicker value={draft.fixedCheckIn} onChange={v => patch({ fixedCheckIn: v })} placeholder="Optional" />
              </div>
              <div>
                <label className={labelClass}>Fixed check-out</label>
                <DatePicker value={draft.fixedCheckOut} min={draft.fixedCheckIn} onChange={v => patch({ fixedCheckOut: v })} placeholder="Optional" />
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setPeriodTab('available')}
                  className={cn('flex-1 py-2 text-xs font-bold', periodTab === 'available' ? 'bg-gray-100 text-black' : 'text-gray-400')}
                >
                  Available periods
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodTab('unavailable')}
                  className={cn('flex-1 py-2 text-xs font-bold', periodTab === 'unavailable' ? 'bg-gray-100 text-black' : 'text-gray-400')}
                >
                  Unavailable periods
                </button>
              </div>
              <div className="p-4 space-y-3">
                {(periodTab === 'unavailable' ? draft.unavailablePeriods : draft.availablePeriods).length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    {periodTab === 'unavailable' ? 'No unavailable periods. All dates are bookable.' : 'No available periods set.'}
                  </p>
                ) : (
                  (periodTab === 'unavailable' ? draft.unavailablePeriods : draft.availablePeriods).map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-gray-700">{p.startDate} → {p.endDate}</span>
                      <button type="button" onClick={() => removePeriod(i, periodTab)} className="text-rose-500 font-bold">Remove</button>
                    </div>
                  ))
                )}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <DatePicker value={newPeriodStart} onChange={setNewPeriodStart} placeholder="Start" />
                  <DatePicker value={newPeriodEnd} min={newPeriodStart} onChange={setNewPeriodEnd} placeholder="End" />
                </div>
                <button type="button" onClick={addPeriod} className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 hover:border-gray-400">
                  Add period
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'appearance' && (
          <div className="space-y-2">
            <CheckboxRow label="Hide availability calendar" checked={draft.hideAvailabilityCalendar} onChange={v => patch({ hideAvailabilityCalendar: v })} />
            <CheckboxRow label="Hide guest address" checked={draft.hideGuestAddress} onChange={v => patch({ hideGuestAddress: v })} />
            <CheckboxRow label="Hide coupon form" checked={draft.hideCouponForm} onChange={v => patch({ hideCouponForm: v })} />
            <CheckboxRow label="Open the availability calendar by default" checked={draft.openCalendarByDefault} onChange={v => patch({ openCalendarByDefault: v })} />
            <CheckboxRow label="Hide availability calendar on mobile" checked={draft.hideCalendarOnMobile} onChange={v => patch({ hideCalendarOnMobile: v })} />
            <CheckboxRow label="Hide accommodations until search" checked={draft.hideAccommodationsUntilSearch} onChange={v => patch({ hideAccommodationsUntilSearch: v })} />
          </div>
        )}

        {tab === 'advanced' && (
          <div className="space-y-4">
            <CheckboxRow
              label="Can book multiple periods"
              description="Allow guests to book multiple periods in one checkout."
              checked={draft.canBookMultiplePeriods}
              onChange={v => patch({ canBookMultiplePeriods: v })}
            />
            {draft.canBookMultiplePeriods && (
              <div className="w-40">
                <label className={labelClass}>Min. nights per period</label>
                <input type="number" min={1} className={inputClass} value={draft.minNightsPerPeriod} onChange={e => patch({ minNightsPerPeriod: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
            )}
            <CheckboxRow
              label="Allow booking request"
              description="Guests send a request instead of booking directly. You approve manually."
              checked={draft.allowBookingRequest}
              onChange={v => patch({ allowBookingRequest: v })}
            />
            <div>
              <label className={labelClass}>Important booking information (optional)</label>
              <p className="text-[10px] text-gray-400 mb-1">Shown above the Book Now button on the public site.</p>
              <textarea
                className={cn(inputClass, 'min-h-[120px] resize-y')}
                value={draft.importantBookingInfo}
                onChange={e => patch({ importantBookingInfo: e.target.value })}
                placeholder="Before booking, please note: ..."
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      <button
        type="button"
        disabled={isSaving}
        onClick={handleSave}
        className="w-full py-3 bg-black text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-gray-800 transition-colors"
      >
        <Save size={14} /> {isSaving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
