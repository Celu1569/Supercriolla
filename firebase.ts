import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import firebaseConfigImport from './firebase-applet-config.json';

// Use Environment Variables if available (standard for Netlify/Production)
// Fallback to the JSON file for local development or simple exports
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigImport.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigImport.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigImport.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigImport.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigImport.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigImport.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigImport.firestoreDatabaseId
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
