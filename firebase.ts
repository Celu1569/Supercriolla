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

const isConfigValid = (config: any) => config && config.apiKey && config.projectId && config.appId;

// Robustness: Detect if projectId was accidentally set to an API key
if (firebaseConfig.projectId && firebaseConfig.projectId.startsWith('AIza')) {
  console.error("CRITICAL: VITE_FIREBASE_PROJECT_ID seems to be an API key. Falling back to config file project ID.");
  firebaseConfig.projectId = firebaseConfigImport.projectId;
}

const selectedConfig = isConfigValid(firebaseConfig) ? firebaseConfig : firebaseConfigImport;

console.log("Initializing Firebase with Project ID:", selectedConfig.projectId, "and Database ID:", selectedConfig.firestoreDatabaseId || '(default)');

// Check if we have minimum requirements for Firebase
const hasFirebaseKeys = !!(selectedConfig.apiKey && selectedConfig.apiKey !== "");

// Initialize Firebase SDK safely or provide dummy objects
export const app = hasFirebaseKeys 
  ? (getApps().length === 0 ? initializeApp(selectedConfig) : getApps()[0])
  : null;

// Handle cases where databaseId might be missing
export const db = app 
  ? (selectedConfig.firestoreDatabaseId && selectedConfig.firestoreDatabaseId !== "" 
      ? getFirestore(app, selectedConfig.firestoreDatabaseId) 
      : getFirestore(app)) 
  : (null as any); 

export const auth = app ? getAuth(app) : (null as any);
export const storage = app ? getStorage(app) : (null as any);

export { hasFirebaseKeys };
