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

// NUEVOS EVENTOS PARA EL ASISTENTE
document.getElementById("btnAsistente").onclick = mostrarAsistente;
document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;

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

// FUNCIONES DEL MODAL ASISTENTE VIRTUAL
function mostrarAsistente() {
  document.getElementById("asistenteProducto").value = "";
  document.getElementById("asistenteModelo").value = "";
  document.getElementById("asistenteUnidades").value = "1";
  document.getElementById("modalAsistente").style.display = "flex";
}

function ocultarAsistente() {
  document.getElementById("modalAsistente").style.display = "none";
}

async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; 
    snapshot.forEach((doc) => {
      todasLasFundas.push({ id: doc.id, ...doc.data() });
    });
    
    // Actualiza la lista de autocompletado del asistente y pinta las tarjetas
    actualizarDatalistAsistente();
    renderizarFundas(todasLasFundas);
  } catch (error) {
    console.error("Error al cargar fundas:", error);
  }
}

// NUEVA FUNCIÓN: Rellena el buscador inteligente del asistente con nombres existentes
function actualizarDatalistAsistente() {
  const datalist = document.getElementById("listaProductos");
  // Extraemos nombres únicos sin repetidos
  const nombresUnicos = [...new Set(todasLasFundas.map(f => f.nombre).filter(Boolean))];
  datalist.innerHTML = nombresUnicos.map(nombre => `<option value="${nombre}"></option>`).join("");
}

async function guardarFunda() {
  const compatiblesInput = document.getElementById("stockPorModelo").value;
  const stockPorModeloArray = compatiblesInput.split(",")
    .map(item => {
      const [modelo, cantidad] = item.split(":");
      return {
        modelo: modelo ? modelo.trim() : "",
        stock: cantidad ? Number(cantidad.trim()) : 0
      };
    })
    .filter(item => item.modelo !== "");

  const datosFunda = {
    nombre: document.getElementById("nombre").value,
    stockPorModelo: stockPorModeloArray,
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

  if (Array.isArray(funda.stockPorModelo)) {
    document.getElementById("stockPorModelo").value = funda.stockPorModelo
      .map(m => `${m.modelo}:${m.stock}`)
      .join(", ");
  } else {
    const comps = Array.isArray(funda.compatibles) ? funda.compatibles.join(", ") : (funda.compatibles || "");
    document.getElementById("stockPorModelo").value = comps;
  }

  document.getElementById("guardarFunda").innerText = "Actualizar Funda";
  document.getElementById("agregar").style.display = "flex";
}

// NUEVA FUNCIÓN: Lógica principal del Asistente Virtual
async function procesarVentaAsistente() {
  const prodBuscado = document.getElementById("asistenteProducto").value.trim().toLowerCase();
  const modeloBuscado = document.getElementById("asistenteModelo").value.trim().toLowerCase();
  const unidadesAVender = Number(document.getElementById("asistenteUnidades").value);

  if (!prodBuscado || !modeloBuscado || unidadesAVender <= 0) {
    alert("Por favor, rellene todos los campos con valores válidos.");
    return;
  }

  // 1. Buscar el producto por nombre
  const fundaEncontrada = todasLasFundas.find(f => f.nombre && f.nombre.toLowerCase() === prodBuscado);

  if (!fundaEncontrada) {
    alert("No se encontró ningún producto con ese nombre exacto. Verifique la lista.");
    return;
  }

  // 2. Modificar el stock dependiendo del formato (Nuevo o Viejo)
  if (Array.isArray(fundaEncontrada.stockPorModelo)) {
    // NUEVO FORMATO
    const modeloStock = fundaEncontrada.stockPorModelo.find(m => m.modelo.toLowerCase().trim() === modeloBuscado);
    
    if (!modeloStock) {
      alert(`Este producto no tiene registrado stock para el modelo iPhone "${modeloBuscado}".`);
      return;
    }

    if (modeloStock.stock < unidadesAVender) {
      alert(`¡Stock insuficiente! Solo quedan ${modeloStock.stock} unidades para iPhone ${modeloStock.modelo}.`);
      return;
    }

    // Restamos del stock
    modeloStock.stock -= unidadesAVender;

    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), {
        stockPorModelo: fundaEncontrada.stockPorModelo
      });
      alert(`¡Venta registrada! Se descontaron ${unidadesAVender} u. de iPhone ${modeloStock.modelo}`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) {
      console.error(error);
      alert("Error al procesar la venta en la base de datos.");
    }

  } else {
    // COMPATIBILIDAD VIEJO FORMATO
    const listaCompatibles = Array.isArray(fundaEncontrada.compatibles) 
      ? fundaEncontrada.compatibles.map(c => String(c).toLowerCase().trim()) 
      : String(fundaEncontrada.compatibles).toLowerCase().split(",");

    const esCompatible = listaCompatibles.some(c => c.includes(modeloBuscado));

    if (!esCompatible) {
      alert("El modelo ingresado no se encuentra listado como compatible en este producto viejo.");
      return;
    }

    const stockActualViejo = fundaEncontrada.stock ?? 0;
    if (stockActualViejo < unidadesAVender) {
      alert(`¡Stock insuficiente! Solo quedan ${stockActualViejo} unidades globales.`);
      return;
    }

    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), {
        stock: stockActualViejo - unidadesAVender
      });
      alert(`¡Venta registrada en producto antiguo! Se descontaron ${unidadesAVender} u.`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) {
      console.error(error);
    }
  }
}

// Vinculaciones globales
window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente; // Exponer ocultar asistente

function renderizarFundas(arrayDeFundas) {
  let html = "";
  arrayDeFundas.forEach((f) => {
    let listaModelosHTML = "";
    let totalStock = 0;

    if (Array.isArray(f.stockPorModelo)) {
      totalStock = f.stockPorModelo.reduce((acc, item) => acc + item.stock, 0);
      listaModelosHTML = f.stockPorModelo
        .map(m => `• iPhone ${m.modelo}: <b>${m.stock} u.</b>`)
        .join("<br>");
    } else {
      totalStock = f.stock ?? 0;
      const comps = Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : String(f.compatibles || "");
      listaModelosHTML = `• Compatibles: ${comps}`;
    }

    // MODIFICADO: Se quitó por completo el botón de "🛒 Vender"
    html += `
    <div class="card">
      <h2>${f.nombre || "Sin nombre"}</h2>
      <p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock Total: ${totalStock} u.</b></p>
      
      <div style="margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5;">
        ${listaModelosHTML}
      </div>

      <p>💵 Costo: $${f.costo ?? 0}</p>
      <p>💰 Venta: $${f.venta ?? 0}</p>
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
    if (Array.isArray(f.stockPorModelo)) {
      compatibleCoincide = f.stockPorModelo.some((m) => 
        String(m.modelo).toLowerCase().trim().includes(textoBuscado)
      );
    } else if (Array.isArray(f.compatibles)) {
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
