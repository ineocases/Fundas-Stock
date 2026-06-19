import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB:", db);

// Variable para guardar el stock en memoria y optimizar el buscador
let todasLasFundas = [];

// Asignación de eventos
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);

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

async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  
  // Limpiamos el array para evitar duplicados si recargamos la lista
  todasLasFundas = []; 
  
  snapshot.forEach((doc) => {
    todasLasFundas.push({ id: doc.id, ...doc.data() });
  });

  // Pintamos todas las fundas al inicio
  renderizarFundas(todasLasFundas);
}

async function guardarFunda() {
  console.log("DB antes de guardar:", db);

  await addDoc(
    collection(db, "fundas"),
    {
      nombre: document.getElementById("nombre").value,
      stock: Number(document.getElementById("stock").value),
      compatibles: document.getElementById("compatibles").value.split(","),
      costo: Number(document.getElementById("costo").value),
      venta: Number(document.getElementById("venta").value),
      foto: ""
    }
  );

  alert("Funda guardada con éxito");
  
  // Limpiamos los campos del formulario (opcional pero recomendado)
  document.getElementById("nombre").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("compatibles").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("agregar").style.display = "none";

  // Volvemos a cargar las fundas para que aparezca la nueva
  cargarFundas();
}

// Nueva función exclusiva para pintar las tarjetas
function renderizarFundas(arrayDeFundas) {
  let html = "";

  arrayDeFundas.forEach((f) => {
    html += `
    <div class="card">
      <h2>${f.nombre}</h2>
      <p>📦 Stock: ${f.stock}</p>
      <p>📱 Compatibles: ${f.compatibles.join(" • ")}</p>
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

// Nueva función que se ejecuta cada vez que escribes en el input
function filtrarFundas(evento) {
  const textoBuscado = evento.target.value.toLowerCase();

  const fundasFiltradas = todasLasFundas.filter((f) => {
    const nombreCoincide = f.nombre.toLowerCase().includes(textoBuscado);
    
    const compatibleCoincide = f.compatibles.some((modelo) => 
      modelo.toLowerCase().includes(textoBuscado)
    );

    return nombreCoincide || compatibleCoincide;
  });

  // Volvemos a renderizar solo con las que pasaron el filtro
  renderizarFundas(fundasFiltradas);
}
