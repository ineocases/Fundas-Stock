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

// 🔑 CONFIGURACIÓN DE APIS Y CONTACTO
const NUMERO_WHATSAPP = "5491170089123"; 
const REMOVE_BG_API_KEY = "zyLqt5m3r5FLcahT49QKDwK1"; 

// Variables globales de control
let todasLasFundas = [];
let listaCategorias = []; 
let categoriaSeleccionadaFiltro = "Todas"; 
let idFundaEditando = null;
let fotoBase64 = ""; 
let esAdmin = false; 
let fundaReservando = null; 
let imagenRecortadaTemporal = null; 
let porcentajeEscala = 0.72; 
let anguloRotacion = 0; 

// --- EVENTOS DE LA INTERFAZ ---
document.getElementById("btnLogin").onclick = loginAdmin;
document.getElementById("btnCliente").onclick = loginCliente; 
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);
document.getElementById("btnAsistente").onclick = mostrarAsistente;
document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;
document.getElementById("fotoInput").onchange = procesarImagen;
document.getElementById("btnCrearFoto").onclick = procesarImagenPro; 
document.getElementById("btnConfirmarWhatsApp").onclick = enviarWhatsApp;

document.getElementById("btnAbrirAdminModal").onclick = abrirModalAdmin;
document.getElementById("btnCerrarAdminModal").onclick = cerrarModalAdmin;

document.getElementById("btnMenuHamburguesa").onclick = toggleSidebar;
document.getElementById("sidebarOverlay").onclick = toggleSidebar;
document.getElementById("btnCambiarRol").onclick = ejecutarCambioRol;

// Eventos del Gestor de Categorías
document.getElementById("btnGestorCategorias").onclick = abrirModalCategorias;
document.getElementById("btnCerrarCategorias").onclick = cerrarModalCategorias;
document.getElementById("btnGuardarCategoria").onclick = crearNuevaCategoria;

// Evento para activar importación por Excel
document.getElementById("btnImportarExcel").onclick = () => {
  document.getElementById("inputExcel").click();
};
document.getElementById("inputExcel").onchange = procesarImportacionExcel;

// --- FUNCIONES DE NAVEGACIÓN ---

function toggleSidebar() {
  document.getElementById("sidebarMenu").classList.toggle("active");
  document.getElementById("sidebarOverlay").classList.toggle("active");
  document.getElementById("btnMenuHamburguesa").classList.toggle("active");
}

function abrirModalAdmin() {
  document.getElementById("modalAdminLogin").style.display = "flex";
  document.getElementById("email").focus();
}

