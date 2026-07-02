import { useState, useEffect, useMemo, useRef } from 'react';
import DatePicker from '@/components/ui/DatePicker';
import { Retreat, RetreatType, VenueHire } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { Trash2, Save, Plus, X, AlertTriangle, Pencil, ChevronDown } from 'lucide-react';
import { findPeriodOverlapError } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface RunDraft {
  startDate: string;
  endDate: string;
  facilitator: string;
}

interface RetreatProgramsPanelProps {
  retreats: Retreat[];
  retreatTypes: RetreatType[];
  venueHires: VenueHire[];
  focusRunId?: string | null;
  startAdding?: boolean;
  onFocusHandled?: () => void;
}

const EMPTY_RUN: RunDraft = { startDate: '', endDate: '', facilitator: '' };

export default function RetreatProgramsPanel({
  retreats,
  retreatTypes,
  venueHires,
  focusRunId,
  startAdding,
  onFocusHandled,
}: RetreatProgramsPanelProps) {
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [isAddingProgram, setIsAddingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [programNameDraft, setProgramNameDraft] = useState('');
  const [addingRunForProgramId, setAddingRunForProgramId] = useState<string | null>(null);
  const [addRuns, setAddRuns] = useState<RunDraft[]>([{ ...EMPTY_RUN }]);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RunDraft>(EMPTY_RUN);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteProgramId, setConfirmDeleteProgramId] = useState<string | null>(null);
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const focusRef = useRef<HTMLDivElement | null>(null);

  const runsByProgram = useMemo(() => {
    const map = new Map<string, Retreat[]>();
    for (const type of retreatTypes) {
      map.set(type.id, []);
    }
    for (const run of retreats) {
      const list = map.get(run.retreatTypeId);
      if (list) {
        list.push(run);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return map;
  }, [retreats, retreatTypes]);

  useEffect(() => {
    if (!focusRunId) return;
    const run = retreats.find(r => r.id === focusRunId);
    if (!run) {
      onFocusHandled?.();
      return;
    }
    const program = retreatTypes.find(p => p.id === run.retreatTypeId);
    setExpandedProgramId(run.retreatTypeId);
    setProgramNameDraft(program?.name ?? run.name ?? '');
    setEditingRunId(run.id);
    setEditDraft({
      startDate: run.startDate,
      endDate: run.endDate,
      facilitator: run.facilitator,
    });
    setAddingRunForProgramId(null);
    setIsAddingProgram(false);
    setError(null);
    onFocusHandled?.();
    requestAnimationFrame(() => {
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [focusRunId, retreats, retreatTypes, onFocusHandled]);

  useEffect(() => {
    if (!startAdding) return;
    setIsAddingProgram(false);
    setEditingRunId(null);
    setError(null);
    if (retreatTypes.length === 0) {
      setIsAddingProgram(true);
      setNewProgramName('');
    } else {
      const firstId = retreatTypes[0].id;
      setExpandedProgramId(firstId);
      setProgramNameDraft(retreatTypes[0].name);
      setAddingRunForProgramId(firstId);
      setAddRuns([{ ...EMPTY_RUN }]);
    }
    onFocusHandled?.();
  }, [startAdding, retreatTypes, onFocusHandled]);

  const expandProgram = (program: RetreatType) => {
    setExpandedProgramId(program.id);
    setProgramNameDraft(program.name);
    setAddingRunForProgramId(null);
    setEditingRunId(null);
    setIsAddingProgram(false);
    setConfirmDeleteProgramId(null);
    setConfirmDeleteRunId(null);
    setError(null);
  };

  const collapseProgram = () => {
    setExpandedProgramId(null);
    setAddingRunForProgramId(null);
    setEditingRunId(null);
    setConfirmDeleteProgramId(null);
    setConfirmDeleteRunId(null);
    setError(null);
  };

  const handleCreateProgram = async () => {
    const name = newProgramName.trim();
    if (!name) {
      setError('Please enter a retreat program name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const ref = await addDoc(collection(db, 'retreatTypes'), { name });
      setIsAddingProgram(false);
      setNewProgramName('');
      setExpandedProgramId(ref.id);
      setProgramNameDraft(name);
      setAddingRunForProgramId(ref.id);
      setAddRuns([{ ...EMPTY_RUN }]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'retreatTypes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProgramName = async (programId: string) => {
    const name = programNameDraft.trim();
    if (!name) {
      setError('Program name cannot be empty.');
      return;
    }
    const program = retreatTypes.find(p => p.id === programId);
    if (!program || program.name === name) return;

    setIsSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'retreatTypes', programId), { name });
      const runs = runsByProgram.get(programId) ?? [];
      if (runs.length > 0) {
        const batch = writeBatch(db);
        runs.forEach(run => {
          batch.update(doc(db, 'retreats', run.id), { name, updatedAt: new Date().toISOString() });
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `retreatTypes/${programId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const runsSnap = await getDocs(query(collection(db, 'retreats'), where('retreatTypeId', '==', programId)));
      const batch = writeBatch(db);
      runsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'retreatTypes', programId));
      await batch.commit();
      setConfirmDeleteProgramId(null);
      if (expandedProgramId === programId) collapseProgram();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `retreatTypes/${programId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateAddRun = (index: number, field: keyof RunDraft, value: string) => {
    const next = [...addRuns];
    next[index] = { ...next[index], [field]: value };
    if (field === 'startDate' && next[index].endDate && value >= next[index].endDate) {
      next[index].endDate = '';
    }
    setAddRuns(next);
    setError(null);
  };

  const validateRuns = (runsToValidate: RunDraft[], programId: string, excludeRunId?: string) => {
    for (let i = 0; i < runsToValidate.length; i++) {
      const run = runsToValidate[i];
      if (!run.startDate || !run.endDate) {
        return runsToValidate.length > 1
          ? `Run ${i + 1}: Please select start and end dates.`
          : 'Please select start and end dates.';
      }
      if (run.endDate <= run.startDate) {
        return runsToValidate.length > 1
          ? `Run ${i + 1}: End date must be after start date.`
          : 'End date must be after start date.';
      }
      if (!run.facilitator.trim()) {
        return runsToValidate.length > 1
          ? `Run ${i + 1}: Please enter a facilitator.`
          : 'Please enter a facilitator.';
      }
      const overlapMsg = findPeriodOverlapError(run.startDate, run.endDate, {
        retreats,
        venueHires,
        excludeRetreatId: excludeRunId,
        siblingRuns: runsToValidate,
        excludeSiblingIndex: i,
      });
      if (overlapMsg) {
        return runsToValidate.length > 1 ? `Run ${i + 1}: ${overlapMsg}` : overlapMsg;
      }
    }
    return null;
  };

  const handleSaveNewRuns = async (programId: string) => {
    const program = retreatTypes.find(p => p.id === programId);
    if (!program) return;

    const validationError = validateRuns(addRuns, programId);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      for (const run of addRuns) {
        await addDoc(collection(db, 'retreats'), {
          retreatTypeId: program.id,
          name: program.name,
          startDate: run.startDate,
          endDate: run.endDate,
          facilitator: run.facilitator.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      setAddingRunForProgramId(null);
      setAddRuns([{ ...EMPTY_RUN }]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'retreats');
    } finally {
      setIsSaving(false);
    }
  };

  const editingRun = editingRunId ? retreats.find(r => r.id === editingRunId) : null;

  const editOverlap = useMemo(() => {
    if (!editingRun || !editDraft.startDate || !editDraft.endDate) return null;
    return findPeriodOverlapError(editDraft.startDate, editDraft.endDate, {
      retreats,
      venueHires,
      excludeRetreatId: editingRun.id,
    });
  }, [editDraft, editingRun, retreats, venueHires]);

  const canSaveEdit = !!(
    editingRun
    && editDraft.startDate
    && editDraft.endDate
    && editDraft.endDate > editDraft.startDate
    && editDraft.facilitator.trim()
    && !editOverlap
  );

  const handleSaveRunEdit = async () => {
    if (!editingRun || !canSaveEdit) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'retreats', editingRun.id), {
        startDate: editDraft.startDate,
        endDate: editDraft.endDate,
        facilitator: editDraft.facilitator.trim(),
        updatedAt: new Date().toISOString(),
      });
      setEditingRunId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `retreats/${editingRun.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'retreats', runId));
      setConfirmDeleteRunId(null);
      if (editingRunId === runId) setEditingRunId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `retreats/${runId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditRun = (run: Retreat) => {
    setEditingRunId(run.id);
    setEditDraft({
      startDate: run.startDate,
      endDate: run.endDate,
      facilitator: run.facilitator,
    });
    setAddingRunForProgramId(null);
    setConfirmDeleteRunId(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {!isAddingProgram && (
        <button
          type="button"
          onClick={() => {
            setIsAddingProgram(true);
            setNewProgramName('');
            setError(null);
            collapseProgram();
          }}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> Add retreat program
        </button>
      )}

      {isAddingProgram && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
          <label className="block text-[10px] font-bold uppercase text-gray-400">New program name</label>
          <input
            autoFocus
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none text-sm font-bold"
            placeholder="e.g. Waves & Wonders"
            value={newProgramName}
            onChange={e => setNewProgramName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setIsAddingProgram(false); setNewProgramName(''); }}
              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !newProgramName.trim()}
              onClick={handleCreateProgram}
              className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isSaving ? 'Creating…' : 'Create & add runs'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
          <span className="text-xs font-bold text-rose-700">{error}</span>
        </div>
      )}

      {retreatTypes.length === 0 && !isAddingProgram ? (
        <p className="text-xs text-gray-400 italic py-6 text-center">No retreat programs yet. Add one to schedule calendar runs.</p>
      ) : (
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
          {retreatTypes.map(program => {
            const runs = runsByProgram.get(program.id) ?? [];
            const isExpanded = expandedProgramId === program.id;

            return (
              <div
                key={program.id}
                className={cn(
                  'border rounded-2xl transition-all overflow-hidden',
                  isExpanded ? 'border-gray-300 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white',
                )}
              >
                {!isExpanded ? (
                  <button
                    type="button"
                    onClick={() => expandProgram(program)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{program.name}</p>
                      <p className="text-xs text-gray-500">
                        {runs.length === 0
                          ? 'No runs scheduled'
                          : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
                      Edit <ChevronDown size={14} />
                    </span>
                  </button>
                ) : (
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Program name</label>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-black outline-none"
                            value={programNameDraft}
                            onChange={e => setProgramNameDraft(e.target.value)}
                          />
                          {programNameDraft.trim() !== program.name && (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleUpdateProgramName(program.id)}
                              className="px-3 py-2 bg-black text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={collapseProgram}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg"
                        title="Collapse"
                      >
                        <ChevronDown size={16} className="rotate-180" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Runs</p>

                      {runs.length === 0 && addingRunForProgramId !== program.id && (
                        <p className="text-xs text-gray-400 italic py-2">No runs yet for this program.</p>
                      )}

                      {runs.map(run => {
                        const isEditing = editingRunId === run.id;
                        return (
                          <div
                            key={run.id}
                            ref={run.id === editingRunId ? focusRef : undefined}
                            className={cn(
                              'rounded-xl border bg-white',
                              isEditing ? 'border-black' : 'border-gray-200',
                            )}
                          >
                            {!isEditing ? (
                              <div className="flex items-center justify-between gap-2 p-3">
                                <p className="text-xs text-gray-700">
                                  <span className="font-bold">{run.startDate} → {run.endDate}</span>
                                  <span className="text-gray-400"> · </span>
                                  {run.facilitator}
                                </p>
                                <div className="flex items-center gap-1 shrink-0">
                                  {confirmDeleteRunId === run.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRun(run.id)}
                                        className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-lg"
                                      >
                                        Delete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteRunId(null)}
                                        className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditRun(run)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteRunId(run.id)}
                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold uppercase text-gray-400 mb-1">Start</label>
                                    <DatePicker
                                      value={editDraft.startDate}
                                      onChange={val => {
                                        setEditDraft(prev => {
                                          const next = { ...prev, startDate: val };
                                          if (prev.endDate && val >= prev.endDate) next.endDate = '';
                                          return next;
                                        });
                                        setError(null);
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold uppercase text-gray-400 mb-1">End</label>
                                    <DatePicker
                                      value={editDraft.endDate}
                                      min={editDraft.startDate ? new Date(new Date(editDraft.startDate).getTime() + 86400000).toISOString().split('T')[0] : ''}
                                      defaultMonth={editDraft.startDate || undefined}
                                      onChange={val => setEditDraft(prev => ({ ...prev, endDate: val }))}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold uppercase text-gray-400 mb-1">Facilitator</label>
                                  <input
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none"
                                    value={editDraft.facilitator}
                                    onChange={e => setEditDraft(prev => ({ ...prev, facilitator: e.target.value }))}
                                  />
                                </div>
                                {editOverlap && (
                                  <p className="text-xs font-bold text-rose-600">{editOverlap}</p>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingRunId(null)}
                                    className="px-3 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canSaveEdit || isSaving}
                                    onClick={handleSaveRunEdit}
                                    className="flex-1 py-2 bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                  >
                                    <Save size={13} /> {isSaving ? 'Saving…' : 'Save run'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {addingRunForProgramId === program.id ? (
                        <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-3">
                          {addRuns.map((run, index) => (
                            <div key={index} className="space-y-3 relative">
                              {addRuns.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setAddRuns(addRuns.filter((_, i) => i !== index))}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-white border shadow-sm rounded-full flex items-center justify-center text-gray-400 hover:text-rose-500"
                                >
                                  <X size={10} />
                                </button>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-bold uppercase text-gray-400 mb-1">Start</label>
                                  <DatePicker value={run.startDate} onChange={val => updateAddRun(index, 'startDate', val)} />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold uppercase text-gray-400 mb-1">End</label>
                                  <DatePicker
                                    value={run.endDate}
                                    min={run.startDate ? new Date(new Date(run.startDate).getTime() + 86400000).toISOString().split('T')[0] : ''}
                                    defaultMonth={run.startDate || undefined}
                                    onChange={val => updateAddRun(index, 'endDate', val)}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold uppercase text-gray-400 mb-1">Facilitator</label>
                                <input
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none"
                                  placeholder="e.g. Zoe & Pasha"
                                  value={run.facilitator}
                                  onChange={e => updateAddRun(index, 'facilitator', e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setAddRuns([...addRuns, { ...EMPTY_RUN }])}
                            className="w-full py-2 flex items-center justify-center gap-1 border border-dashed border-gray-300 rounded-xl text-[10px] font-bold text-gray-500"
                          >
                            <Plus size={12} /> Add another run
                          </button>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setAddingRunForProgramId(null); setAddRuns([{ ...EMPTY_RUN }]); }}
                              className="px-3 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveNewRuns(program.id)}
                              className="flex-1 py-2 bg-black text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                              {isSaving ? 'Saving…' : `Save ${addRuns.length} run${addRuns.length > 1 ? 's' : ''}`}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingRunForProgramId(program.id);
                            setAddRuns([{ ...EMPTY_RUN }]);
                            setEditingRunId(null);
                            setError(null);
                          }}
                          className="w-full py-2 flex items-center justify-center gap-1 border border-dashed border-gray-300 rounded-xl text-[10px] font-bold text-gray-500 hover:border-gray-400 hover:text-gray-700"
                        >
                          <Plus size={12} /> Add run
                        </button>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      {confirmDeleteProgramId === program.id ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-600">
                            Delete program{runs.length > 0 ? ` and ${runs.length} run${runs.length === 1 ? '' : 's'}` : ''}?
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProgramId(null)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleDeleteProgram(program.id)}
                              className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProgramId(program.id)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700"
                        >
                          Delete program
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
