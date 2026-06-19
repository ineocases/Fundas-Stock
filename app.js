import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
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

// Variables globales
let todasLasFundas = [];
let idFundaEditando = null;

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
  idFundaEditando = null;
  document.getElementById("modalTitulo").innerText = "➕ Nueva Funda";
  document.getElementById("guardarFunda").innerText = "Guardar";
  
  document.getElementById("nombre").value = "";
  document.getElementById("stockPorModelo").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  
  document.getElementById("agregar").style.display = "flex";
}

function ocultarFormulario() {
  idFundaEditando = null;
  document.getElementById("agregar").style.display = "none";
}

async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; 
    snapshot.forEach((doc) => {
      todasLasFundas.push({ id: doc.id, ...doc.data() });
    });
    renderizarFundas(todasLasFundas);
  } catch (error) {
    console.error("Error al cargar fundas:", error);
  }
}

async function guardarFunda() {
  // Procesamos el texto de entrada "11:3, 12:1, 14:4" y lo convertimos en una estructura limpia
  const inputStockModelo = document.getElementById("stockPorModelo").value;
  const stockPorModeloArray = inputStockModelo.split(",")
    .map(item => {
      const [modelo, cantidad] = item.split(":");
      return {
        modelo: modelo ? modelo.trim() : "",
        stock: cantidad ? Number(cantidad.trim()) : 0
      };
    })
    .filter(item => item.modelo !== ""); // Filtramos entradas vacías por seguridad

  const datosFunda = {
    nombre: document.getElementById("nombre").value,
    stockPorModelo: stockPorModeloArray, // Guardamos la nueva estructura detallada
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: ""
  };

  try {
    if (idFundaEditando) {
      await updateDoc(doc(db, "fundas", idFundaEditando), datosFunda);
      alert("Funda actualizada con éxito");
    } else {
      await addDoc(collection(db, "fundas"), datosFunda);
      alert("Funda guardada con éxito");
    }

    ocultarFormulario();
    cargarFundas();
  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Hubo un error al procesar los datos.");
  }
}

async function eliminarFunda(id) {
  if (confirm("¿Estás seguro de que deseas eliminar esta funda?")) {
    try {
      await deleteDoc(doc(db, "fundas", id));
      alert("Funda eliminada correctamente");
      cargarFundas();
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  }
}

function abrirEditarFunda(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  idFundaEditando = id;
  document.getElementById("modalTitulo").innerText = "✏️ Editar Funda";

  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;

  // Al editar, reconstruimos el formato "11:3, 12:1" para que sea fácil modificarlo
  if (Array.isArray(funda.stockPorModelo)) {
    document.getElementById("stockPorModelo").value = funda.stockPorModelo
      .map(m => `${m.modelo}:${m.stock}`)
      .join(", ");
  } else {
    // Cláusula de seguridad para productos creados con el sistema viejo
    const comps = Array.isArray(funda.compatibles) ? funda.compatibles.join(", ") : (funda.compatibles || "");
    document.getElementById("stockPorModelo").value = comps;
  }

  document.getElementById("guardarFunda").innerText = "Actualizar Funda";
  document.getElementById("agregar").style.display = "flex";
}

window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;

function renderizarFundas(arrayDeFundas) {
  let html = "";
  arrayDeFundas.forEach((f) => {
    let listaModelosHTML = "";
    let totalStock = 0;

    // Si tiene la nueva estructura, calculamos totales y desglosamos la lista
    if (Array.isArray(f.stockPorModelo)) {
      totalStock = f.stockPorModelo.reduce((acc, item) => acc + item.stock, 0);
      listaModelosHTML = f.stockPorModelo
        .map(m => `• iPhone ${m.modelo}: <b>${m.stock} u.</b>`)
        .join("<br>");
    } else {
      // Soporte de compatibilidad para tus datos viejos (Evita que se rompa la app)
      totalStock = f.stock ?? 0;
      const comps = Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : String(f.compatibles || "");
      listaModelosHTML = `• Compatibles: ${comps}`;
    }

    html += `
    <div class="card">
      <h2>${f.nombre || "Sin nombre"}</h2>
      <p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock Total: ${totalStock} u.</b></p>
      
      <!-- Lista desglosada con estilo limpio -->
      <div style="margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5;">
        ${listaModelosHTML}
      </div>

      <p>💵 Costo: $${f.costo ?? 0}</p>
      <p>💰 Venta: $${f.venta ?? 0}</p>
      <button>🛒 Vender</button>
      <button onclick="abrirEditarFunda('${f.id}')">✏️ Editar</button>
      <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30">🗑️ Eliminar</button>
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
    
    // Buscar compatibilidades en el nuevo formato de array de objetos
    if (Array.isArray(f.stockPorModelo)) {
      compatibleCoincide = f.stockPorModelo.some((m) => 
        String(m.modelo).toLowerCase().trim().includes(textoBuscado)
      );
    } 
    // Buscar en el formato viejo por si quedan registros antiguos sin actualizar
    else if (Array.isArray(f.compatibles)) {
      compatibleCoincide = f.compatibles.some((modelo) => 
        String(modelo).toLowerCase().trim().includes(textoBuscado)
      );
    } else if (typeof f.compatibles === "string") {
      compatibleCoincide = f.compatibles.toLowerCase().includes(textoBuscado);
    }

    return nombreCoincide || compatibleCoincide;
  });
  renderizarFundas(fundasFiltradas);
}
