import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];

// --- FUNCIONES DE LÓGICA ---

async function login() {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value);
        document.getElementById("login").style.display = "none";
        document.getElementById("app").style.display = "block";
        cargarFundas();
    } catch (e) { 
        alert("Error al entrar, verifica tus credenciales."); 
    }
}

function mostrarFormulario() {
    const div = document.getElementById("agregar");
    div.style.display = div.style.display === "none" ? "block" : "none";
}

async function cargarFundas() {
    try {
        const snapshot = await getDocs(collection(db, "fundas"));
        todasLasFundas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarFundas(todasLasFundas);
    } catch (e) {
        console.error("Error al cargar fundas:", e);
    }
}

function renderizarFundas(lista) {
    const contenedor = document.getElementById("fundas");
    contenedor.innerHTML = ""; 
    
    lista.forEach((f) => {
        const card = document.createElement("div");
        card.className = "card";
        
        // Estructura completa con Stock, Compatibles, Costo y Venta
        card.innerHTML = `
            <h2>${f.nombre || "Sin nombre"}</h2>
            <div class="card-details">
                <p>📦 <strong>Stock:</strong> ${f.stock || 0}</p>
                <p>📱 <strong>Model
