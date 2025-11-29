// src/lib/firebase.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB8NvqiEslFPgDAxDTGbMkAh6ezCzHs0pk",
  authDomain: "renometa-warmup.firebaseapp.com",
  projectId: "renometa-warmup",
  storageBucket: "renometa-warmup.firebasestorage.app",
  messagingSenderId: "952647236756",
  appId: "1:952647236756:web:5b7a98cd0ec6a543bf4881"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };