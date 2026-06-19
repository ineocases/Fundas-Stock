import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Variable global para guardar los datos y buscar rápido
let todasLasFundas = [];

// ==========================================
// 1. EVENTOS (Conectamos los botones e inputs)
// ==========================================
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

// Buscador todoterreno
document.getElementById("buscar").addEventListener("input", (e) => {
  const textoBuscado = e.target.value.toLowerCase().trim();
  
  const fundasFiltradas = todasLasFundas.filter((funda) => {
    // Aseguramos que el nombre exista y esté en minúsculas
    const nombre = funda.nombre ? String(funda.nombre).toLowerCase() : "";
    
    // Convertimos los compatibles a texto seguro para buscar
    let modelos = "";
    if (Array.isArray(funda.compatibles)) {
      modelos = funda.compatibles.join(" ").toLowerCase();
    } else if (funda.compatibles) {
      modelos = String(funda.compatibles).toLowerCase();
    }
    
    // Busca si hay coincidencia
    return nombre.includes(textoBuscado) || modelos.includes(textoBuscado);
  });

  renderizarFundas(fundasFiltradas);
});

// ==========================================
// 2. FUNCIONES PRINCIPALES
// ==========================================

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    cargarFundas(); // Cargamos los datos apenas entra
  } catch (error) {
    alert("Error al iniciar sesión. Revisa tus datos.");
    console.error(error);
  }
}

function mostrarFormulario() {
  const formAgregar = document.getElementById("agregar");
  if (formAgregar.style.display === "none") {
    formAgregar.style.display = "block";
  } else {
    formAgregar.style.display = "none";
  }
}

async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; // Reiniciamos la lista local

    snapshot.forEach((doc) => {
      todasLasFundas.push({ id: doc.id, ...doc.data() });
    });

    renderizarFundas(todasLasFundas);
  } catch (error) {
    console.error("Error al cargar las fundas:", error);
  }
}

function renderizarFundas(arregloDeFundas) {
  let html = "";

  arregloDeFundas.forEach((f) => {
    // Formateamos los compatibles para que se vean lindos en la tarjeta
    const compatiblesStr = Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : f.compatibles;

    html += `
      <div class="card">
        <h3>${f.nombre || "Sin nombre"}</h3>
        
        <div class="card-details">
          <p>📦 Stock: <strong>${f.stock || 0}</strong></p>
          <p>📱 ${compatiblesStr || "N/A"}</p>
          <p>💵 Costo: $${f.costo || 0}</p>
          <p>💰 Venta: $${f.venta || 0}</p>
        </div>

        <div class="card-actions">
          <button class="btn-action">🛒 Vender</button>
          <button class="btn-action">✏️ Editar</button>
          <button class="btn-action">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  });

  document.getElementById("fundas").innerHTML = html;
}

async function guardarFunda() {
  try {
    const inputCompatibles = document.getElementById("compatibles").value;
    // Convierte el texto "11, 12, 13" en una lista real sacando los espacios
    const listaCompatibles = inputCompatibles.split(",").map(item => item.trim()).filter(item => item !== "");

    await addDoc(collection(db, "fundas"), {
      nombre: document.getElementById("nombre").value,
      stock: Number(document.getElementById("stock").value),
      compatibles: listaCompatibles,
      costo: Number(document.getElementById("costo").value),
      venta: Number(document.getElementById("venta").value),
      foto: ""
    });

    alert("¡Funda guardada exitosamente!");
    
    // Limpiamos el formulario
    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("compatibles").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("venta").value = "";

    // Ocultamos el formulario y recargamos
    document.getElementById("agregar").style.display = "none";
    cargarFundas();

  } catch (error) {
    alert("Hubo un error al guardar.");
    console.error(error);
  }
}
