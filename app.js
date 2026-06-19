import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB:", db);

// Variable global para guardar el stock en memoria y optimizar el buscador
let todasLasFundas = [];

// Asignación de eventos de la interfaz
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);

// ==========================================
// OBSERVADOR DE SESIÓN (Persistencia)
// ==========================================
onAuthStateChanged(auth, (user) => {
  // En cuanto Firebase responde, quitamos el cartel de "Cargando..."
  document.getElementById("cargando").style.display = "none";

  if (user) {
    // Si ya estabas logueado del pasado, entras directo sin ver el login
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    cargarFundas(); 
  } else {
    // Si no hay sesión, recién ahí te mostramos el formulario
    document.getElementById("login").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // Intentamos ingresar. Si sale bien, onAuthStateChanged se activa solo
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Error al ingresar: Verifique su email y contraseña.");
    console.error(error);
  }
}

function mostrarFormulario() {
  document.getElementById("agregar").style.display = "block";
}

async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  todasLasFundas = []; 
  
  snapshot.forEach((doc) => {
    todasLasFundas.push({ id: doc.id, ...doc.data() });
  });

  renderizarFundas(todasLasFundas);
}

async function guardarFunda() {
  const compatiblesInput = document.getElementById("compatibles").value;
  const compatiblesArray = compatiblesInput.split(",").map(item => item.trim());

  await addDoc(
    collection(db, "fundas"),
    {
      nombre: document.getElementById("nombre").value,
      stock: Number(document.getElementById("stock").value),
      compatibles: compatiblesArray,
      costo: Number(document.getElementById("costo").value),
      venta: Number(document.getElementById("venta").value),
      foto: ""
    }
  );

  alert("Funda guardada con éxito");
  
  document.getElementById("nombre").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("compatibles").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("agregar").style.display = "none";

  cargarFundas();
}

function renderizarFundas(arrayDeFundas) {
  let html = "";

  arrayDeFundas.forEach((f) => {
    const compatiblesTexto = Array.isArray(f.compatibles) 
      ? f.compatibles.join(" • ") 
      : (f.compatibles ? String(f.compatibles) : "No especificado");

    html += `
    <div class="card">
      <h2>${f.nombre || "Sin nombre"}</h2>
      <p>📦 Stock: ${f.stock ?? 0}</p>
      <p>📱 Compatibles: ${compatiblesTexto}</p>
      <p>💵 Costo: $${f.costo ?? 0}</p>
      <p>💰 Venta: $${f.venta ?? 0}</p>
      <button>🛒 Vender</button>
      <button>✏️ Editar</button>
      <button>🗑️ Eliminar</button>
    </div>
    `;
  });

  document.getElementById("fundas").innerHTML = html;
}

function filtrarFundas(evento) {
  const textoBuscado = evento.target.value.toLowerCase().trim();

  const fundasFiltradas = todasLasFundas.filter((f) => {
    const nombreFunda = f.nombre ? f.nombre.toLowerCase() : "";
    const nombreCoincide = nombreFunda.includes(textoBuscado);
    
    let compatibleCoincide = false;
    
    if (Array.isArray(f.compatibles)) {
      compatibleCoincide = f.compatibles.some((modelo) => 
        String(modelo).toLowerCase().trim().includes(textoBuscado)
      );
    } else if (typeof f.compatibles === "string") {
      compatibleCoincide = f.compatibles.toLowerCase().includes(textoBuscado);
    } else if (f.compatibles) {
      compatibleCoincide = String(f.compatibles).toLowerCase().includes(textoBuscado);
    }

    return nombreCoincide || compatibleCoincide;
  });

  renderizarFundas(fundasFiltradas);
}
