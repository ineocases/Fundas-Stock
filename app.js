import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB conectada con éxito:", db);

// 🔑 CONFIGURACIÓN
const NUMERO_WHATSAPP = "5491170089123"; 

let todasLasFundas = [];
let categoriaSeleccionadaFiltro = "Todas"; 
let esAdmin = false; 

// Eventos básicos
document.getElementById("btnLogin").onclick = loginAdmin;
document.getElementById("btnCliente").onclick = loginCliente; 
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);
document.getElementById("btnAsistente").onclick = mostrarAsistente;
document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;

// Auth Observer
onAuthStateChanged(auth, async (user) => {
  document.getElementById("cargando").style.display = "none";
  if (user) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    esAdmin = !user.isAnonymous;
    cargarFundas(); 
  } else {
    document.getElementById("login").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  todasLasFundas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  filtrarFundas();
}

function renderizarFundas(arrayDeFundas, textoBuscado = "") {
  const contenedor = document.getElementById("fundas");
  let html = "";

  arrayDeFundas.forEach((f) => {
    let totalStock = 0;
    let modelosAMostrar = [];

    if (Array.isArray(f.stockPorModelo)) {
      modelosAMostrar = f.stockPorModelo;
      totalStock = modelosAMostrar.reduce((acc, item) => acc + item.stock, 0);
    }

    const nombreFunda = f.nombre ? f.nombre.toLowerCase() : "";
    const esBusquedaDeModelo = textoBuscado !== "" && !nombreFunda.includes(textoBuscado.toLowerCase());
    
    // Lista de modelos formateada
    const listaModelosHTML = modelosAMostrar.map(m => `• ${m.modelo}: <b>${m.stock} u.</b>`).join("<br>");
    
    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179";
    
    const bloqueAcciones = esAdmin ? `
        <div style="margin-top: 15px; display:flex; gap: 5px;">
          <button onclick="abrirEditarFunda('${f.id}')" style="flex:1;">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30; flex:1;">🗑️ Eliminar</button>
        </div>` : `
        <div style="margin-top: 20px;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #25D366; color: white; width: 100%; border:none; padding: 12px; border-radius: 12px; font-weight: 600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="20" height="20" alt="WA"> Reservar
          </button>
        </div>`;

    html += `
    <div class="card">
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${imagenUrl}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock: ${totalStock} u.</b></p>
        
        <button onclick="this.style.display='none'; this.nextElementSibling.style.display='block'" 
                style="width:100%; margin-bottom:10px; background:#f5f5f7; border:1px solid #d2d2d7; padding:8px; border-radius:8px; cursor:pointer; display: ${esBusquedaDeModelo ? 'none' : 'block'}">
            🔍 Ver Stock por Modelo
        </button>

        <div style="margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5; display: ${esBusquedaDeModelo ? 'block' : 'none'};">
          ${listaModelosHTML}
        </div>

        <p style="font-size: 17px; color:#0071e3; font-weight:700;">💰 $${f.venta ?? 0}</p>
        ${bloqueAcciones}
      </div>
    </div>`;
  });
  contenedor.innerHTML = html;
}

function filtrarFundas() {
  const textoBuscado = document.getElementById("buscar").value.toLowerCase().trim();
  
  const filtradas = todasLasFundas.filter(f => {
    // Mantener filtro de categoría si existe
    if (categoriaSeleccionadaFiltro !== "Todas") {
      if (f.categoria !== categoriaSeleccionadaFiltro) return false;
    }

    const nombre = f.nombre ? f.nombre.toLowerCase() : "";
    const modelos = Array.isArray(f.stockPorModelo) ? f.stockPorModelo.map(m => m.modelo.toLowerCase()).join(" ") : "";
    
    return nombre.includes(textoBuscado) || modelos.includes(textoBuscado);
  });
  
  renderizarFundas(filtradas, textoBuscado);
}
// Funciones necesarias para el funcionamiento
window.eliminarFunda = async (id) => { if(confirm("¿Eliminar producto?")) { await deleteDoc(doc(db, "fundas", id)); cargarFundas(); }};
window.abrirEditarFunda = (id) => { /* Tu lógica de edición */ };
window.abrirModalReservar = (id) => { 
    // Tu lógica para abrir el modal de reserva
    document.getElementById("modalReservar").style.display = "flex";
};
window.cerrarModalReservar = () => document.getElementById("modalReservar").style.display = "none";
window.mostrarFormulario = () => document.getElementById("agregar").style.display = "flex";
window.ocultarFormulario = () => document.getElementById("agregar").style.display = "none";
window.mostrarAsistente = () => document.getElementById("modalAsistente").style.display = "flex";
window.ocultarAsistente = () => document.getElementById("modalAsistente").style.display = "none";
window.procesarVentaAsistente = () => { /* Tu lógica de venta */ };
window.loginAdmin = async () => { /* Tu lógica login */ };
window.loginCliente = async () => { await signInAnonymously(auth); };
async function guardarFunda() { /* Tu lógica guardar */ }
