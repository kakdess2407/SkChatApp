import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB4axXobbomjMTLZA-lQdXlU_qGqhtxZ48",
  authDomain: "whatsapp-c0c32.firebaseapp.com",
  projectId: "whatsapp-c0c32",
  storageBucket: "whatsapp-c0c32.firebasestorage.app",
  messagingSenderId: "186486358557",
  appId: "1:186486358557:web:065064aea2a508cbac7cf4",
  measurementId: "G-PXHL035CKG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
