import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null;

// --- PERSISTENCIA DE SESIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login").style.display = "none";
        document.getElementById("app").style.display = "block";
        cargarFundas();
    } else {
        document.getElementById("login").style.display = "block";
        document.getElementById("app").style.display = "none";
    }
});

// --- FUNCIONES DE LÓGICA ---
async function login() {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value);
    } catch (e) { alert("Error al entrar: " + e.message); }
}

function mostrarFormulario() {
    const div = document.getElementById("agregar");
    div.style.display = div.style.display === "none" ? "block" : "none";
    document.getElementById("guardarFunda").innerText = "Guardar";
    idEdicion = null;
}

window.editarFunda = (id) => {
    const f = todasLasFundas.find(f => f.id === id);
    if (!f) return;
    document.getElementById("nombre").value = f.nombre;
    document.getElementById("stock").value = f.stock;
    document.getElementById("compatibles").value = Array.isArray(f.compatibles) ? f.compatibles.join(", ") : f.compatibles;
    document.getElementById("costo").value = f.costo;
    document.getElementById("venta").value = f.venta;
    idEdicion = id;
    document.getElementById("guardarFunda").innerText = "Actualizar";
    document.getElementById("agregar").style.display = "block";
};

async function guardarFunda() {
    const data = {
        nombre: document.getElementById("nombre").value,
        stock: Number(document.getElementById("stock").value),
        compatibles: document.getElementById("compatibles").value.split(",").map(i => i.trim()),
        costo: Number(document.getElementById("costo").value),
        venta: Number(document.getElementById("venta").value)
    };
    try {
        if (idEdicion) {
            await updateDoc(doc(db, "fundas", idEdicion), data);
        } else {
            await addDoc(collection(db, "fundas"), data);
        }
        document.getElementById("agregar").style.display = "none";
        cargarFundas();
    } catch (e) { alert("Error al guardar: " + e.message); }
}

async function cargarFundas() {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarFundas(todasLasFundas);
}

function renderizarFundas(lista) {
    const contenedor = document.getElementById("fundas");
    contenedor.innerHTML = "";
    lista.forEach((f) => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h2>${f.nombre || "Sin nombre"}</h2>
            <p>📦 Stock: ${f.stock || 0}</p>
            <p>📱 ${Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : (f.compatibles || "N/A")}</p>
            <p>💵 Costo: $${f.costo || 0}</p>
            <p>💰 Venta: $${f.venta || 0}</p>
            <button onclick="window.editarFunda('${f.id}')" class="btn-editar">✏️ Editar</button>
            <button class="btn-eliminar" data-id="${f.id}">🗑️ Eliminar</button>
        `;
        card.querySelector(".btn-eliminar").onclick = () => eliminarFunda(f.id);
        contenedor.appendChild(card);
    });
}

async function eliminarFunda(id) {
    if (confirm("¿Estás seguro de eliminar esta funda?")) {
        try {
            await deleteDoc(doc(db, "fundas", id));
            cargarFundas();
        } catch (e) { alert("Error al borrar: " + e.message); }
    }
}

// --- EVENTOS ---
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

document.getElementById("buscar").addEventListener("input", (e) => {
    const texto = e.target.value.toLowerCase().trim();
    const filtradas = todasLasFundas.filter(f => 
        (f.nombre || "").toLowerCase().includes(texto) || 
        (f.compatibles || []).join(" ").toLowerCase().includes(texto)
    );
    renderizarFundas(filtradas);
});
