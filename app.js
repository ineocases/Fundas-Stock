import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];

// --- PERSISTENCIA: Esto mantiene la sesión iniciada automáticamente ---
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

// --- FUNCIONES ---

async function login() {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value);
    } catch (e) {
        alert("Error al entrar: verifica tus datos.");
    }
}

function mostrarFormulario() {
    const div = document.getElementById("agregar");
    div.style.display = div.style.display === "none" ? "block" : "none";
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
            <div class="card-details">
                <p>📦 <strong>Stock:</strong> ${f.stock || 0}</p>
                <p>📱 <strong>Modelos:</strong> ${Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : (f.compatibles || "N/A")}</p>
                <p>💵 <strong>Costo:</strong> $${f.costo || 0}</p>
                <p>💰 <strong>Venta:</strong> $${f.venta || 0}</p>
            </div>
            <button class="btn-eliminar" data-id="${f.id}">🗑️ Eliminar</button>
        `;
        card.querySelector(".btn-eliminar").onclick = () => eliminarFunda(f.id);
        contenedor.appendChild(card);
    });
}

async function eliminarFunda(id) {
    if (confirm("¿Seguro que quieres eliminar esta funda?")) {
        try {
            await deleteDoc(doc(db, "fundas", id));
            cargarFundas();
        } catch (e) { alert("Error al borrar"); }
    }
}

async function guardarFunda() {
    try {
        await addDoc(collection(db, "fundas"), {
            nombre: document.getElementById("nombre").value,
            stock: Number(document.getElementById("stock").value),
            compatibles: document.getElementById("compatibles").value.split(",").map(i => i.trim()),
            costo: Number(document.getElementById("costo").value),
            venta: Number(document.getElementById("venta").value)
        });
        document.getElementById("agregar").style.display = "none";
        cargarFundas();
    } catch (e) { alert("Error al guardar"); }
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
