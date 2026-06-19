import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = []; let idEdicion = null;

onAuthStateChanged(auth, (user) => {
    if (user) { document.getElementById("login").style.display = "none"; document.getElementById("app").style.display = "block"; cargarFundas(); }
    else { document.getElementById("login").style.display = "block"; document.getElementById("app").style.display = "none"; }
});

async function cargarFundas() {
    const snap = await getDocs(collection(db, "fundas"));
    todasLasFundas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizar(todasLasFundas);
}

function renderizar(lista) {
    const c = document.getElementById("fundas"); c.innerHTML = "";
    lista.forEach(f => {
        const card = document.createElement("div"); card.className = "card";
        card.innerHTML = `
            ${f.fotoUrl ? `<img src="${f.fotoUrl}" style="width:100%; height:120px; object-fit:cover; border-radius:5px;">` : ""}
            <h3>${f.nombre}</h3>
            <p>📦 Stock: ${f.stock}</p>
            <p>📱 Modelos: ${f.compatibles}</p>
            <button onclick="window.editarFunda('${f.id}')" class="btn-editar">✏️ Editar</button>
            <button onclick="window.eliminarFunda('${f.id}')" class="btn-eliminar">🗑️ Eliminar</button>
        `;
        c.appendChild(card);
    });
}

function aplicarFiltros() {
    const n = document.getElementById("buscarNombre").value.toLowerCase();
    const m = document.getElementById("buscarModelo").value.toLowerCase();
    renderizar(todasLasFundas.filter(f => 
        f.nombre.toLowerCase().includes(n) && 
        String(f.compatibles).toLowerCase().includes(m)
    ));
}

document.getElementById("buscarNombre").addEventListener("input", aplicarFiltros);
document.getElementById("buscarModelo").addEventListener("input", aplicarFiltros);

document.getElementById("guardarFunda").onclick = async () => {
    const data = { nombre: document.getElementById("nombre").value, stock: Number(document.getElementById("stock").value), compatibles: document.getElementById("compatibles").value, fotoUrl: document.getElementById("fotoUrl").value };
    if (idEdicion) await updateDoc(doc(db, "fundas", idEdicion), data);
    else await addDoc(collection(db, "fundas"), data);
    document.getElementById("agregar").style.display = "none";
    cargarFundas();
};

window.editarFunda = (id) => {
    const f = todasLasFundas.find(x => x.id === id);
    idEdicion = id;
    document.getElementById("nombre").value = f.nombre; document.getElementById("stock").value = f.stock;
    document.getElementById("compatibles").value = f.compatibles; document.getElementById("fotoUrl").value = f.fotoUrl || "";
    document.getElementById("agregar").style.display = "block";
};

window.eliminarFunda = async (id) => { if(confirm("¿Borrar?")) { await deleteDoc(doc(db, "fundas", id)); cargarFundas(); } };
document.getElementById("btnNuevaFunda").onclick = () => { idEdicion = null; document.getElementById("agregar").style.display = "block"; };
document.getElementById("btnLogin").onclick = async () => { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); };
