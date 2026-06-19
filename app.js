import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null; // Variable para saber si estamos editando

// --- 1. GESTIÓN DE SESIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login").style.display = "none";
        document.getElementById("app").style.display = "block";
        cargarDatos();
    } else {
        document.getElementById("login").style.display = "block";
        document.getElementById("app").style.display = "none";
    }
});

async function cargarDatos() {
    await cargarFundas();
    await actualizarDashboard();
    await cargarHistorial();
}

// --- 2. BUSCADORES (Con protección ante errores) ---
document.addEventListener("DOMContentLoaded", () => {
    const elNombre = document.getElementById("buscarNombre");
    const elModelo = document.getElementById("buscarModelo");

    if (elNombre) elNombre.addEventListener("input", window.aplicarFiltros);
    if (elModelo) elModelo.addEventListener("input", window.aplicarFiltros);
});

window.aplicarFiltros = () => {
    const elNombre = document.getElementById("buscarNombre");
    const elModelo = document.getElementById("buscarModelo");
    
    if (!elNombre || !elModelo) return;

    const textoNombre = elNombre.value.toLowerCase().trim();
    const textoModelo = elModelo.value.toLowerCase().trim();

    const filtradas = todasLasFundas.filter(f => {
        const nombre = (f.nombre || "").toLowerCase();
        const rawModelos = f.compatibles ? String(f.compatibles) : "";
        const modelos = rawModelos.toLowerCase().split(',').map(m => m.trim());
        
        const coincideNombre = nombre.includes(textoNombre);
        const coincideModelo = textoModelo === "" ? true : modelos.includes(textoModelo);
        
        return coincideNombre && coincideModelo;
    });
    renderizarFundas(filtradas);
};

// --- 3. RENDERIZADO DE TARJETAS ---
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
            <button onclick="window.editarFunda('${f.id}')" class="btn-editar" style="background:#ffc107; color:black;">✏️ Editar</button>
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

// --- 4. ACCIONES (Venta, Alta, Edición, Baja) ---
document.getElementById("guardarFunda").onclick = async () => {
    const data = { 
        nombre: document.getElementById("nombre").value, 
        stock: Number(document.getElementById("stock").value),
        compatibles: document.getElementById("compatibles").value,
        costo: Number(document.getElementById("costo").value), 
        venta: Number(document.getElementById("venta").value) 
    };

    if (idEdicion) {
        await updateDoc(doc(db, "fundas", idEdicion), data);
        idEdicion = null;
    } else {
        await addDoc(collection(db, "fundas"), data);
    }
    
    document.getElementById("agregar").style.display = "none";
    cargarDatos();
};

window.editarFunda = (id) => {
    const f = todasLasFundas.find(x => x.id === id);
    if (!f) return;
    idEdicion = id;
    document.getElementById("nombre").value = f.nombre;
    document.getElementById("stock").value = f.stock;
    document.getElementById("compatibles").value = f.compatibles;
    document.getElementById("costo").value = f.costo;
    document.getElementById("venta").value = f.venta;
    document.getElementById("agregar").style.display = "block";
};

window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    const u = parseInt(prompt("Unidades:", "1"));
    const precioFinal = parseFloat(prompt("Precio final cobrado:", f.venta * u));
    const envio = parseFloat(prompt("Costo de envío:", "0"));
    
    if (!u || isNaN(precioFinal)) return;
    
    await addDoc(collection(db, "ventas"), { 
        producto: f.nombre, cliente: "Cliente", unidades: u, 
        ganancia: (precioFinal - (f.costo * u) - envio), 
        fecha: new Date().toLocaleDateString(), fechaCompleta: new Date().toISOString() 
    });
    await updateDoc(doc(db, "fundas", f.id), { stock: f.stock - u });
    cargarDatos();
};

window.eliminarFunda = async (id) => { 
    if(confirm("¿Seguro que quieres eliminar esta funda?")) { 
        await deleteDoc(doc(db, "fundas", id)); 
        cargarDatos(); 
    } 
};

document.getElementById("btnNuevaFunda").onclick = () => { 
    idEdicion = null; // Reset para nueva funda
    const a = document.getElementById("agregar");
    a.style.display = a.style.display === "none" ? "block" : "none";
};

// --- 5. DASHBOARD E HISTORIAL ---
async function actualizarDashboard() {
    const vSnap = await getDocs(collection(db, "ventas"));
    const fSnap = await getDocs(collection(db, "fundas"));
    let g = 0, s = 0, m = 0;
    
    fSnap.forEach(d => s += Number(d.data().stock || 0));
    vSnap.forEach(d => {
        const v = d.data();
        if (v.fecha === new Date().toLocaleDateString()) g += v.ganancia;
        if (new Date(v.fechaCompleta).getMonth() === new Date().getMonth()) m++;
    });
    
    document.getElementById("gananciaHoy").innerText = `$${g.toFixed(2)}`;
    document.getElementById("stockTotal").innerText = s;
    document.getElementById("ventasMes").innerText = m;
}

async function cargarHistorial() {
    const snap = await getDocs(query(collection(db, "ventas"), orderBy("fechaCompleta", "desc")));
    let t = `<table><tr><th>Cliente</th><th>Producto</th><th>Ganancia</th></tr>`;
    snap.docs.forEach(d => {
        const v = d.data();
        t += `<tr><td>${v.cliente}</td><td>${v.producto} (${v.unidades})</td><td>$${v.ganancia.toFixed(2)}</td></tr>`;
    });
    document.getElementById("historial").innerHTML = t + `</table>`;
}

document.getElementById("btnLogin").onclick = async () => {
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); 
    } catch(e) { alert("Error al iniciar sesión"); }
};
