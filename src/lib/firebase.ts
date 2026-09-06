import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import type { JournalEntry } from '../types';

// Load configuration from local config with safe fallback
let firebaseConfig = {
  projectId: 'wooliesganeshtest',
  appId: '1:1022258640879:web:cadd7ca99d936c5f12681a',
  apiKey: 'AIzaSyApT4lXMCseQonit6EbPf2RrVqSv17fPEg',
  authDomain: 'wooliesganeshtest.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-4bd63985-06f6-42cc-8e65-abce049f8a6d',
  storageBucket: 'wooliesganeshtest.firebasestorage.app',
  messagingSenderId: '1022258640879',
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore with specified database instance
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Workspace Scopes for Google Calendar, Google Docs, and Google Drive
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

// In-Memory OAuth Access Token Cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

// Automatically clear token on sign-out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedAccessToken = credential.accessToken;
  }
  return result.user;
}

export async function ensureWorkspaceAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  // If not cached, launch Google sign-in popup to acquire access token
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google Workspace access permission was not granted. Please try again.');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

export function getCachedWorkspaceToken(): string | null {
  return cachedAccessToken;
}

export async function logOut(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

// Strict Undefined-Stripping (Zero-Crash Payload Hygiene)
export function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return null;
      }
      return value;
    })
  );
}

// Firestore Owner-Bound Document CRUD
// Path: /users/{userId}/interactions/{interactionId}

export async function saveJournalEntry(
  userId: string,
  entry: JournalEntry
): Promise<void> {
  if (!userId) throw new Error('User ID is required for saving entries.');
  if (!entry.id) throw new Error('Entry ID is required.');

  const docRef = doc(db, 'users', userId, 'interactions', entry.id);
  const sanitized = sanitizePayload({
    ...entry,
    userId,
    updatedAt: new Date().toISOString(),
  });

  await setDoc(docRef, sanitized, { merge: true });
}

export async function deleteJournalEntry(
  userId: string,
  entryId: string
): Promise<void> {
  if (!userId || !entryId) throw new Error('User ID and Entry ID are required.');
  const docRef = doc(db, 'users', userId, 'interactions', entryId);
  await deleteDoc(docRef);
}

export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore onSnapshot error:', err);
      onError(err);
    }
  );
}
