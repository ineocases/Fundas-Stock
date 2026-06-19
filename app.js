import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];
let idEdicion = null;

// --- INICIALIZACIÓN Y SESIÓN ---
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

// --- LÓGICA DE VENTAS DETALLADA ---
window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    
    const cliente = prompt("Nombre del cliente:");
    const unidades = parseInt(prompt("Unidades:", "1"));
    const precioVendido = parseFloat(prompt("Precio final cobrado:", f.venta * unidades));
    const envio = parseFloat(prompt("Costo de envío (si aplica):", "0"));
    
    if (!cliente || isNaN(unidades) || isNaN(precioVendido)) return alert("Venta cancelada");
    if (f.stock < unidades) return alert("¡No hay suficiente stock!");

    const ganancia = precioVendido - (f.costo * unidades) - envio;

    await addDoc(collection(db, "ventas"), {
        producto: f.nombre,
        cliente: cliente,
        unidades: unidades,
        precioProducto: f.venta,
        precioVendido: precioVendido,
        envio: envio,
        ganancia: ganancia,
        fecha: new Date().toLocaleDateString(),
        fechaCompleta: new Date().toISOString()
    });

    await updateDoc(doc(db, "fundas", f.id), { stock: f.stock - unidades });
    
    alert(`Venta registrada. Ganancia: $${ganancia.toFixed(2)}`);
    cargarDatos();
};

// --- DASHBOARD ---
async function actualizarDashboard() {
    const vSnap = await getDocs(collection(db, "ventas"));
    const fSnap = await getDocs(collection(db, "fundas"));
    let gananciaHoy = 0, totalStock = 0, ventasMes = 0;
    const hoy = new Date().toLocaleDateString();
    const mesActual = new Date().getMonth();
    
    fSnap.forEach(d => totalStock += Number(d.data().stock || 0));
    vSnap.forEach(d => {
        const v = d.data();
        if (v.fecha === hoy) gananciaHoy += v.ganancia;
        if (new Date(v.fechaCompleta).getMonth() === mesActual) ventasMes++;
    });

    document.getElementById("gananciaHoy").innerText = `$${gananciaHoy.toFixed(2)}`;
    document.getElementById("stockTotal").innerText = totalStock;
    document.getElementById("ventasMes").innerText = ventasMes;
}

// --- HISTORIAL ---
async function cargarHistorial() {
    const q = query(collection(db, "ventas"), orderBy("fechaCompleta", "desc"));
    const snap = await getDocs(q);
    const div = document.getElementById("historial");
    
    let tabla = `<table><tr><th>Cliente</th><th>Producto</th><th>Ganancia</th></tr>`;
    snap.docs.forEach(d => {
        const v = d.data();
        tabla += `<tr><td>${v.cliente}</td><td>${v.producto} (${v.unidades})</td><td>$${v.ganancia.toFixed(2)}</td></tr>`;
    });
    div.innerHTML = tabla + `</table>`;
}

// --- GESTIÓN DE FUNDAS (CRUD) ---
async function cargarFundas() {
    const snap = await getDocs(collection(db, "fundas"));
    todasLasFundas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const contenedor = document.getElementById("fundas");
    contenedor.innerHTML = "";
    todasLasFundas.forEach(f => {
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

window.editarFunda = (id) => {
    const f = todasLasFundas.find(x => x.id === id);
    document.getElementById("nombre").value = f.nombre;
    document.getElementById("stock").value = f.stock;
    document.getElementById("compatibles").value = f.compatibles;
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
        compatibles: document.getElementById("compatibles").value,
        costo: Number(document.getElementById("costo").value),
        venta: Number(document.getElementById("venta").value)
    };
    if (idEdicion) await updateDoc(doc(db, "fundas", idEdicion), data);
    else await addDoc(collection(db, "fundas"), data);
    document.getElementById("agregar").style.display = "none";
    cargarDatos();
}

window.eliminarFunda = async (id) => { 
    if(confirm("¿Seguro que deseas eliminar?")) { 
        await deleteDoc(doc(db, "fundas", id)); 
        cargarDatos(); 
    } 
};

// --- EVENTOS DE INTERFAZ ---
document.getElementById("btnLogin").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); } 
    catch(e) { alert("Error al ingresar"); }
};

document.getElementById("btnNuevaFunda").onclick = () => {
    idEdicion = null;
    document.getElementById("guardarFunda").innerText = "Guardar";
    document.getElementById("agregar").style.display = "block";
};

document.getElementById("guardarFunda").onclick = guardarFunda;

document.getElementById("buscar").addEventListener("input", (e) => {
    const texto = e.target.value.toLowerCase();
    const filtradas = todasLasFundas.filter(f => f.nombre.toLowerCase().includes(texto));
    // (Opcional: aquí podrías llamar a una función para renderizar solo las filtradas)
});
