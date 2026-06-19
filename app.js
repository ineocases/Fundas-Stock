import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null; // Variable para saber si estamos editando algo

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

async function login() {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value);
    } catch (e) { alert("Error al entrar"); }
}

function mostrarFormulario() {
    const div = document.getElementById("agregar");
    div.style.display = div.style.display === "none" ? "block" : "none";
    // Limpiamos el formulario al abrir
    document.getElementById("guardarFunda").innerText = "Guardar";
    idEdicion = null;
}

// --- NUEVA FUNCIÓN: CARGAR DATOS EN FORMULARIO ---
window.editarFunda = (id) => {
    const funda = todasLasFundas.find(f => f.id === id);
    if (!funda) return;

    document.getElementById("nombre").value = funda.nombre;
    document.getElementById("stock").value = funda.stock;
    document.getElementById("compatibles").value = Array.isArray(funda.compatibles) ? funda.compatibles.join(", ") : funda.compatibles;
    document.getElementById("costo").value = funda.costo;
    document.getElementById("venta").value = funda.venta;

    idEdicion = id; // Marcamos que estamos editando
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

    if (idEdicion) {
        // ACTUALIZAR
        await updateDoc(doc(db, "fundas", idEdicion), data);
        alert("¡Actualizado con éxito!");
    } else {
        // NUEVO
        await addDoc(collection(db, "fundas"), data);
        alert("¡Guardado con éxito!");
    }

    document.getElementById("agregar").style.display = "none";
    cargarFundas();
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
            <h2>${f.nombre}</h2>
            <div class="card-details">
                <p>📦 <strong>Stock:</strong> ${f.stock}</p>
                <p>📱 ${Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : f.compatibles}</p>
                <p>💵 <strong>Costo:</strong> $${f.costo}</p>
                <p>💰 <strong>Venta:</strong> $${f.venta}</p>
            </div>
            <button onclick="editarFunda('${f.id}')">✏️ Editar</button>
            <button class="btn-eliminar" data-id="${f.id}">🗑️ Eliminar</button>
        `;
        card.querySelector(".btn-eliminar").onclick = () => eliminarFunda(f.id);
        contenedor.appendChild(card);
    });
}

async function eliminarFunda(id) {
    if (confirm("¿Seguro?")) {
        await deleteDoc(doc(db, "fundas", id));
        cargarFundas();
    }
}

// --- EVENTOS ---
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
