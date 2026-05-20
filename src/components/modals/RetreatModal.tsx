import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Retreat, RetreatType } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Save, Plus, X } from 'lucide-react';
import { useBooking } from '@/hooks/useBooking';

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
  const { retreatTypes } = useBooking();
  const [retreatTypeId, setRetreatTypeId] = useState<string>('');
  const [runs, setRuns] = useState<Run[]>([{ startDate: '', endDate: '', facilitator: '' }]);

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
  }, [retreat, isOpen]);

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
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retreatTypeId) return;

    const selectedType = retreatTypes.find(t => t.id === retreatTypeId);
    if (!selectedType) return;

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
    if (!retreat?.id || !confirm('Delete this retreat run?')) return;
    try {
      await deleteDoc(doc(db, 'retreats', retreat.id));
      onClose();
    } catch (err) {
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

        <div className="flex items-center justify-between pt-6 border-t">
          {retreat && (
            <button 
              type="button"
              onClick={handleDelete}
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
              disabled={!retreatTypeId}
              className="flex items-center gap-2 px-8 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {retreat ? 'Update' : `Create ${runs.length} Retreat${runs.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
