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

// Robustness: Detect if projectId was accidentally set to an API key
const rawProjectId = getEnv('VITE_FIREBASE_PROJECT_ID');
const isRawProjectIdValid = rawProjectId && !rawProjectId.startsWith('AIza') && rawProjectId !== "";

const selectedConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || firebaseConfigImport.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfigImport.authDomain,
  projectId: isRawProjectIdValid ? rawProjectId : firebaseConfigImport.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfigImport.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfigImport.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || firebaseConfigImport.appId,
  firestoreDatabaseId: getEnv('VITE_FIREBASE_DATABASE_ID') || firebaseConfigImport.firestoreDatabaseId
};

const hasFirebaseKeys = !!(selectedConfig.apiKey && selectedConfig.projectId && selectedConfig.appId);

// Initialize Firebase SDK safely
export const app = hasFirebaseKeys 
  ? (getApps().length === 0 ? initializeApp(selectedConfig) : getApps()[0])
  : null;

// Handle cases where databaseId might be missing
export const db = app 
  ? (selectedConfig.firestoreDatabaseId && selectedConfig.firestoreDatabaseId !== "" && selectedConfig.firestoreDatabaseId !== "(default)"
      ? getFirestore(app, selectedConfig.firestoreDatabaseId) 
      : getFirestore(app)) 
  : (null as any); 

export const auth = app ? getAuth(app) : (null as any);
export const storage = app ? getStorage(app) : (null as any);

export { hasFirebaseKeys };
