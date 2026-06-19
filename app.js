import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Variable global para guardar las fundas en memoria y buscar sobre ellas
let todasLasFundas = [];

// Eventos iniciales
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

// EVENTO DEL BUSCADOR: Este es el que faltaba para que "cobre vida"
document.getElementById("buscar").addEventListener("input", (e) => {
  const textoBuscado = e.target.value.toLowerCase();
  
  const fundasFiltradas = todasLasFundas.filter((funda) => {
    // Busca en el nombre
    const nombre = funda.nombre ? funda.nombre.toLowerCase() : "";
    // Busca en los modelos compatibles (unimos la lista en un solo texto)
    const modelos = funda.compatibles ? funda.compatibles.join(" ").toLowerCase() : "";
    
    return nombre.includes(textoBuscado) || modelos.includes(textoBuscado);
  });

  renderizarFundas(fundasFiltradas);
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  await signInWithEmailAndPassword(auth, email, password);
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  cargarFundas();
}

function mostrarFormulario() {
  document.getElementById("agregar").style.display = "block";
}

// Función para traer los datos y guardarlos en memoria
async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  todasLasFundas = []; // Limpiamos la lista global
  
  snapshot.forEach((doc) => {
    todasLasFundas.push(doc.data());
  });

  renderizarFundas(todasLasFundas);
}

// Función que dibuja las tarjetas en pantalla
function renderizarFundas(lista) {
  let html = "";
  lista.forEach((f) => {
    html += `
      <div class="card">
        <h2>${f.nombre}</h2>
        <p>📦 Stock: ${f.stock}</p>
        <p>📱 Compatibles: ${f.compatibles ? f.compatibles.join(" • ") : ""}</p>
        <p>💵 Costo: $${f.costo}</p>
        <p>💰 Venta: $${f.venta}</p>
        <button>🛒 Vender</button>
        <button>✏️ Editar</button>
        <button>🗑️ Eliminar</button>
      </div>
    `;
  });
  document.getElementById("fundas").innerHTML = html;
}

async function guardarFunda() {
  await addDoc(collection(db, "fundas"), {
    nombre: document.getElementById("nombre").value,
    stock: Number(document.getElementById("stock").value),
    compatibles: document.getElementById("compatibles").value.split(",").map(i => i.trim()),
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: ""
  });
  alert("Guardada");
  document.getElementById("agregar").style.display = "none";
  cargarFundas(); // Recargamos para ver la nueva funda
}
