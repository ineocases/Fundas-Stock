import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null;

// Persistencia de sesión
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
    document.getElementById("guardarFunda").innerText = "Guardar";
    idEdicion = null;
}

window.editarFunda = (id) => {
    const f = todasLasFundas.find(f => f.id === id);
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
    if (idEdicion) {
        await updateDoc(doc(db, "fundas", idEdicion), data);
    } else {
        await addDoc(collection(db, "fundas"), data);
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
            <p>📦 Stock: ${f.stock}</p>
            <p>📱 ${Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : f.compatibles}</p>
            <p>💵 Costo: $${f.costo}</p>
            <p>💰 Venta: $${f.venta}</p>
            <button onclick="editarFunda('${f.id}')" class="btn-editar">✏️ Editar</button>
            <button class="btn-eliminar">🗑️ Eliminar</button>
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

document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