function cerrarModalAdmin() {
  document.getElementById("modalAdminLogin").style.display = "none";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

async function ejecutarCambioRol() {
  toggleSidebar(); 
  await signOut(auth);
  
  if (esAdmin) {
    loginCliente();
  } else {
    document.getElementById("app").style.display = "none";
    document.getElementById("login").style.display = "flex";
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
  }
}

// OBSERVADOR DE SESIÓN
onAuthStateChanged(auth, async (user) => {
  document.getElementById("cargando").style.display = "none";
  if (user) {
    document.getElementById("modalAdminLogin").style.display = "none"; 
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    
    esAdmin = !user.isAnonymous;
    
    const btnCambiarRol = document.getElementById("btnCambiarRol");
    const btnGestorCategorias = document.getElementById("btnGestorCategorias");
    const btnImportarExcel = document.getElementById("btnImportarExcel");

    if (esAdmin) {
      btnCambiarRol.innerHTML = "📱 Cambiar a Cliente";
      document.getElementById("btnNuevaFunda").style.display = "inline-block";
      btnImportarExcel.style.display = "inline-block";
      document.getElementById("btnAsistente").style.display = "flex";
      btnGestorCategorias.style.display = "block";
    } else {
      btnCambiarRol.innerHTML = "🔐 Cambiar a Admin";
      document.getElementById("btnNuevaFunda").style.display = "none";
      btnImportarExcel.style.display = "none";
      document.getElementById("btnAsistente").style.display = "none";
      btnGestorCategorias.style.display = "none";
    }
    
    await cargarCategorias();
    cargarFundas(); 
  } else {
    document.getElementById("login").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

async function loginAdmin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Error al ingresar como Admin: Verifique sus credenciales.");
  }
}

async function loginCliente() {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    alert("Error al ingresar en modo cliente.");
  }
}

// 📂 GESTIÓN DE CATEGORÍAS (FIRESTORE)
async function cargarCategorias() {
  try {
    const snapshot = await getDocs(collection(db, "categorias"));
    let lista = [];
    snapshot.forEach(doc => {
      lista.push({ id: doc.id, nombre: doc.data().nombre });
    });
    listaCategorias = lista;
    renderizarPildorasCategorias();
    actualizarSelectFormulario();
    renderizarListaCrudCategorias();
  } catch (error) { console.error("Error al cargar categorías:", error); }
}

function renderizarPildorasCategorias() {
  const contenedor = document.getElementById("filtrosCategorias");
  if (!contenedor) return;

  let html = `<div class="categoria-pill ${categoriaSeleccionadaFiltro === 'Todas' ? 'active' : ''}" data-cat="Todas">Todas</div>`;
  listaCategorias.forEach(cat => {
    html += `<div class="categoria-pill ${categoriaSeleccionadaFiltro === cat.nombre ? 'active' : ''}" data-cat="${cat.nombre}">${cat.nombre}</div>`;
  });

  contenedor.innerHTML = html;
  contenedor.querySelectorAll(".categoria-pill").forEach(pill => {
    pill.onclick = function() {
      categoriaSeleccionadaFiltro = this.getAttribute("data-cat");
      renderizarPildorasCategorias();
      filtrarFundas();
    };
  });
}

function actualizarSelectFormulario() {
  const select = document.getElementById("categoriaSelect");
  if (!select) return;
  select.innerHTML = listaCategorias.map(cat => `<option value="${cat.nombre}">${cat.nombre}</option>`).join("");
}

function abrirModalCategorias() {
  toggleSidebar();
  document.getElementById("nuevoNombreCategoria").value = "";
  document.getElementById("modalCategorias").style.display = "flex";
}

function cerrarModalCategorias() {
  document.getElementById("modalCategorias").style.display = "none";
}

async function crearNuevaCategoria() {
  const input = document.getElementById("nuevoNombreCategoria");
  const nombre = input.value.trim();
  if (!nombre) return alert("Escribí un nombre para la categoría.");
  
  const existe = listaCategorias.some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
  if (existe) return alert("Esa categoría ya existe.");

  try {
    await addDoc(collection(db, "categorias"), { nombre: nombre });
    input.value = "";
    await cargarCategorias(); 
  } catch (error) { console.error(error); }
}

async function eliminarCategoria(id, nombre) {
  if (confirm(`¿Estás seguro que quieres eliminar la categoría "${nombre}"?`)) {
    try {
      await deleteDoc(doc(db, "categorias", id));
      await cargarCategorias();
    } catch (error) { console.error(error); }
  }
}

function renderizarListaCrudCategorias() {
  const contenedor = document.getElementById("listaCategoriasCrud");
  if (!contenedor) return;

  if (listaCategorias.length === 0) {
    contenedor.innerHTML = `<p style="text-align:center; color:#6e6e73; font-size:13px;">No hay categorías creadas aún.</p>`;
    return;
  }

  let html = "";
  listaCategorias.forEach(cat => {
    html += `
      <div class="item-crud-categoria">
        <span>${cat.nombre}</span>
        <button class="btn-eliminar-cat" onclick="eliminarCategoria('${cat.id}', '${cat.nombre}')">🗑️</button>
      </div>
    `;
  });
  contenedor.innerHTML = html;
}

// 📥 PROCESADOR LECTOR DE EXCEL
function procesarImportacionExcel(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = async function(e) {
    try {
      const datos = new Uint8Array(e.target.result);
      const libro = XLSX.read(datos, { type: 'array' });
      const nombreHoja = libro.SheetNames[0];
      const hoja = libro.Sheets[nombreHoja];
      const filas = XLSX.utils.sheet_to_json(hoja);
      
      if (filas.length === 0) return alert("El archivo de Excel se encuentra vacío.");

      if (confirm(`Se detectaron ${filas.length} artículos. ¿Proceder a importarlos?`)) {
        let importados = 0;
        for (const fila of filas) {
          let stockPorModeloArray = [];
          if (fila.StockPorModelo) {
            stockPorModeloArray = String(fila.StockPorModelo).split(",").map(item => {
              const [modelo, cantidad] = item.split(":");
              return { modelo: modelo ? modelo.trim() : "Único", stock: cantidad ? Number(cantidad.trim()) : 0 };
            }).filter(item => item.modelo !== "");
          }
          await addDoc(collection(db, "fundas"), {
            nombre: fila.Nombre || "Artículo",
            categoria: fila.Categoria || "Varios",
            costo: Number(fila.Costo || 0),
            venta: Number(fila.Venta || 0),
            stockPorModelo: stockPorModeloArray,
            foto: "" 
          });
          importados++;
        }
        alert(`¡Listo! Se añadieron ${importados} productos.`);
        cargarFundas(); 
      }
    } catch (error) { alert("Error al procesar Excel."); }
  };
  lector.readAsArrayBuffer(archivo);
}

// 🚀 PROCESADOR DE IMÁGENES PRO
async function procesarImagenPro() {
  const fileInput = document.getElementById("fotoInput");
  if (!fileInput.files || fileInput.files.length === 0) return alert("Selecciona una foto.");

  const btnCrear = document.getElementById("btnCrearFoto");
  btnCrear.disabled = true;
  btnCrear.innerText = "🚀 Recortando...";

  try {
    const formData = new FormData();
    formData.append("image_file", fileInput.files[0]);
    formData.append("size", "auto");

    const respuestaAPI = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_API_KEY },
      body: formData
    });

    const blob = await respuestaAPI.blob();
    const url = URL.createObjectURL(blob);
    imagenRecortadaTemporal = new Image();
    imagenRecortadaTemporal.src = url;
    await new Promise((res) => imagenRecortadaTemporal.onload = res);

    const preview = document.getElementById("previewFoto");
    preview.src = url;
    preview.style.display = "block";
    document.getElementById("controlCamposPro").style.display = "block";

    crearBotonesConfirmacion();
    aplicarMontajeFinal(false);
  } catch (err) { alert("Error en Remove.bg"); } finally { btnCrear.disabled = false; btnCrear.innerText = "Crear foto Pro"; }
}

