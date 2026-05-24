import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/services/firebase';
import { UserProfile, UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Use onSnapshot for real-time profile updates
        const unsub = onSnapshot(doc(db, 'profiles', u.uid), async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const defaultRole: UserRole = 'pending';
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              role: defaultRole,
              name: u.displayName || '',
            };
            try {
              await setDoc(doc(db, 'profiles', u.uid), newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `profiles/${u.uid}`);
            }
          }
          setLoading(false);
        });
        return unsub;
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        // Detailed error for common Firebase issues
        if (error.message.includes('auth/operation-not-allowed')) {
          alert('Google Sign-In is not enabled in your Firebase Console.');
        } else if (error.message.includes('auth/unauthorized-domain')) {
          alert('This domain is not authorized in your Firebase Console. Please add ' + window.location.hostname + ' to Authorized Domains.');
        } else if (error.message.includes('auth/popup-blocked')) {
          alert('Popup was blocked by your browser. Please allow popups for this site.');
        } else {
          alert('Login failed: ' + error.message);
        }
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, profile, loading, login, logout, isAdmin: profile?.role === 'admin' };
}
