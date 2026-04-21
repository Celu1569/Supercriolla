import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Handle cases where databaseId might be missing
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)'); 

export const auth = getAuth(app);
export const storage = getStorage(app);
