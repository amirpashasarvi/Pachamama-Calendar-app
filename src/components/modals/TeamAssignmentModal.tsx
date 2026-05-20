import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { TeamAssignment, TeamPosition } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Save, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TeamAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: TeamAssignment | null;
  initialData?: Partial<TeamAssignment>;
  positions: TeamPosition[];
  isAdmin: boolean;
}

export default function TeamAssignmentModal({ 
  isOpen, 
  onClose, 
  assignment, 
  initialData, 
  positions,
  isAdmin
}: TeamAssignmentModalProps) {
  const DEFAULT_FORM_STATE = {
    positionId: '',
    name: '',
    email: '',
    phone: '',
    contactChannel: 'WhatsApp' as TeamAssignment['contactChannel'],
    roomNotes: '',
    startDate: '',
    endDate: '',
  };

  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    setShowConfirmDelete(false);
    if (assignment) {
      setFormData({
        positionId: assignment.positionId,
        name: assignment.name,
        email: assignment.email,
        phone: assignment.phone,
        contactChannel: assignment.contactChannel,
        roomNotes: assignment.roomNotes,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      });
    } else if (isOpen) {
      if (initialData) {
        setFormData({
          ...DEFAULT_FORM_STATE,
          positionId: initialData.positionId || '',
          startDate: initialData.startDate || '',
          endDate: initialData.endDate || '',
        });
      } else {
        setFormData(DEFAULT_FORM_STATE);
      }
    }
  }, [assignment, initialData, isOpen]);

  const handleSave = async () => {
    if (!formData.positionId || !formData.name) return;

    const matchedPosition = positions.find(p => p.id === formData.positionId);
    
    const data = {
      ...formData,
      positionName: matchedPosition?.name || '',
      updatedAt: new Date().toISOString(),
    };

    try {
      if (assignment) {
        await updateDoc(doc(db, 'teamAssignments', assignment.id), data);
      } else {
        await addDoc(collection(db, 'teamAssignments'), {
          ...data,
          createdAt: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, assignment ? OperationType.UPDATE : OperationType.CREATE, `teamAssignments/${assignment?.id || ''}`);
    }
  };

  const handleDelete = async () => {
    if (!assignment) return;

    try {
      await deleteDoc(doc(db, 'teamAssignments', assignment.id));
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `teamAssignments/${assignment.id}`);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={assignment ? 'Edit Team Assignment' : 'Add Team Assignment'}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Position</label>
            <select
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50"
              value={formData.positionId}
              onChange={e => setFormData({ ...formData, positionId: e.target.value })}
              disabled={(!isAdmin && !!assignment) || (!!initialData?.positionId && !assignment)}
            >
              <option value="">Select Position...</option>
              {positions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Person's Name</label>
            <input
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Maria Clara"
              disabled={!isAdmin && !!assignment}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              disabled={!isAdmin && !!assignment}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Phone</label>
            <input
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+34..."
              disabled={!isAdmin && !!assignment}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Contact Channel</label>
            <select
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={formData.contactChannel}
              onChange={e => setFormData({ ...formData, contactChannel: e.target.value as any })}
              disabled={!isAdmin && !!assignment}
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
              <option value="Telegram">Telegram</option>
              <option value="Signal">Signal</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Accommodation Notes</label>
            <input
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.roomNotes}
              onChange={e => setFormData({ ...formData, roomNotes: e.target.value })}
              placeholder="Room 2, etc."
              disabled={!isAdmin && !!assignment}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Start Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              disabled={!isAdmin && !!assignment}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">End Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
              disabled={!isAdmin && !!assignment}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 pt-4">
            {!showConfirmDelete ? (
              <>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95"
                >
                  <Save size={18} /> {assignment ? 'Update Assignment' : 'Save Assignment'}
                </button>
                {assignment && (
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all active:scale-95"
                    title="Delete Assignment"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </>
            ) : (
              <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-[2] py-3 bg-rose-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-rose-700 transition-all active:scale-95"
                >
                  <Trash2 size={18} /> Confirm Delete
                </button>
              </div>
            )}
          </div>
        )}

        {!isAdmin && (
          <div className="pt-4">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
