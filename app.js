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
                <p>📱 <strong>Modelos:</strong> ${Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : (f.compatibles || "N/A")}</p>
                <p>💵 <strong>Costo:</strong> $${f.costo || 0}</p>
                <p>💰 <strong>Venta:</strong> $${f.venta || 0}</p>
            </div>
            <button class="btn-eliminar" data-id="${f.id}">🗑️ Eliminar</button>
        `;
        
        // Conexión del evento eliminar
        card.querySelector(".btn-eliminar").onclick = () => eliminarFunda(f.id);
        
        contenedor.appendChild(card);
    });
}

async function eliminarFunda(id) {
    if (confirm("¿Estás seguro de que quieres eliminar esta funda?")) {
        try {
            await deleteDoc(doc(db, "fundas", id));
            alert("Eliminado correctamente");
            cargarFundas();
        } catch (e) { 
            alert("Error al eliminar"); 
        }
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
        alert("Funda guardada exitosamente");
        document.getElementById("agregar").style.display = "none";
        cargarFundas();
    } catch (e) {
        alert("Error al guardar");
    }
}

// --- EVENTOS (Se definen al final para asegurar que existan las funciones) ---
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
