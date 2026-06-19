import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null;

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

// Renderizado principal (corregido)
function renderizarFundas(lista) {
    const contenedor = document.getElementById("fundas");
    contenedor.innerHTML = "";
    lista.forEach(f => {
        const card = document.createElement("div");
        card.className = "card";
        const fJson = encodeURIComponent(JSON.stringify(f));
        card.innerHTML = `
            <h2>${f.nombre}</h2>
            <p>📦 Stock: ${f.stock}</p>
            <p>💵 Venta: $${f.venta}</p>
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

// Funciones de Venta, Dashboard e Historial
window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    const cliente = prompt("Nombre del cliente:");
    const unidades = parseInt(prompt("Unidades:", "1"));
    const precioVendido = parseFloat(prompt("Precio final cobrado:", f.venta * unidades));
    const envio = parseFloat(prompt("Costo de envío:", "0"));
    
    if (!cliente || isNaN(unidades)) return;
    
    await addDoc(collection(db, "ventas"), {
        producto: f.nombre, cliente, unidades, precioProducto: f.venta, 
        precioVendido, envio, ganancia: (precioVendido - (f.costo * unidades) - envio),
        fecha: new Date().toLocaleDateString(), fechaCompleta: new Date().toISOString()
    });

    await updateDoc(doc(db, "fundas", f.id), { stock: f.stock - unidades });
    cargarDatos();
};

async function actualizarDashboard() {
    const vSnap = await getDocs(collection(db, "ventas"));
    const fSnap = await getDocs(collection(db, "fundas"));
    let gananciaHoy = 0, totalStock = 0, ventasMes = 0;
    
    fSnap.forEach(d => totalStock += Number(d.data().stock || 0));
    vSnap.forEach(d => {
        const v = d.data();
        if (v.fecha === new Date().toLocaleDateString()) gananciaHoy += v.ganancia;
        if (new Date(v.fechaCompleta).getMonth() === new Date().getMonth()) ventasMes++;
    });

    document.getElementById("gananciaHoy").innerText = `$${gananciaHoy.toFixed(2)}`;
    document.getElementById("stockTotal").innerText = totalStock;
    document.getElementById("ventasMes").innerText = ventasMes;
}

async function cargarHistorial() {
    const snap = await getDocs(query(collection(db, "ventas"), orderBy("fechaCompleta", "desc")));
    let tabla = `<table><tr><th>Cliente</th><th>Producto</th><th>Ganancia</th></tr>`;
    snap.docs.forEach(d => {
        const v = d.data();
        tabla += `<tr><td>${v.cliente}</td><td>${v.producto} (${v.unidades})</td><td>$${v.ganancia.toFixed(2)}</td></tr>`;
    });
    document.getElementById("historial").innerHTML = tabla + `</table>`;
}

// Eventos
document.getElementById("buscar").addEventListener("input", (e) => {
    const t = e.target.value.toLowerCase();
    renderizarFundas(todasLasFundas.filter(f => f.nombre.toLowerCase().includes(t)));
});

// (Mantén tus funciones guardarFunda, editarFunda y eliminarFunda como estaban)
window.editarFunda = (id) => { /* ... misma lógica anterior ... */ };
window.eliminarFunda = async (id) => { /* ... misma lógica anterior ... */ };
document.getElementById("btnLogin").onclick = async () => { /* ... lógica login ... */ };
document.getElementById("guardarFunda").onclick = async () => { /* ... lógica guardar ... */ };
