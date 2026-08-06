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

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || firebaseConfigImport.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfigImport.authDomain,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || firebaseConfigImport.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfigImport.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfigImport.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || firebaseConfigImport.appId,
  firestoreDatabaseId: getEnv('VITE_FIREBASE_DATABASE_ID') || firebaseConfigImport.firestoreDatabaseId
};

// Check if we have minimum requirements for Firebase
const hasFirebaseKeys = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "");

// Initialize Firebase SDK safely or provide dummy objects
export const app = hasFirebaseKeys 
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

// Handle cases where databaseId might be missing
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)') : (null as any); 

export const auth = app ? getAuth(app) : (null as any);
export const storage = app ? getStorage(app) : (null as any);

export { hasFirebaseKeys };
