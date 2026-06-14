import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { UserProfile } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      unsubscribeUserDoc?.();
      unsubscribeUserDoc = undefined;

      if (u) {
        setLoading(true);
        setProfile(null);
      }
      setUser(u);
      if (u) {
        const email = normalizeEmail(u.email || '');
        if (!email) {
          console.error('Auth blocked: signed-in user has no email.', { uid: u.uid });
          setProfile(null);
          setLoading(false);
          return;
        }

        try {
          console.log('Auth check: searching approved user by email', { email });
          const userRef = doc(db, 'users', email);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // Backward-compat: migrate legacy profiles/{uid} into users/{email}.
            const legacySnap = await getDoc(doc(db, 'profiles', u.uid));
            if (legacySnap.exists()) {
              const legacy = legacySnap.data() as Partial<UserProfile>;
              if (legacy.role !== 'admin' && legacy.role !== 'staff') {
                console.warn('Legacy profile exists but is not pre-approved role; access denied.', {
                  uid: u.uid,
                  email,
                  legacyRole: legacy.role,
                });
                setProfile(null);
                setLoading(false);
                return;
              }
              const role = legacy.role;
              const migrated: UserProfile = {
                uid: u.uid,
                email,
                name: legacy.name || u.displayName || email,
                role,
                createdAt: legacy.createdAt || new Date().toISOString(),
              };
              console.log('Migrating legacy profile to users collection', { email, uid: u.uid, role });
              await setDoc(userRef, migrated);
              unsubscribeUserDoc = onSnapshot(userRef, (docSnap) => {
                if (!docSnap.exists()) {
                  setProfile(null);
                  setLoading(false);
                  return;
                }
                const data = docSnap.data() as Partial<UserProfile>;
                setProfile({
                  uid: data.uid || u.uid,
                  email: normalizeEmail(data.email || email),
                  name: data.name || u.displayName || email,
                  role: data.role === 'admin' ? 'admin' : 'staff',
                  createdAt: data.createdAt,
                });
                setLoading(false);
              });
              return;
            }

            console.warn('Auth blocked: email not authorized in users collection.', { email, uid: u.uid });
            setProfile(null);
            setLoading(false);
            return;
          }

          const matchedData = userSnap.data() as UserProfile;

          if (!matchedData.uid) {
            console.log('First login: attaching Firebase uid to approved user.', {
              userDocId: email,
              email,
              uid: u.uid,
            });
            try {
              await updateDoc(userRef, {
                uid: u.uid,
                name: matchedData.name || u.displayName || email,
              });
            } catch (error) {
              // Do not block access if uid attach fails (e.g. rules not published yet).
              console.warn('UID attach failed on first login; continuing with authorized access.', {
                userDocId: email,
                email,
                uid: u.uid,
                error,
              });
            }
          } else if (matchedData.uid !== u.uid) {
            console.warn('Authorized email has different uid than current auth session.', {
              email,
              storedUid: matchedData.uid,
              currentUid: u.uid,
            });
          }

          unsubscribeUserDoc = onSnapshot(userRef, (docSnap) => {
            if (!docSnap.exists()) {
              console.warn('Authorized user document was removed during session.', { userDocId: email, email });
              setProfile(null);
              setLoading(false);
              return;
            }

            const data = docSnap.data() as Partial<UserProfile>;
            setProfile({
              uid: data.uid || u.uid,
              email: normalizeEmail(data.email || email),
              name: data.name || u.displayName || email,
              role: data.role === 'admin' ? 'admin' : 'staff',
              createdAt: data.createdAt,
            });
            setLoading(false);
          }, (error) => {
            console.error('User auth profile listener failed.', { userDocId: email, email, error });
            setProfile(null);
            setLoading(false);
          });
        } catch (error) {
          console.error('Auth user lookup failed.', { email, uid: u.uid, error });
          setProfile(null);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeUserDoc?.();
      unsubscribeAuth();
    };
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
