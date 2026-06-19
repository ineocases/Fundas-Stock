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

// Variable global para guardar el stock en memoria y optimizar el buscador
let todasLasFundas = [];

// Asignación de eventos de la interfaz
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
  
  // Limpiamos el array para evitar duplicados al recargar
  todasLasFundas = []; 
  
  snapshot.forEach((doc) => {
    todasLasFundas.push({ id: doc.id, ...doc.data() });
  });

  // Pintamos todas las fundas en la pantalla al iniciar
  renderizarFundas(todasLasFundas);
}

async function guardarFunda() {
  console.log("DB antes de guardar:", db);

  // Guardamos los compatibles limpiando espacios entre las comas
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
  
  // Limpiamos los campos del formulario
  document.getElementById("nombre").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("compatibles").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("agregar").style.display = "none";

  // Volvemos a cargar la lista actualizada desde Firebase
  cargarFundas();
}

// Función encargada exclusivamente de dibujar las tarjetas en el HTML
function renderizarFundas(arrayDeFundas) {
  let html = "";

  arrayDeFundas.forEach((f) => {
    // Protección: Si compatibles no es un array, lo manejamos de forma segura para que no rompa la app
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

// Función que se ejecuta en tiempo real cada vez que escribes en el input
function filtrarFundas(evento) {
  // Pasamos el texto a minúsculas y removemos espacios en blanco iniciales/finales
  const textoBuscado = evento.target.value.toLowerCase().trim();

  const fundasFiltradas = todasLasFundas.filter((f) => {
    // 1. Validar coincidencia en el nombre de la funda
    const nombreFunda = f.nombre ? f.nombre.toLowerCase() : "";
    const nombreCoincide = nombreFunda.includes(textoBuscado);
    
    // 2. Validar coincidencia en los modelos compatibles de forma segura
    let compatibleCoincide = false;
    
    if (Array.isArray(f.compatibles)) {
      // Si el registro está bien guardado como Array: ["11", "12", "13"]
      compatibleCoincide = f.compatibles.some((modelo) => 
        String(modelo).toLowerCase().trim().includes(textoBuscado)
      );
    } else if (typeof f.compatibles === "string") {
      // Si el registro es un texto antiguo: "11,12,13"
      compatibleCoincide = f.compatibles.toLowerCase().includes(textoBuscado);
    } else if (f.compatibles) {
      // Cualquier otro formato alternativo
      compatibleCoincide = String(f.compatibles).toLowerCase().includes(textoBuscado);
    }

    // Muestra la funda si coincide el nombre o si coincide el modelo compatible
    return nombreCoincide || compatibleCoincide;
  });

  // Redibujamos la pantalla únicamente con los resultados que pasaron el filtro
  renderizarFundas(fundasFiltradas);
}
