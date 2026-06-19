import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null;

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

// --- 2. BUSCADORES ---
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("buscarNombre")?.addEventListener("input", window.aplicarFiltros);
    document.getElementById("buscarModelo")?.addEventListener("input", window.aplicarFiltros);
});

window.aplicarFiltros = () => {
    const textoNombre = document.getElementById("buscarNombre").value.toLowerCase().trim();
    const textoModelo = document.getElementById("buscarModelo").value.toLowerCase().trim();
    const filtradas = todasLasFundas.filter(f => {
        const nombre = (f.nombre || "").toLowerCase();
        const modelos = String(f.compatibles || "").toLowerCase().split(',').map(m => m.trim());
        return nombre.includes(textoNombre) && (textoModelo === "" || modelos.includes(textoModelo));
    });
    renderizarFundas(filtradas);
};

// --- 3. RENDERIZADO Y CRUD ---
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
            <button onclick="window.editarFunda('${f.id}')" class="btn-editar">✏️ Editar</button>
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

document.getElementById("guardarFunda").onclick = async () => {
    const data = { 
        nombre: document.getElementById("nombre").value, 
        stock: Number(document.getElementById("stock").value),
        compatibles: document.getElementById("compatibles").value,
        costo: Number(document.getElementById("costo").value), 
        venta: Number(document.getElementById("venta").value) 
    };
    if (idEdicion) { await updateDoc(doc(db, "fundas", idEdicion), data); idEdicion = null; }
    else { await addDoc(collection(db, "fundas"), data); }
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

// --- 4. LÓGICA DE VENTAS ---
window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    
    const cliente = prompt("Nombre del cliente:");
    if (!cliente) return;
    
    const modelo = prompt("Modelo (ej: 11):", f.compatibles.split(',')[0]);
    if (!modelo) return;
    
    const unidades = parseInt(prompt("Cantidad de unidades:", "1"));
    if (isNaN(unidades) || unidades <= 0) return;
    
    const precioTotal = parseFloat(prompt("Precio total cobrado:", f.venta * unidades));
    const envio = parseFloat(prompt("Costo de envío:", "0"));
    
    if (isNaN(precioTotal)) return;
    
    // Guardar venta detallada
    await addDoc(collection(db, "ventas"), { 
        producto: f.nombre,
        cliente: cliente, 
        modelo: modelo,
        unidades: unidades, 
        costoUnitario: Number(f.costo),
        precioVenta: precioTotal / unidades, 
        envio: Number(envio), 
        ganancia: (Number(precioTotal) - (Number(f.costo) * unidades) - Number(envio)),
        fecha: new Date().toLocaleDateString(), 
        fechaCompleta: new Date().toISOString() 
    });
    
    // Actualizar Stock
    await updateDoc(doc(db, "fundas", f.id), { stock: Number(f.stock) - unidades });
    
    alert("Venta registrada con éxito");
    cargarDatos();
};

window.eliminarFunda = async (id) => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db, "fundas", id)); cargarDatos(); } };
document.getElementById("btnNuevaFunda").onclick = () => { idEdicion = null; document.getElementById("agregar").style.display = "block"; };
document.getElementById("btnLogin").onclick = async () => { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); };

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
    let t = `<table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
        <tr style="background:#f0f0f0;"><th>Cliente</th><th>Producto</th><th>Modelo</th><th>Unid.</th><th>P. Compra</th><th>P. Venta</th><th>Envío</th><th>Ganancia</th></tr>`;
    snap.docs.forEach(d => {
        const v = d.data();
        t += `<tr>
            <td>${v.cliente || '-'}</td>
            <td>${v.producto || '-'}</td>
            <td>${v.modelo || '-'}</td>
            <td>${v.unidades || 0}</td>
            <td>$${(v.costoUnitario || 0).toFixed(2)}</td>
            <td>$${(v.precioVenta || 0).toFixed(2)}</td>
            <td>$${(v.envio || 0).toFixed(2)}</td>
            <td>$${(v.ganancia || 0).toFixed(2)}</td>
        </tr>`;
    });
    document.getElementById("historial").innerHTML = t + `</table>`;
}
