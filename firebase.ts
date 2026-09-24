import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import firebaseConfigImport from './firebase-applet-config.json';

// Helper to get environment variables safely in both Vite (browser) and Node.js (server)
const getEnv = (key: string): string | undefined => {
  // Check process.env (Node.js)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return undefined;
};

// Validate that an env var doesn't contain an accidentally injected API key for non-key fields
const isValidValue = (val: string | undefined, isKey = false): boolean => {
  if (!val || typeof val !== 'string' || val.trim() === '') return false;
  if (!isKey && val.startsWith('AIza')) return false; // Prevent API key from overwriting db/project/app IDs
  return true;
};

const resolvedDatabaseId = 
  isValidValue(getEnv('VITE_FIREBASE_DATABASE_ID')) 
    ? getEnv('VITE_FIREBASE_DATABASE_ID')!
    : firebaseConfigImport.firestoreDatabaseId;

const selectedConfig = {
  apiKey: isValidValue(getEnv('VITE_FIREBASE_API_KEY'), true) ? getEnv('VITE_FIREBASE_API_KEY')! : firebaseConfigImport.apiKey,
  authDomain: isValidValue(getEnv('VITE_FIREBASE_AUTH_DOMAIN')) ? getEnv('VITE_FIREBASE_AUTH_DOMAIN')! : firebaseConfigImport.authDomain,
  projectId: isValidValue(getEnv('VITE_FIREBASE_PROJECT_ID')) ? getEnv('VITE_FIREBASE_PROJECT_ID')! : firebaseConfigImport.projectId,
  storageBucket: isValidValue(getEnv('VITE_FIREBASE_STORAGE_BUCKET')) ? getEnv('VITE_FIREBASE_STORAGE_BUCKET')! : firebaseConfigImport.storageBucket,
  messagingSenderId: isValidValue(getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')) ? getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')! : firebaseConfigImport.messagingSenderId,
  appId: isValidValue(getEnv('VITE_FIREBASE_APP_ID')) ? getEnv('VITE_FIREBASE_APP_ID')! : firebaseConfigImport.appId,
  firestoreDatabaseId: resolvedDatabaseId
};

const hasFirebaseKeys = !!(selectedConfig.apiKey && selectedConfig.projectId && selectedConfig.appId);

// Initialize Firebase SDK safely with exact database ID
export const app = hasFirebaseKeys 
  ? (getApps().length === 0 ? initializeApp(selectedConfig) : getApps()[0])
  : null;

export const db = app 
  ? (resolvedDatabaseId && resolvedDatabaseId !== "(default)"
      ? getFirestore(app, resolvedDatabaseId) 
      : getFirestore(app)) 
  : (null as any); 

export const auth = app ? getAuth(app) : (null as any);
export const storage = app ? getStorage(app) : (null as any);

export { hasFirebaseKeys };

