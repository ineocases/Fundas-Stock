import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login").style.display = "none";
        document.getElementById("app").style.display = "block";
        cargarDatos();
    }
});

async function cargarDatos() {
    await cargarFundas();
    await actualizarDashboard();
    await cargarHistorial();
}

// --- BUSCADOR CORREGIDO ---
document.getElementById("buscar").addEventListener("input", (e) => {
    const texto = e.target.value.toLowerCase().trim();
    
    const filtradas = todasLasFundas.filter(f => {
        const nombre = (f.nombre || "").toLowerCase();
        // Convertimos los modelos en un array limpio
        const modelos = (f.compatibles || "").split(',').map(m => m.trim().toLowerCase());
        
        return nombre.includes(texto) || modelos.includes(texto);
    });
    
    renderizarFundas(filtradas);
});

function renderizarFundas(lista) {
    const contenedor = document.getElementById("fundas");
    contenedor.innerHTML = ""; 
    lista.forEach(f => {
        const card = document.createElement("div");
        card.className = "card";
        const fJson = encodeURIComponent(JSON.stringify(f));
        card.innerHTML = `
            <h3>${f.nombre}</h3>
            <p>📦 <b>Stock:</b> ${f.stock}</p>
            <p>📱 <b>Modelos:</b> ${f.compatibles || 'N/A'}</p>
            <p>💵 <b>Costo:</b> $${f.costo || 0}</p>
            <p>💰 <b>Venta:</b> $${f.venta || 0}</p>
            <button onclick="window.venderFunda('${fJson}')" class="btn-vender">🛒 Vender</button>
            <button onclick="window.eliminarFunda('${f.id}')" class="btn-eliminar">🗑️ Eliminar</button>
        `;
        contenedor.appendChild(card);
    });
}

async function cargarFundas() {
    const snap = await getDocs(collection(db, "fundas"));
    todasLasFundas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarFundas(todasLasFundas);
}

// Lógica de Venta
window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    const cliente = prompt("Cliente:");
    const unidades = parseInt(prompt("Unidades:", "1"));
    const precioVendido = parseFloat(prompt("Precio final:", f.venta * unidades));
    const envio = parseFloat(prompt("Envío:", "0"));
    if (!cliente || isNaN(unidades)) return;
    
    await addDoc(collection(db, "ventas"), {
        producto: f.nombre, cliente, unidades, ganancia: (precioVendido - (f.costo * unidades) - envio),
        fecha: new Date().toLocaleDateString(), fechaCompleta: new Date().toISOString()
    });
    await updateDoc(doc(db, "fundas", f.id), { stock: f.stock - unidades });
    cargarDatos();
};

document.getElementById("guardarFunda").onclick = async () => {
    const d = { 
        nombre: document.getElementById("nombre").value, 
        stock: Number(document.getElementById("stock").value),
        compatibles: document.getElementById("compatibles").value,
        costo: Number(document.getElementById("costo").value), 
        venta: Number(document.getElementById("venta").value) 
    };
    await addDoc(collection(db, "fundas"), d);
    cargarDatos();
};

document.getElementById("btnNuevaFunda").onclick = () => {
    const f = document.getElementById("agregar");
    f.style.display = f.style.display === "none" ? "block" : "none";
};

// ... (resto de funciones de Dashboard e Historial igual que antes) ...
