import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyByWuZprkQCL5unyJQqffrlIj-7XgXej64",authDomain:"mi-sistema-gestion-d147f.firebaseapp.com",projectId:"mi-sistema-gestion-d147f",storageBucket:"mi-sistema-gestion-d147f.firebasestorage.app",messagingSenderId:"235461592723",appId:"1:235461592723:web:2408aec815840e3cd42f66",measurementId:"G-6QLEJVP5L0"};
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app); export const db=getFirestore(app);
