import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { 
    collection, getDocs, addDoc, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Variable global para guardar las fundas en memoria
let todasLasFundas = [];

// --- EVENTOS ---
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

// Buscador en tiempo real
document.getElementById("buscar").addEventListener("input", (e) => {
    const textoBuscado = e.target.value.toLowerCase().trim();
    
    const fundasFiltradas = todasLasFundas.filter((funda) => {
        const nombre = funda.nombre ? funda.nombre.toLowerCase() : "";
        const modelos = Array.isArray(funda.compatibles) ? funda.compatibles.join(" ").toLowerCase() : String(funda.compatibles).toLowerCase();
        
        return nombre.includes(textoBuscado) || modelos.includes(textoBuscado);
    });

    renderizarFundas(fundasFiltradas);
});

// --- FUNCIONES DE LÓGICA ---

async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById("login").style.display = "none";
        document.getElementById("app").style.display = "block";
        cargarFundas();
    } catch (error) {
        alert("Error al iniciar sesión.");
        console.error(error);
    }
}

function mostrarFormulario() {
    const form = document.getElementById("agregar");
    form.style.display = form.style.display === "none" ? "block" : "none";
}

async function cargarFundas() {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = [];
    snapshot.forEach((doc) => {
        todasLasFundas.push({ id: doc.id, ...doc.data() });
    });
    renderizarFundas(todasLasFundas);
}

function renderizarFundas(lista) {
    let html = "";
    lista.forEach((f) => {
        const compatiblesStr = Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : f.compatibles;
        html += `
            <div class="card">
                <h2>${f.nombre || "Sin nombre"}</h2>
                <p>📦 Stock: ${f.stock || 0}</p>
                <p>📱 Compatibles: ${compatiblesStr || ""}</p>
                <p>💵 Costo: $${f.costo || 0}</p>
                <p>💰 Venta: $${f.venta || 0}</p>
                <button>🛒 Vender</button>
                <button>✏️ Editar</button>
                <button onclick="eliminarFunda('${f.id}')">🗑️ Eliminar</button>
            </div>
        `;
    });
    document.getElementById("fundas").innerHTML = html;
}

async function guardarFunda() {
    try {
        await addDoc(collection(db, "fundas"), {
            nombre: document.getElementById("nombre").value,
            stock: Number(document.getElementById("stock").value),
            compatibles: document.getElementById("compatibles").value.split(",").map(i => i.trim()),
            costo: Number(document.getElementById("costo").value),
            venta: Number(document.getElementById("venta").value),
            foto: ""
        });
        alert("Guardada con éxito");
        document.getElementById("agregar").style.display = "none";
        cargarFundas();
    } catch (error) {
        alert("Error al guardar");
        console.error(error);
    }
}

// Función global para el botón de eliminar
window.eliminarFunda = async (id) => {
    if (confirm("¿Estás seguro de eliminar esta funda?")) {
        try {
            await deleteDoc(doc(db, "fundas", id));
            todasLasFundas = todasLasFundas.filter(f => f.id !== id);
            renderizarFundas(todasLasFundas);
        } catch (error) {
            alert("Error al eliminar");
            console.error(error);
        }
    }
};
