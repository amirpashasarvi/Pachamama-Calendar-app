import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Retreat, RetreatType } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Save, Plus, X, AlertTriangle } from 'lucide-react';
import { useBooking } from '@/hooks/useBooking';
import { findPeriodOverlapError } from '@/lib/utils';

interface RetreatModalProps {
  isOpen: boolean;
  onClose: () => void;
  retreat?: Retreat | null;
}

interface Run {
  startDate: string;
  endDate: string;
  facilitator: string;
}

export default function RetreatModal({ isOpen, onClose, retreat }: RetreatModalProps) {
  const { retreatTypes, retreats, venueHires } = useBooking();
  const [retreatTypeId, setRetreatTypeId] = useState<string>('');
  const [runs, setRuns] = useState<Run[]>([{ startDate: '', endDate: '', facilitator: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (retreat) {
      setRetreatTypeId(retreat.retreatTypeId);
      setRuns([{ 
        startDate: retreat.startDate, 
        endDate: retreat.endDate, 
        facilitator: retreat.facilitator 
      }]);
    } else {
      setRetreatTypeId('');
      setRuns([{ startDate: '', endDate: '', facilitator: '' }]);
    }
    setError(null);
    setShowConfirmDelete(false);
    setIsDeleting(false);
  }, [retreat, isOpen]);

  useEffect(() => {
    if (!showConfirmDelete) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowConfirmDelete(false); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showConfirmDelete]);

  const handleAddRun = () => {
    setRuns([...runs, { startDate: '', endDate: '', facilitator: '' }]);
  };

  const handleRemoveRun = (index: number) => {
    if (runs.length > 1) {
      setRuns(runs.filter((_, i) => i !== index));
    }
  };

  const updateRun = (index: number, field: keyof Run, value: string) => {
    const newRuns = [...runs];
    newRuns[index] = { ...newRuns[index], [field]: value };
    if (field === 'startDate') {
      if (newRuns[index].endDate && value >= newRuns[index].endDate) {
        newRuns[index].endDate = '';
      }
    }
    setRuns(newRuns);
    setError(null);
  };

  const overlapWarning = useMemo(() => {
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (!run.startDate || !run.endDate) continue;
      const msg = findPeriodOverlapError(run.startDate, run.endDate, {
        retreats,
        venueHires,
        excludeRetreatId: retreat?.id,
        siblingRuns: runs,
        excludeSiblingIndex: i,
      });
      if (msg) {
        return runs.length > 1 ? `Run ${i + 1}: ${msg}` : msg;
      }
    }
    return null;
  }, [runs, retreats, venueHires, retreat?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!retreatTypeId) return;

    const selectedType = retreatTypes.find(t => t.id === retreatTypeId);
    if (!selectedType) return;

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (!run.startDate || !run.endDate) continue;
      const overlapMsg = findPeriodOverlapError(run.startDate, run.endDate, {
        retreats,
        venueHires,
        excludeRetreatId: retreat?.id,
        siblingRuns: runs,
        excludeSiblingIndex: i,
      });
      if (overlapMsg) {
        setError(runs.length > 1 ? `Run ${i + 1}: ${overlapMsg}` : overlapMsg);
        return;
      }
    }

    try {
      if (retreat?.id) {
        // Edit single run
        const run = runs[0];
        await updateDoc(doc(db, 'retreats', retreat.id), {
          startDate: run.startDate,
          endDate: run.endDate,
          facilitator: run.facilitator,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create multiple runs
        for (const run of runs) {
          await addDoc(collection(db, 'retreats'), {
            retreatTypeId: selectedType.id,
            name: selectedType.name,
            startDate: run.startDate,
            endDate: run.endDate,
            facilitator: run.facilitator,
            createdAt: new Date().toISOString()
          });
        }
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, retreat?.id ? OperationType.UPDATE : OperationType.CREATE, retreat?.id ? `retreats/${retreat.id}` : 'retreats');
    }
  };

  const handleDelete = async () => {
    if (!retreat?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'retreats', retreat.id));
      setShowConfirmDelete(false);
      onClose();
    } catch (err) {
      setIsDeleting(false);
      setShowConfirmDelete(false);
      handleFirestoreError(err, OperationType.DELETE, `retreats/${retreat.id}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={retreat ? 'Edit Retreat Run' : 'Add Retreat Programs'}>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Select Retreat Type</label>
          {retreat ? (
            <div className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold text-gray-900 border-gray-200">
              {retreat.name}
            </div>
          ) : (
            <select
              required
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900 border-gray-200 appearance-none cursor-pointer"
              value={retreatTypeId}
              onChange={e => setRetreatTypeId(e.target.value)}
            >
              <option value="">Select Retreat...</option>
              {retreatTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Retreat Runs</label>
          <div className="space-y-3">
            {runs.map((run, index) => (
              <div key={index} className="p-4 bg-gray-50 border rounded-2xl relative group animate-in fade-in slide-in-from-top-2 duration-200">
                {!retreat && runs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRun(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white border shadow-sm rounded-full flex items-center justify-center text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors z-10"
                  >
                    <X size={14} />
                  </button>
                )}
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">Start Date</label>
                    <DatePicker 
                      value={run.startDate}
                      onChange={val => updateRun(index, 'startDate', val)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">End Date</label>
                    <DatePicker 
                      value={run.endDate}
                      min={run.startDate ? new Date(new Date(run.startDate).getTime() + 86400000).toISOString().split('T')[0] : ''}
                      onChange={val => updateRun(index, 'endDate', val)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">Facilitator / Host</label>
                  <input 
                    required
                    placeholder="e.g. Zoe & Pasha"
                    className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    value={run.facilitator}
                    onChange={e => updateRun(index, 'facilitator', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {!retreat && (
            <button
              type="button"
              onClick={handleAddRun}
              className="w-full py-3 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-xs font-bold"
            >
              <Plus size={16} /> Add Another Run
            </button>
          )}
        </div>

        {(overlapWarning || error) && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-rose-700">{error || overlapWarning}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-6 border-t">
          {retreat && (
            <button 
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm font-bold"
            >
              <Trash2 size={16} /> Delete Run
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!retreatTypeId || !!overlapWarning}
              className="flex items-center gap-2 px-8 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {retreat ? 'Update' : `Create ${runs.length} Retreat${runs.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </form>

      {showConfirmDelete && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          onMouseDown={() => !isDeleting && setShowConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 mb-5">
              <h3 className="text-base font-bold text-gray-900">Delete this retreat run?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">{retreat?.name}</span> ({retreat?.startDate} to {retreat?.endDate}) will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {isDeleting ? 'Deleting…' : 'Delete Retreat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
