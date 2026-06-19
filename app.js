import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];

// --- ESTADO DE SESIÓN ---
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

// --- BUSCADORES SEPARADOS (Lógica Robusta) ---
function aplicarFiltros() {
    const textoNombre = document.getElementById("buscarNombre").value.toLowerCase().trim();
    const textoModelo = document.getElementById("buscarModelo").value.toLowerCase().trim();

    const filtradas = todasLasFundas.filter(f => {
        const nombre = (f.nombre || "").toLowerCase();
        
        // Convertimos a string obligatoriamente para evitar errores de .split()
        const rawModelos = f.compatibles ? String(f.compatibles) : "";
        const modelos = rawModelos.toLowerCase().split(',').map(m => m.trim());
        
        const coincideNombre = nombre.includes(textoNombre);
        const coincideModelo = textoModelo === "" ? true : modelos.includes(textoModelo);
        
        return coincideNombre && coincideModelo;
    });

    renderizarFundas(filtradas);
}

document.getElementById("buscarNombre").addEventListener("input", aplicarFiltros);
document.getElementById("buscarModelo").addEventListener("input", aplicarFiltros);

// --- RENDERIZADO DE TARJETAS ---
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

// --- CRUD Y VENTAS ---
document.getElementById("guardarFunda").onclick = async () => {
    const d = { 
        nombre: document.getElementById("nombre").value, 
        stock: Number(document.getElementById("stock").value),
        compatibles: document.getElementById("compatibles").value,
        costo: Number(document.getElementById("costo").value), 
        venta: Number(document.getElementById("venta").value) 
    };
    await addDoc(collection(db, "fundas"), d);
    document.getElementById("agregar").style.display = "none";
    alert("Funda guardada");
    cargarDatos();
};

window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    const cliente = prompt("Nombre del cliente:");
    const unidades = parseInt(prompt("Unidades:", "1"));
    const precioVendido = parseFloat(prompt("Precio final cobrado:", f.venta * unidades));
    const envio = parseFloat(prompt("Costo de envío:", "0"));
    if (!cliente || isNaN(unidades)) return;
    
    await addDoc(collection(db, "ventas"), {
        producto: f.nombre, cliente, unidades, ganancia: (precioVendido - (f.costo * unidades) - envio),
        fecha: new Date().toLocaleDateString(), fechaCompleta: new Date().toISOString()
    });
    await updateDoc(doc(db, "fundas", f.id), { stock: f.stock - unidades });
    cargarDatos();
};

window.eliminarFunda = async (id) => { 
    if(confirm("¿Seguro que deseas eliminar?")) { await deleteDoc(doc(db, "fundas", id)); cargarDatos(); } 
};

document.getElementById("btnNuevaFunda").onclick = () => {
    const f = document.getElementById("agregar");
    f.style.display = f.style.display === "none" ? "block" : "none";
};

// --- DASHBOARD E HISTORIAL ---
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
    try { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); } 
    catch(e) { alert("Error de acceso"); }
};
