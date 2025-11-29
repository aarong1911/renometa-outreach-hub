// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB8NvqiEslFPgDAxDTGbMkAh6ezCzHs0pk",
  authDomain: "renometa-warmup.firebaseapp.com",
  projectId: "renometa-warmup",
  storageBucket: "renometa-warmup.firebasestorage.app",
  messagingSenderId: "952647236756",
  appId: "1:952647236756:web:5b7a98cd0ec6a543bf4881"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);