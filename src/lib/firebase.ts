import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBIQcCxi7fK3lmQRZmrVDd1NyTUJqGSoDk",
  authDomain: "ytify-1f93e.firebaseapp.com",
  projectId: "ytify-1f93e",
  storageBucket: "ytify-1f93e.firebasestorage.app",
  messagingSenderId: "204824253990",
  appId: "1:204824253990:web:50e59cb052780c239e78e7",
  measurementId: "G-7DF3V5P6DY"
};

// Initialize Firebase
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
