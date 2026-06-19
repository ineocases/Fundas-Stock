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

// --- DASHBOARD ---
async function actualizarDashboard() {
    const vSnap = await getDocs(collection(db, "ventas"));
    const fSnap = await getDocs(collection(db, "fundas"));
    let ganancia = 0, totalStock = 0, mesCount = 0;
    const hoy = new Date().toLocaleDateString();
    
    fSnap.forEach(d => totalStock += Number(d.data().stock || 0));
    vSnap.forEach(d => {
        if (d.data().fecha === hoy) ganancia += d.data().total;
        if (new Date(d.data().fechaCompleta).getMonth() === new Date().getMonth()) mesCount++;
    });

    document.getElementById("gananciaHoy").innerText = `$${ganancia}`;
    document.getElementById("stockTotal").innerText = totalStock;
    document.getElementById("ventasMes").innerText = mesCount;
}

// --- VENTAS Y HISTORIAL ---
window.venderFunda = async (fJson) => {
    const f = JSON.parse(decodeURIComponent(fJson));
    if (f.stock <= 0) return alert("¡Sin stock!");
    
    await addDoc(collection(db, "ventas"), {
        nombre: f.nombre,
        total: f.venta,
        fecha: new Date().toLocaleDateString(),
        fechaCompleta: new Date().toISOString()
    });
    await updateDoc(doc(db, "fundas", f.id), { stock: f.stock - 1 });
    cargarDatos();
};

async function cargarHistorial() {
    const q = query(collection(db, "ventas"), orderBy("fechaCompleta", "desc"));
    const snap = await getDocs(q);
    const div = document.getElementById("historial");
    div.innerHTML = `<table style="width:100%; border-collapse:collapse;"><tr><th>Fecha</th><th>Funda</th><th>Total</th></tr>` + 
        snap.docs.map(d => `<tr><td>${d.data().fecha}</td><td>${d.data().nombre}</td><td>$${d.data().total}</td></tr>`).join('') + `</table>`;
}

// --- FUNCIONES EXISTENTES ---
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
            <p>💵 $${f.venta}</p>
            <button onclick="window.venderFunda('${fJson}')" style="background:#34c759">🛒 Vender</button>
            <button onclick="window.editarFunda('${f.id}')" class="btn-editar">✏️ Editar</button>
            <button onclick="eliminarFunda('${f.id}')" class="btn-eliminar">🗑️ Eliminar</button>
        `;
        contenedor.appendChild(card);
    });
}

async function eliminarFunda(id) { if(confirm("¿Borrar?")) { await deleteDoc(doc(db, "fundas", id)); cargarDatos(); } }

document.getElementById("btnLogin").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); } 
    catch(e) { alert("Error"); }
};
document.getElementById("btnNuevaFunda").onclick = () => document.getElementById("agregar").style.display = "block";
document.getElementById("guardarFunda").onclick = guardarFunda;
