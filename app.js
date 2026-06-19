import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];

// 1. DEFINIMOS LAS FUNCIONES PRIMERO
async function login() {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value);
        document.getElementById("login").style.display = "none";
        document.getElementById("app").style.display = "block";
        cargarFundas();
    } catch (e) { alert("Error al entrar"); }
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
            <h2>${f.nombre}</h2>
            <p>📦 Stock: ${f.stock}</p>
            <p>📱 ${Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : f.compatibles}</p>
            <button class="btn-eliminar">🗑️ Eliminar</button>
        `;
        card.querySelector(".btn-eliminar").onclick = () => eliminarFunda(f.id);
        contenedor.appendChild(card);
    });
}

async function eliminarFunda(id) {
    if (confirm("¿Borrar esta funda?")) {
        try {
            await deleteDoc(doc(db, "fundas", id));
            alert("Eliminado");
            cargarFundas();
        } catch (e) { alert("Error al borrar"); }
    }
}

async function guardarFunda() {
    await addDoc(collection(db, "fundas"), {
        nombre: document.getElementById("nombre").value,
        stock: Number(document.getElementById("stock").value),
        compatibles: document.getElementById("compatibles").value.split(",").map(i => i.trim()),
        costo: Number(document.getElementById("costo").value),
        venta: Number(document.getElementById("venta").value)
    });
    document.getElementById("agregar").style.display = "none";
    cargarFundas();
}

// 2. ASIGNAMOS LOS EVENTOS AL FINAL (Cuando las funciones ya existen)
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

document.getElementById("buscar").addEventListener("input", (e) => {
    const texto = e.target.value.toLowerCase();
    const filtradas = todasLasFundas.filter(f => 
        (f.nombre || "").toLowerCase().includes(texto) || 
        (f.compatibles || []).join(" ").toLowerCase().includes(texto)
    );
    renderizarFundas(filtradas);
});
