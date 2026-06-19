import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,        // <-- NUEVO: Para referenciar un documento específico
  deleteDoc,  // <-- NUEVO: Para borrar
  updateDoc   // <-- NUEVO: Para actualizar
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB:", db);

// Variables globales
let todasLasFundas = [];
let idFundaEditando = null; // <-- NUEVO: Guarda el ID de la funda que se está editando

// Asignación de eventos de la interfaz
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);

// OBSERVADOR DE SESIÓN
onAuthStateChanged(auth, (user) => {
  document.getElementById("cargando").style.display = "none";
  if (user) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    cargarFundas(); 
  } else {
    document.getElementById("login").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Error al ingresar: Verifique su email y contraseña.");
    console.error(error);
  }
}

function mostrarFormulario() {
  idFundaEditando = null; // Al tocar "Nueva funda", nos aseguramos de no estar editando
  document.getElementById("guardarFunda").innerText = "Guardar";
  
  // Limpiamos los campos
  document.getElementById("nombre").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("compatibles").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  
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

// MODIFICADO: Ahora sirve tanto para CREAR como para EDITAR
async function guardarFunda() {
  const compatiblesInput = document.getElementById("compatibles").value;
  const compatiblesArray = compatiblesInput.split(",").map(item => item.trim());

  const datosFunda = {
    nombre: document.getElementById("nombre").value,
    stock: Number(document.getElementById("stock").value),
    compatibles: compatiblesArray,
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: ""
  };

  try {
    if (idFundaEditando) {
      // MODO EDICIÓN: Actualiza el documento existente
      await updateDoc(doc(db, "fundas", idFundaEditando), datosFunda);
      alert("Funda actualizada con éxito");
    } else {
      // MODO CREACIÓN: Crea un documento nuevo
      await addDoc(collection(db, "fundas"), datosFunda);
      alert("Funda guardada con éxito");
    }

    // Resetear el estado del formulario
    idFundaEditando = null;
    document.getElementById("guardarFunda").innerText = "Guardar";
    
    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("compatibles").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("venta").value = "";
    document.getElementById("agregar").style.display = "none";

    cargarFundas();
  } catch (error) {
    console.error("Error al procesar la funda:", error);
    alert("Hubo un error al guardar los datos.");
  }
}

// FUNCIÓN PARA ELIMINAR (NUEVA)
async function eliminarFunda(id) {
  if (confirm("¿Estás seguro de que deseas eliminar esta funda?")) {
    try {
      await deleteDoc(doc(db, "fundas", id));
      alert("Funda eliminada correctamente");
      cargarFundas(); // Recargar la lista
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar la funda.");
    }
  }
}

// FUNCIÓN PARA CARGAR LOS DATOS EN EL FORMULARIO Y EDITAR (NUEVA)
function abrirEditarFunda(id) {
  // Buscamos la funda elegida en nuestra lista local
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  idFundaEditando = id; // Guardamos el ID de forma global

  // Rellenamos los inputs con lo que ya tenía guardado
  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("stock").value = funda.stock ?? 0;
  document.getElementById("compatibles").value = Array.isArray(funda.compatibles) ? funda.compatibles.join(", ") : (funda.compatibles || "");
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;

  // Cambiamos el diseño para que el usuario sepa que está editando
  document.getElementById("guardarFunda").innerText = "Actualizar Funda";
  document.getElementById("agregar").style.display = "block";
  
  // Opcional: Hace scroll hacia arriba automáticamente para ver el formulario
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// IMPORTANTE: Al usar "type=module" en JS, las funciones no son visibles desde el HTML nativo.
// Al asignarlas a 'window', permitimos que los botones dinámicos usen 'onclick'.
window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;

function renderizarFundas(arrayDeFundas) {
  let html = "";
  arrayDeFundas.forEach((f) => {
    const compatiblesTexto = Array.isArray(f.compatibles) 
      ? f.compatibles.join(" • ") 
      : (f.compatibles ? String(f.compatibles) : "No especificado");

    // MODIFICADO: Agregados los eventos onclick apuntando a las nuevas funciones
    html += `
    <div class="card">
      <h2>${f.nombre || "Sin nombre"}</h2>
      <p>📦 Stock: ${f.stock ?? 0}</p>
      <p>📱 Compatibles: ${compatiblesTexto}</p>
      <p>💵 Costo: $${f.costo ?? 0}</p>
      <p>💰 Venta: $${f.venta ?? 0}</p>
      <button>🛒 Vender</button>
      <button onclick="abrirEditarFunda('${f.id}')">✏️ Editar</button>
      <button onclick="eliminarFunda('${f.id}')">🗑️ Eliminar</button>
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
