import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { db, handleFirestoreError, OperationType, auth } from '@/services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Save, Mail, Shield, User } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
    }
  }, [profile, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), {
        name: name
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `profiles/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!profile?.email) return;
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (error) {
      console.error('Password reset error:', error);
      alert('Failed to send password reset email.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings">
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Display Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              required
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 border-gray-200 transition-all"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name..."
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input
              disabled
              className="w-full pl-12 pr-4 py-3 bg-gray-100 border rounded-xl font-medium text-gray-400 border-gray-200 cursor-not-allowed"
              value={profile?.email || ''}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Account Role</label>
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Shield size={18} className="text-blue-500" />
            <span className="text-sm font-bold text-blue-700 uppercase tracking-tight">{profile?.role}</span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
          <button
            type="button"
            onClick={handlePasswordReset}
            className="w-full py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
          >
            Change Password
          </button>
          {resetSent && (
            <p className="mt-2 text-[10px] font-bold text-green-600 text-center animate-in fade-in slide-in-from-top-1">
              Password reset email sent!
            </p>
          )}
        </div>

        <div className="pt-6 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-black/20 flex items-center justify-center gap-2 text-xs disabled:opacity-50"
          >
            <Save size={14} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