function crearBotonesConfirmacion() {
  if (document.getElementById("contenedorConfirmacion")) return;
  const contenedor = document.createElement("div");
  contenedor.id = "contenedorConfirmacion";
  contenedor.innerHTML = `<button onclick="aplicarMontajeFinal(true)" style="background:#28a745">✅ Confirmar</button>`;
  document.getElementById("previewFoto").after(contenedor);
}

async function aplicarMontajeFinal(mostrarAlerta = false) {
  if (!imagenRecortadaTemporal) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1000; canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  
  // Fondo base (asegúrate de tener el archivo)
  const imgFondo = new Image();
  imgFondo.src = "fondo-estudio.png";
  await new Promise(res => imgFondo.onload = res);
  ctx.drawImage(imgFondo, 0, 0, 1000, 1000);

  const escala = (1000 * porcentajeEscala) / imagenRecortadaTemporal.width;
  ctx.save();
  ctx.translate(500, 500);
  ctx.rotate((anguloRotacion * Math.PI) / 180);
  ctx.drawImage(imagenRecortadaTemporal, - (imagenRecortadaTemporal.width * escala)/2, - (imagenRecortadaTemporal.height * escala)/2, imagenRecortadaTemporal.width * escala, imagenRecortadaTemporal.height * escala);
  ctx.restore();

  fotoBase64 = canvas.toDataURL("image/png");
  document.getElementById("previewFoto").src = fotoBase64;
  if(mostrarAlerta) alert("¡Montaje aplicado!");
}

