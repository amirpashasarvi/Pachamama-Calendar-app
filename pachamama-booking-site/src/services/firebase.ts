import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigFile from '../../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigFile.apiKey,
  authDomain: firebaseConfigFile.authDomain,
  projectId: firebaseConfigFile.projectId,
  storageBucket: firebaseConfigFile.storageBucket,
  messagingSenderId: firebaseConfigFile.messagingSenderId,
  appId: firebaseConfigFile.appId,
};

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfigFile.firestoreDatabaseId);

/** Anonymous auth so the public site can read bookings for availability checks. */
export async function ensurePublicAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}
