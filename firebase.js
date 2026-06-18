import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "ineocases.firebaseapp.com",
  projectId: "ineocases",
  storageBucket: "ineocases.firebasestorage.app",
  messagingSenderId: "904152906036",
  appId: "1:904152906036:web:85e24721ef7cddbc230d61"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
