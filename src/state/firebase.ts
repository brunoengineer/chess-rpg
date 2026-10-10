import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseEnabled = !!(config.apiKey && config.authDomain && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function init() {
  if (!firebaseEnabled) return false;
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return true;
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  if (!init()) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth!, cb);
}

export async function signInWithGoogle() {
  if (!init()) throw new Error('Google sign-in is not configured.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth!, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth!, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}

/** Saves are stored as a JSON string: avoids Firestore limits on nested arrays/undefined values. */
export async function loadCloudSave(uid: string): Promise<unknown | null> {
  if (!init()) return null;
  const snap = await getDoc(doc(db!, 'saves', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as { json?: string };
  return data.json ? JSON.parse(data.json) : null;
}

export async function writeCloudSave(uid: string, save: { updatedAt: number }) {
  if (!init()) return;
  await setDoc(doc(db!, 'saves', uid), { json: JSON.stringify(save), updatedAt: save.updatedAt, serverTime: serverTimestamp() });
}

/** Firestore handle (null when Firebase isn't configured). */
export function firestore(): Firestore | null {
  return init() ? db : null;
}