// 🛒 RESERVAS Y VENTAS
function abrirModalReservar(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  fundaReservando = funda;
  document.getElementById("reservaNombreFunda").innerText = funda.nombre;
  document.getElementById("modalReservar").style.display = "flex";
}

function cerrarModalReservar() { document.getElementById("modalReservar").style.display = "none"; }

function enviarWhatsApp() {
  const modelo = document.getElementById("reservaModelo").value;
  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(`Quiero reservar: ${fundaReservando.nombre} - ${modelo}`)}`;
  window.open(url, "_blank");
  cerrarModalReservar();
}

// 🔧 GESTIÓN DE PRODUCTOS CRUD
async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filtrarFundas();
  } catch (error) { console.error(error); }
}

async function guardarFunda() {
  const compatiblesInput = document.getElementById("stockPorModelo").value;
  const stockPorModeloArray = compatiblesInput.split(",").map(item => {
    const [modelo, cantidad] = item.split(":");
    return { modelo: modelo ? modelo.trim() : "", stock: cantidad ? Number(cantidad.trim()) : 0 };
  }).filter(item => item.modelo !== "");

  const datos = {
    nombre: document.getElementById("nombre").value,
    categoria: document.getElementById("categoriaSelect").value,
    stockPorModelo: stockPorModeloArray,
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: fotoBase64
  };

  try {
    if (idFundaEditando) await updateDoc(doc(db, "fundas", idFundaEditando), datos);
    else await addDoc(collection(db, "fundas"), datos);
    ocultarFormulario();
    cargarFundas();
  } catch (e) { alert("Error al guardar."); }
}

async function eliminarFunda(id) {
  if (confirm("¿Borrar producto?")) {
    await deleteDoc(doc(db, "fundas", id));
    cargarFundas();
  }
}

function abrirEditarFunda(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  idFundaEditando = id;
  document.getElementById("nombre").value = funda.nombre;
  document.getElementById("agregar").style.display = "flex";
}

function filtrarFundas() {
  const buscar = document.getElementById("buscar").value.toLowerCase();
  const filtradas = todasLasFundas.filter(f => {
    const matchCat = categoriaSeleccionadaFiltro === "Todas" || f.categoria === categoriaSeleccionadaFiltro;
    return matchCat && (f.nombre || "").toLowerCase().includes(buscar);
  });
  renderizarFundas(filtradas);
}

function renderizarFundas(array) {
  document.getElementById("fundas").innerHTML = array.map(f => `
    <div class="card">
      <img src="${f.foto || 'placeholder.jpg'}" class="card-img">
      <div class="card-body">
        <h3>${f.nombre}</h3>
        <p>$${f.venta}</p>
        ${esAdmin ? `<button onclick="abrirEditarFunda('${f.id}')">Editar</button>` : `<button onclick="abrirModalReservar('${f.id}')">Reservar</button>`}
      </div>
    </div>
  `).join("");
}

// EXPORTACIONES PARA QUE HTML ENCUENTRE LAS FUNCIONES
window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = () => document.getElementById("agregar").style.display = "none";
window.abrirModalReservar = abrirModalReservar;
window.cerrarModalReservar = cerrarModalReservar;
window.eliminarCategoria = eliminarCategoria;
window.aplicarMontajeFinal = aplicarMontajeFinal;
