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
  updateDoc,
  query,      
  orderBy,    
  writeBatch,
  setDoc,      
  getDoc,      
  arrayUnion   
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB conectada con éxito:", db);

// 🔑 CONFIGURACIÓN DE APIS Y CONTACTO
const NUMERO_WHATSAPP = "5491170089123"; 
const REMOVE_BG_API_KEY = "zyLqt5m3r5FLcahT49QKDwK1"; 
const IMGBB_API_KEY = "3c78e7313902208295c2b09b745a9b94";

// Variables globales de control
let todasLasFundas = [];
let listaCategorias = []; 
let categoriaSeleccionadaFiltro = "Todas"; 
let idFundaEditando = null;
let fotoBase64 = ""; 
let esAdmin = false; 
let fundaReservando = null; 
let sortableInstance = null; 
let esProductoSinModelo = false; 

// 📸 VARIABLES PARA FOTO PRO INTERACTIVA (MODAL SEPARADO)
let imagenOriginalTemporal = null; 
let imagenRecortadaTemporal = null; 
let fotoTransparenteBase64 = ""; 
let urlTransparenteGuardada = ""; 
let opacidadSombra = 0.35;
let tipoFondoElegido = "estudio"; // 'estudio', 'blanco', 'original'
let porcentajeEscala = 0.72; 
let rotacionGrados = 0;
let canvasPosX = 500;
let canvasPosY = 500;
let imgFondoEstudio = new Image();
imgFondoEstudio.src = "fondo-estudio.png"; // Precarga del fondo de estudio

// 🛒 Variables del Carrito de Compras
let carritoDeCompras = JSON.parse(localStorage.getItem("carritoINeo")) || [];

// --- INICIALIZACIÓN DE EVENTOS Y PROTECCIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const barra = document.getElementById("loaderProgreso");
  if (barra) barra.style.width = "15%";

  const inputBuscar = document.getElementById("buscar");
  if (inputBuscar && !document.getElementById("sugerenciasBuscador")) {
    const datalist = document.createElement("datalist");
    datalist.id = "sugerenciasBuscador";
    document.body.appendChild(datalist);
    inputBuscar.setAttribute("list", "sugerenciasBuscador");
  }

  // Asignación de eventos de la interfaz principal
  if(document.getElementById("btnLogin")) document.getElementById("btnLogin").onclick = loginAdmin;
  
  if(document.getElementById("btnCliente")) {
    document.getElementById("btnCliente").onclick = (e) => {
      e.preventDefault();
      const datosCliente = localStorage.getItem("clienteINeoDatos");
      if (!datosCliente) {
        document.getElementById("modalRegistroCliente").style.display = "flex";
      } else {
        loginCliente();
      }
    };
  }

  if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
  if(document.getElementById("guardarFunda")) document.getElementById("guardarFunda").onclick = guardarFunda;
  if(document.getElementById("buscar")) document.getElementById("buscar").addEventListener("input", filtrarFundas);
  if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").onclick = mostrarAsistente;
  if(document.getElementById("btnRegistrarVenta")) document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;
  if(document.getElementById("fotoInput")) document.getElementById("fotoInput").onchange = procesarImagen;
  
  if(document.getElementById("btnConfirmarWhatsApp")) document.getElementById("btnConfirmarWhatsApp").onclick = agregarAlCarrito;
  if(document.getElementById("btnAbrirCarrito")) document.getElementById("btnAbrirCarrito").onclick = abrirCarrito;
  if(document.getElementById("btnCerrarCarrito")) document.getElementById("btnCerrarCarrito").onclick = cerrarCarrito;
  
  const btnComprar = document.getElementById("btnComprarWhatsAppCarrito");
  if (btnComprar) {
    btnComprar.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="20" height="20" alt="WA"> Enviar pedido por WhatsApp`;
    btnComprar.style.display = "flex";
    btnComprar.style.alignItems = "center";
    btnComprar.style.justifyContent = "center";
    btnComprar.style.gap = "8px";
    btnComprar.onclick = enviarPedidoWhatsApp;
  }

  if(document.getElementById("btnAbrirAdminModal")) document.getElementById("btnAbrirAdminModal").onclick = abrirModalAdmin;
  if(document.getElementById("btnCerrarAdminModal")) document.getElementById("btnCerrarAdminModal").onclick = cerrarModalAdmin;

  if(document.getElementById("btnMenuHamburguesa")) document.getElementById("btnMenuHamburguesa").onclick = toggleSidebar;
  if(document.getElementById("sidebarOverlay")) document.getElementById("sidebarOverlay").onclick = toggleSidebar;
  if(document.getElementById("btnCambiarRol")) document.getElementById("btnCambiarRol").onclick = ejecutarCambioRol;

  if(document.getElementById("btnToggleModelo")) document.getElementById("btnToggleModelo").onclick = toggleModoModelo;

  if(document.getElementById("btnGestorCategorias")) document.getElementById("btnGestorCategorias").onclick = abrirModalCategorias;
  if(document.getElementById("btnCerrarCategorias")) document.getElementById("btnCerrarCategorias").onclick = cerrarModalCategorias;
  if(document.getElementById("btnGuardarCategoria")) document.getElementById("btnGuardarCategoria").onclick = crearNuevaCategoria;

  if(document.getElementById("btnImportarExcel")) document.getElementById("btnImportarExcel").onclick = () => document.getElementById("inputExcel").click();
  if(document.getElementById("inputExcel")) document.getElementById("inputExcel").onchange = procesarImportacionExcel;

  if(document.getElementById("btnAccionesIA")) document.getElementById("btnAccionesIA").onclick = toggleMenuMenuIA;
  if(document.getElementById("btnMenuFormatear")) document.getElementById("btnMenuFormatear").onclick = () => {
    document.getElementById("menuAccionesIA").style.display = "none";
    toggleFormateador();
  };
  if(document.getElementById("btnProcesarStock")) document.getElementById("btnProcesarStock").onclick = procesarTextoStock;

  if(document.getElementById("btnRegistrarCliente")) document.getElementById("btnRegistrarCliente").onclick = procesarRegistroCliente;
  if(document.getElementById("btnVerClientes")) document.getElementById("btnVerClientes").onclick = cargarVistaClientes;
  if(document.getElementById("btnCerrarClientes")) document.getElementById("btnCerrarClientes").onclick = () => {
      document.getElementById("pantallaClientes").style.display = "none";
      document.getElementById("fundas").style.display = "grid"; 
  };

  // --- NUEVOS EVENTOS DEL MODAL FOTO PRO ---
  if(document.getElementById("btnCrearFoto")) {
    document.getElementById("btnCrearFoto").onclick = () => {
      document.getElementById("menuAccionesIA").style.display = "none";
      abrirEditorFotoPro();
    };
  }
  if(document.getElementById("btnCerrarFotoPro")) {
    document.getElementById("btnCerrarFotoPro").onclick = cerrarEditorFotoPro;
  }
  if(document.getElementById("btnBorrarFondo")) {
    document.getElementById("btnBorrarFondo").onclick = ejecutarBorradoFondoIA;
  }
  if(document.getElementById("btnReEditar")) {
    document.getElementById("btnReEditar").onclick = reEditarMontaje;
  }
  if(document.getElementById("selectFondoPro")) {
    document.getElementById("selectFondoPro").onchange = (e) => {
      tipoFondoElegido = e.target.value;
      dibujarCanvasGestos();
    };
  }
  if(document.getElementById("sliderSombra")) {
    document.getElementById("sliderSombra").oninput = (e) => {
      opacidadSombra = e.target.value / 100;
      document.getElementById("valorSombra").innerText = e.target.value + "%";
      dibujarCanvasGestos();
    };
  }
  if(document.getElementById("sliderRotacion")) {
    document.getElementById("sliderRotacion").oninput = (e) => {
      rotacionGrados = parseFloat(e.target.value);
      document.getElementById("valorRotacion").innerText = e.target.value + "°";
      dibujarCanvasGestos();
    };
  }
  if(document.getElementById("btnGuardarFotoPro")) {
    document.getElementById("btnGuardarFotoPro").onclick = aplicarMontajeFinal;
  }

  configurarGestosCanvas();
  actualizarUI_Carrito();
});

// --- LÓGICA DE NAVEGACIÓN Y MENÚ ---
function toggleSidebar() {
  const menu = document.getElementById("sidebarMenu");
  const overlay = document.getElementById("sidebarOverlay");
  const btn = document.getElementById("btnMenuHamburguesa");

  if(menu) menu.classList.toggle("active");
  if(overlay) overlay.classList.toggle("active");

  if (menu && menu.classList.contains("active")) {
    if(btn) btn.style.display = "none";
  } else {
    if(btn) btn.style.display = ""; 
  }
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

// --- AUTENTICACIÓN PROTEGIDA CON PROGRESO REAL ---
onAuthStateChanged(auth, async (user) => {
  const loader = document.getElementById("cargando");
  const barra = document.getElementById("loaderProgreso");
  
  if (barra) barra.style.width = "40%"; 

  try {
    if (user) {
      document.getElementById("modalAdminLogin").style.display = "none"; 
      document.getElementById("login").style.display = "none";
      document.getElementById("app").style.display = "block";
      
      esAdmin = !user.isAnonymous;
      
      const btnCambiarRol = document.getElementById("btnCambiarRol");
      const btnGestorCategorias = document.getElementById("btnGestorCategorias");
      const btnImportarExcel = document.getElementById("btnImportarExcel");
      const btnVerClientes = document.getElementById("btnVerClientes");

      if (esAdmin) {
        if(btnCambiarRol) btnCambiarRol.innerHTML = "📱 Cambiar a Cliente";
        if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").style.display = "inline-block";
        if(btnImportarExcel) btnImportarExcel.style.display = "inline-block"; 
        if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").style.display = "flex";
        if(btnGestorCategorias) btnGestorCategorias.style.display = "block";
        if(btnVerClientes) btnVerClientes.style.display = "block";
      } else {
        if(btnCambiarRol) btnCambiarRol.innerHTML = "🔐 Cambiar a Admin";
        if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").style.display = "none";
        if(btnImportarExcel) btnImportarExcel.style.display = "none"; 
        if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").style.display = "none";
        if(btnGestorCategorias) btnGestorCategorias.style.display = "none";
        if(btnVerClientes) btnVerClientes.style.display = "none";
        
        solicitarDatosCliente();
      }
      
      if (barra) barra.style.width = "70%"; 
      await cargarCategorias();
      
      if (barra) barra.style.width = "92%"; 
      await cargarFundas(); 
      
    } else {
      if (barra) barra.style.width = "100%";
      document.getElementById("login").style.display = "flex";
      document.getElementById("app").style.display = "none";
      
      setTimeout(() => {
        if (loader) {
          loader.style.opacity = "0"; 
          setTimeout(() => { loader.style.display = "none"; }, 400); 
        }
      }, 250);
    }
  } catch (error) {
    console.error("Error crítico durante el inicio:", error);
    setTimeout(() => {
      if (loader) {
        loader.style.opacity = "0"; 
        setTimeout(() => { loader.style.display = "none"; }, 400); 
      }
    }, 250);
  }
});

async function loginAdmin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Error al ingresar como Admin: Verifique sus credenciales.");
    console.error(error);
  }
}

async function loginCliente() {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    alert("Error al ingresar en modo cliente.");
    console.error(error);
  }
}

// --- LÓGICA DE BASE DE DATOS DE CLIENTES ---
function solicitarDatosCliente() {
  const datosCliente = localStorage.getItem("clienteINeoDatos");
  if (!datosCliente) {
    document.getElementById("app").style.display = "none";
    signOut(auth);
    document.getElementById("login").style.display = "flex";
  }
}

async function procesarRegistroCliente() {
  const nombre = document.getElementById("registroNombre").value.trim();
  let telefonoCrudo = document.getElementById("registroTelefono").value.trim();

  if (!nombre || !telefonoCrudo) return alert("Por favor, completá ambos campos.");

  let telefono = telefonoCrudo.replace(/[^\d+]/g, ''); 
  if (!telefono.startsWith("+") && !telefono.startsWith("54")) {
      telefono = "549" + telefono; 
  }

  const btn = document.getElementById("btnRegistrarCliente");
  btn.disabled = true;
  btn.innerText = "⏳ Ingresando...";

  try {
    const docRef = doc(db, "clientes", telefono); 
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        nombres: arrayUnion(nombre),
        ultimoAcceso: new Date().toISOString()
      });
    } else {
      await setDoc(docRef, {
        nombres: [nombre],
        telefono: telefono,
        primerAcceso: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString()
      });
    }

    localStorage.setItem("clienteINeoDatos", JSON.stringify({ nombre: nombre, telefono: telefono }));
    document.getElementById("modalRegistroCliente").style.display = "none";
    loginCliente();
    
  } catch (error) {
    console.error("Error al registrar cliente:", error);
    alert("Hubo un error. Intentá de nuevo.");
    btn.disabled = false;
    btn.innerText = "Entrar al Catálogo 🚀";
  }
}

async function cargarVistaClientes() {
  toggleSidebar(); 
  document.getElementById("fundas").style.display = "none"; 
  document.getElementById("pantallaClientes").style.display = "block"; 
  
  const contenedor = document.getElementById("listaClientesRender");
  contenedor.innerHTML = "<p style='text-align:center;'>Cargando base de datos...</p>";

  try {
    const snapshot = await getDocs(collection(db, "clientes"));
    let html = `<table style="width:100%; text-align:left; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <tr style="background: #f5f5f7;">
                    <th style="padding: 15px; border-bottom: 2px solid #e5e5ea; color: #1d1d1f;">WhatsApp</th>
                    <th style="padding: 15px; border-bottom: 2px solid #e5e5ea; color: #1d1d1f;">Nombres (Historial)</th>
                  </tr>`;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const nombresUnidos = data.nombres.join(" / "); 
      const waLink = data.telefono.startsWith("+") ? data.telefono.substring(1) : data.telefono;
      html += `<tr>
                <td style="padding: 15px; border-bottom: 1px solid #e5e5ea; font-weight: 600;">
                   <a href="https://wa.me/${waLink}" target="_blank" style="color: #25D366; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                     📱 ${data.telefono}
                   </a>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #e5e5ea; color: #515154;">${nombresUnidos}</td>
               </tr>`;
    });
    html += `</table>`;
    contenedor.innerHTML = html;
  } catch (error) {
    console.error("Error al cargar lista de clientes:", error);
    contenedor.innerHTML = "<p style='text-align:center; color: red;'>Error al cargar la base de datos.</p>";
  }
}

// 🛒 --- SISTEMA DE CARRITO DE COMPRAS ---
function agregarAlCarrito() {
  const modeloSeleccionado = document.getElementById("reservaModelo").value;
  if (!modeloSeleccionado && !fundaReservando.sinModelo) {
      alert("Por favor, selecciona una variante/modelo disponible.");
      return;
  }

  const item = {
      id: fundaReservando.id,
      nombre: fundaReservando.nombre,
      modelo: fundaReservando.sinModelo ? "Único" : modeloSeleccionado,
      precio: fundaReservando.venta || 0,
      foto: fundaReservando.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=100&auto=format&fit=crop&q=60"
  };

  carritoDeCompras.push(item);
  guardarCarritoLocalStorage();
  actualizarUI_Carrito();
  cerrarModalReservar();
  
  const btnCarrito = document.getElementById("btnAbrirCarrito");
  btnCarrito.style.transform = "scale(1.1)";
  setTimeout(() => btnCarrito.style.transform = "scale(1)", 200);
}

function eliminarItemCarrito(index) {
  carritoDeCompras.splice(index, 1);
  guardarCarritoLocalStorage();
  actualizarUI_Carrito();
}

function guardarCarritoLocalStorage() {
  localStorage.setItem("carritoINeo", JSON.stringify(carritoDeCompras));
}

function actualizarUI_Carrito() {
  const lista = document.getElementById("listaItemsCarrito");
  const totalEl = document.getElementById("totalCarrito");
  const btnAbrir = document.getElementById("btnAbrirCarrito");
  const contador = document.getElementById("contadorCarrito");

  lista.innerHTML = "";
  let total = 0;

  if (carritoDeCompras.length === 0) {
      lista.innerHTML = "<p style='text-align:center; color:#6e6e73; margin-top: 50px;'>Tu carrito está vacío 🛒</p>";
      btnAbrir.style.display = "none";
      totalEl.innerText = "$0";
      contador.innerText = "0";
      return;
  }

  carritoDeCompras.forEach((item, index) => {
      total += item.precio;
      lista.innerHTML += `
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid #e5e5ea; padding-bottom: 15px;">
              <img src="${item.foto}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid #d2d2d7;">
              <div style="flex-grow: 1;">
                  <h4 style="margin: 0; font-size: 15px; color: #1d1d1f;">${item.nombre}</h4>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #6e6e73;">Variante: ${item.modelo}</p>
              </div>
              <div style="text-align: right;">
                  <p style="margin: 0; font-weight: 700; font-size: 15px; color: #0071e3;">$${item.precio}</p>
                  <button onclick="eliminarItemCarrito(${index})" style="background: none; border: none; color: #ff3b30; font-size: 12px; cursor: pointer; padding: 5px 0; margin-top: 5px; text-decoration: underline;">Quitar</button>
              </div>
          </div>
      `;
  });

  totalEl.innerText = `$${total}`;
  contador.innerText = carriageDeCompras.length; 
  btnAbrir.style.display = "block"; 
}

function abrirCarrito() { document.getElementById("modalCarrito").style.display = "flex"; }
function cerrarCarrito() { document.getElementById("modalCarrito").style.display = "none"; }

function enviarPedidoWhatsApp() {
  if(carritoDeCompras.length === 0) return;
  const datosClienteStr = localStorage.getItem("clienteINeoDatos");
  let nombreCliente = "Cliente";
  if(datosClienteStr) {
      const datos = JSON.parse(datosClienteStr);
      nombreCliente = datos.nombre;
  }

  let mensaje = `Hola iNeo Cases! 👋 Soy *${nombreCliente}* y este es mi pedido:\n\n`;
  let totalPedido = 0;

  carritoDeCompras.forEach(item => {
      mensaje += `📦 *${item.nombre}*\n`;
      if (item.modelo !== "Único" && item.modelo !== "") {
          mensaje += `⚙️ Variante: ${item.modelo}\n`;
      }
      mensaje += `💰 $${item.precio}\n`;
      mensaje += `────────────────\n`;
      totalPedido += item.precio;
  });

  mensaje += `\n🧾 *TOTAL ESTIMADO: $${totalPedido}*\n\n`;
  mensaje += `¿Podemos coordinar el pago y la entrega? ¡Gracias!`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
  cerrarCarrito();
}

// 📂 CREACIÓN Y GESTIÓN DE CATEGORÍAS
async function cargarCategorias() {
  try {
    const snapshot = await getDocs(collection(db, "categorias"));
    let lista = [];
    snapshot.forEach(doc => { lista.push({ id: doc.id, nombre: doc.data().nombre }); });
    listaCategorias = lista;
    renderizarPildorasCategorias();
    actualizarSelectFormulario();
    renderizarListaCrudCategorias();
  } catch (error) {
    console.error("Error al cargar categorías:", error);
  }
}

function renderizarPildorasCategorias() {
  const contenedor = document.getElementById("filtrosCategorias");
  if (!contenedor) return;

  let html = `<div class="categoria-pill ${categoriaSeleccionadaFiltro === 'Todas' ? 'active' : ''}" onclick="filtrarPorPildora('Todas')">Todas</div>`;
  listaCategorias.forEach(cat => {
    html += `<div class="categoria-pill ${categoriaSeleccionadaFiltro === cat.nombre ? 'active' : ''}" onclick="filtrarPorPildora('${cat.nombre}')">${cat.nombre}</div>`;
  });
  contenedor.innerHTML = html;
}

window.filtrarPorPildora = function(nombreCategoria) {
  categoriaSeleccionadaFiltro = nombreCategoria;
  renderizarPildorasCategorias();
  filtrarFundas();
};

function actualizarSelectFormulario() {
  const select = document.getElementById("categoriaSelect");
  if (!select) return;
  let html = "";
  listaCategorias.forEach(cat => {
    html += `<option value="${cat.nombre}">${cat.nombre}</option>`;
  });
  select.innerHTML = html;
}

function abrirModalCategorias() {
  toggleSidebar();
  document.getElementById("modalGestorCategorias").style.display = "flex";
}

function cerrarModalCategorias() {
  document.getElementById("modalGestorCategorias").style.display = "none";
  document.getElementById("nuevaCategoriaNombre").value = "";
}

async function crearNuevaCategoria() {
  const nombre = document.getElementById("nuevaCategoriaNombre").value.trim();
  if (!nombre) return alert("Ingresá un nombre válido para la categoría.");

  try {
    await addDoc(collection(db, "categorias"), { nombre: nombre });
    document.getElementById("nuevaCategoriaNombre").value = "";
    await cargarCategorias();
  } catch (error) {
    console.error("Error al crear categoría:", error);
  }
}

async function eliminarCategoria(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar la categoría "${nombre}"? Las fundas con esta categoría quedarán sin clasificar.`)) return;
  try {
    await deleteDoc(doc(db, "categorias", id));
    await cargarCategorias();
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
  }
}

function renderizarListaCrudCategorias() {
  const contenedor = document.getElementById("listaCategoriasCrud");
  if (!contenedor) return;

  if (listaCategorias.length === 0) {
    contenedor.innerHTML = `<p style="text-align:center; color:#6e6e73; font-size:13px; margin-top:20px;">No hay categorías creadas aún.</p>`;
    return;
  }

  let html = "";
  listaCategorias.forEach(cat => {
    html += `
      <div class="item-crud-categoria">
        <span>${cat.nombre}</span>
        <button class="btn-eliminar-cat" data-id="${cat.id}" data-nombre="${cat.nombre}">🗑️</button>
      </div>`;
  });
  contenedor.innerHTML = html;

  contenedor.querySelectorAll(".btn-eliminar-cat").forEach(btn => {
    btn.onclick = function() {
      eliminarCategoria(this.getAttribute("data-id"), this.getAttribute("data-nombre"));
    };
  });
}

// 📊 IMPORTACIÓN MASIVA DESDE EXCEL
async function procesarImportacionExcel(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = async function(e) {
    try {
      const datos = new Uint8Array(e.target.result);
      const libro = XLSX.read(datos, { type: 'array' });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja);

      if (filas.length === 0) return alert("El archivo de Excel se encuentra vacío.");

      if (confirm(`Se detectaron ${filas.length} filas en el archivo. ¿Deseas importarlas o actualizarlas en la base de datos?`)) {
        const batch = writeBatch(db);
        let contadorNuevos = 0;

        for (let fila of filas) {
          const nombreProducto = fila.Producto || fila.producto || fila.Nombre || fila.nombre;
          if (!nombreProducto) continue;

          const costoProd = Number(fila.Costo || fila.costo || 0);
          const ventaProd = Number(fila.Venta || fila.venta || fila.Precio || fila.precio || 0);
          const categoriaProd = fila.Categoria || fila.categoria || "Varios";
          const imagenProd = fila.Foto || fila.foto || fila.Imagen || fila.imagen || "";

          let stockArray = [];
          let esSinModelo = true;

          const variantesTexto = fila.Variantes || fila.variantes || fila.Modelos || fila.modelos || "";
          if (variantesTexto) {
            esSinModelo = false;
            stockArray = variantesTexto.split(",").map(v => {
              const [mod, cant] = v.split(":");
              return {
                modelo: mod ? mod.trim() : "",
                stock: cant ? Number(cant.trim()) : 0
              };
            }).filter(item => item.modelo !== "");
          } else {
            const cantSencilla = Number(fila.Stock || fila.stock || fila.Cantidad || fila.cantidad || 0);
            stockArray = [{ modelo: "Único", stock: cantSencilla }];
          }

          const coincidenciaExistente = todasLasFundas.find(f => f.nombre.toLowerCase().trim() === nombreProducto.toLowerCase().trim());

          if (coincidenciaExistente) {
            const docRef = doc(db, "fundas", coincidenciaExistente.id);
            batch.update(docRef, {
              categoria: categoriaProd,
              costo: costoProd,
              venta: ventaProd,
              stockPorModelo: stockArray,
              sinModelo: esSinModelo,
              foto: imagenProd || coincidenciaExistente.foto
            });
          } else {
            const nuevaRef = doc(collection(db, "fundas"));
            batch.set(nuevaRef, {
              nombre: nombreProducto,
              categoria: categoriaProd,
              costo: costoProd,
              venta: ventaProd,
              stockPorModelo: stockArray,
              sinModelo: esSinModelo,
              foto: imagenProd || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=300&auto=format&fit=crop&q=60",
              orden: todasLasFundas.length + contadorNuevos
            });
            contadorNuevos++;
          }
        }

        await batch.commit();
        alert("¡Importación y actualización de Excel completada con éxito!");
        await cargarFundas();
      }
    } catch (err) {
      console.error("Error al procesar archivo Excel:", err);
      alert("Error al leer el archivo Excel. Asegurate de que tenga el formato correcto.");
    }
    evento.target.value = ""; 
  };
  lector.readAsArrayBuffer(archivo);
}

// 📸 --- ESTUDIO FOTOGRÁFICO INTERACTIVO (FOTO PRO COPIADO DESDE ORIGINAL) ---
function abrirEditorFotoPro() {
  if (!fotoBase64) {
    alert("Primero debés cargar o seleccionar una foto en el formulario.");
    return;
  }
  document.getElementById("modalFotoPro").style.display = "flex";
  
  porcentajeEscala = 0.72;
  rotacionGrados = 0;
  canvasPosX = 500;
  canvasPosY = 500;
  opacidadSombra = 0.35;
  tipoFondoElegido = "estudio";

  document.getElementById("selectFondoPro").value = "estudio";
  document.getElementById("sliderSombra").value = "35";
  document.getElementById("valorSombra").innerText = "35%";
  document.getElementById("sliderRotacion").value = "0";
  document.getElementById("valorRotacion").innerText = "0°";

  document.getElementById("btnBorrarFondo").style.display = "inline-block";
  document.getElementById("btnReEditar").style.display = "none";

  imagenOriginalTemporal = new Image();
  imagenOriginalTemporal.src = fotoBase64;
  imagenOriginalTemporal.onload = () => {
    imagenRecortadaTemporal = null;
    fotoTransparenteBase64 = "";
    dibujarCanvasGestos();
  };
}

function cerrarEditorFotoPro() {
  document.getElementById("modalFotoPro").style.display = "none";
}

async function ejecutarBorradoFondoIA() {
  const btn = document.getElementById("btnBorrarFondo");
  btn.disabled = true;
  btn.innerText = "⏳ Removiendo Fondo...";

  try {
    const rawBase64 = fotoBase64.split(",")[1];
    const formData = new FormData();
    formData.append("image_file_b64", rawBase64);
    formData.append("size", "auto");

    const respuesta = await fetch("https://api.remove.bg/v1.3/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_API_KEY },
      body: formData
    });

    if (!respuesta.ok) throw new Error("Fallo en API de Remove.bg");

    const blob = await respuesta.blob();
    const lector = new FileReader();
    lector.onloadend = () => {
      fotoTransparenteBase64 = lector.result;
      imagenRecortadaTemporal = new Image();
      imagenRecortadaTemporal.src = fotoTransparenteBase64;
      imagenRecortadaTemporal.onload = () => {
        btn.disabled = false;
        btn.innerText = "✨ Fondo Removido!";
        btn.style.display = "none";
        document.getElementById("btnReEditar").style.display = "inline-block";
        dibujarCanvasGestos();
      };
    };
    lector.readAsDataURL(blob);

  } catch (error) {
    console.error(error);
    alert("No se pudo remover el fondo. Verificá tu API Key o conexión.");
    btn.disabled = false;
    btn.innerText = "✨ Borrar Fondo con IA";
  }
}

function reEditarMontaje() {
  imagenRecortadaTemporal = null;
  fotoTransparenteBase64 = "";
  document.getElementById("btnReEditar").style.display = "none";
  document.getElementById("btnBorrarFondo").style.display = "inline-block";
  document.getElementById("btnBorrarFondo").innerText = "✨ Borrar Fondo con IA";
  dibujarCanvasGestos();
}

function configurarGestosCanvas() {
  const canvas = document.getElementById("canvasFotoPro");
  if (!canvas) return;

  let estaArrastrando = false;
  let ultimaX, ultimaY;
  let distanciaInicialPinch = 0;

  // Soporte Mouse
  canvas.addEventListener("mousedown", (e) => {
    estaArrastrando = true;
    ultimaX = e.clientX;
    ultimaY = e.clientY;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!estaArrastrando) return;
    const dx = e.clientX - ultimaX;
    const dy = e.clientY - ultimaY;
    canvasPosX += dx * 2; 
    canvasPosY += dy * 2; 
    ultimaX = e.clientX;
    ultimaY = e.clientY;
    dibujarCanvasGestos();
  });

  window.addEventListener("mouseup", () => { estaArrastrando = false; });

  // Soporte Rueda de Mouse para Zoom rápido
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      porcentajeEscala = Math.min(porcentajeEscala + 0.04, 3);
    } else {
      porcentajeEscala = Math.max(porcentajeEscala - 0.04, 0.1);
    }
    dibujarCanvasGestos();
  }, { passive: false });

  // Soporte Táctil (Mobile Gestures)
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      estaArrastrando = true;
      ultimaX = e.touches[0].clientX;
      ultimaY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      estaArrastrando = false;
      distanciaInicialPinch = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    if (estaArrastrando && e.touches.length === 1) {
      const dx = e.touches[0].clientX - ultimaX;
      const dy = e.touches[0].clientY - ultimaY;
      canvasPosX += dx * 2;
      canvasPosY += dy * 2;
      ultimaX = e.touches[0].clientX;
      ultimaY = e.touches[0].clientY;
      dibujarCanvasGestos();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / distanciaInicialPinch;
      distanciaInicialPinch = dist;
      porcentajeEscala = Math.max(0.1, Math.min(porcentajeEscala * factor, 3));
      dibujarCanvasGestos();
    }
  });

  canvas.addEventListener("touchend", () => { estaArrastrando = false; });
}

function dibujarCanvasGestos() {
  const canvas = document.getElementById("canvasFotoPro");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let imagenADibujar = imagenRecortadaTemporal || imagenOriginalTemporal;
  if (!imagenADibujar) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Lógica del selector de fondos
  if (tipoFondoElegido === "estudio") {
    if (imgFondoEstudio.complete && imgFondoEstudio.naturalWidth > 0) {
      ctx.drawImage(imgFondoEstudio, 0, 0, canvas.width, canvas.height);
    } else {
      const grad = ctx.createRadialGradient(500, 500, 100, 500, 500, 700);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#d2d2d7");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else if (tipoFondoElegido === "blanco") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#f5f5f7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (imagenOriginalTemporal) {
      ctx.drawImage(imagenOriginalTemporal, 0, 0, canvas.width, canvas.height);
    }
  }

  // Si el fondo es el original y no hay recorte, no volvemos a dibujar el objeto arriba
  if (tipoFondoElegido === "original" && !imagenRecortadaTemporal) return;

  ctx.save();
  ctx.translate(canvasPosX, canvasPosY);
  ctx.rotate((rotacionGrados * Math.PI) / 180);

  const wO = imagenADibujar.naturalWidth || 600;
  const hO = imagenADibujar.naturalHeight || 600;
  const maxDim = Math.max(wO, hO);
  const factorFit = 800 / maxDim;
  const finalW = wO * factorFit * porcentajeEscala;
  const finalH = hO * factorFit * porcentajeEscala;

  // Dibujar sombra suave estilizada de Apple si hay recorte
  if (imagenRecortadaTemporal && opacidadSombra > 0) {
    ctx.shadowColor = `rgba(0, 0, 0, ${opacidadSombra})`;
    ctx.shadowBlur = 45;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 25;
  }

  ctx.drawImage(imagenADibujar, -finalW / 2, -finalH / 2, finalW, finalH);
  ctx.restore();
}

async function aplicarMontajeFinal() {
  const btn = document.getElementById("btnGuardarFotoPro");
  btn.disabled = true;
  btn.innerText = "⏳ Guardando en Formulario...";

  try {
    const canvas = document.getElementById("canvasFotoPro");
    const base64MontajeCompleto = canvas.toDataURL("image/jpeg", 0.9);

    // Actualizamos la vista previa del formulario principal
    const preview = document.getElementById("previewFoto");
    preview.src = base64MontajeCompleto;
    preview.style.display = "block";

    // Reasignamos las variables globales correspondientes
    fotoBase64 = base64MontajeCompleto;

    alert("¡Montaje fotográfico aplicado con éxito al formulario!");
    cerrarEditorFotoPro();
  } catch (error) {
    console.error(error);
    alert("Hubo un problema al aplicar el lienzo.");
  } finally {
    btn.disabled = false;
    btn.innerText = "💾 Aplicar Estudio a Producto";
  }
}

// --- FORMATEADOR INTELIGENTE DE TEXTO ---
function toggleFormateador() {
  const modal = document.getElementById("modalFormatearTexto");
  if (modal.style.display === "flex") {
    modal.style.display = "none";
  } else {
    modal.style.display = "flex";
    document.getElementById("textoIngresoStock").value = "";
    document.getElementById("textoIngresoStock").focus();
  }
}

function toggleMenuMenuIA() {
  const menu = document.getElementById("menuAccionesIA");
  menu.style.display = (menu.style.display === "block") ? "none" : "block";
}

function procesarTextoStock() {
  const rawText = document.getElementById("textoIngresoStock").value.trim();
  if (!rawText) return alert("Por favor ingresá algún texto descriptivo.");

  try {
    let lineas = rawText.split("\n");
    let nombreDetectado = "";
    let modelosDetectados = [];
    let precioVenta = 0;

    lineas.forEach(linea => {
      let l = linea.toLowerCase();
      if (l.includes("funda") || l.includes("case") || l.includes("funda premium")) {
        nombreDetectado = linea.replace(/funda|case/gi, "").trim();
        nombreDetectado = "Funda " + nombreDetectado.charAt(0).toUpperCase() + nombreDetectado.slice(1);
      }
      if (l.includes("iphone") || l.includes("samsung") || l.includes("moto") || l.includes("xiaomi")) {
        let partes = linea.split(/[:\-]/);
        if (partes.length >= 2) {
          let mod = partes[0].trim();
          let cant = parseInt(partes[1].replace(/[^\d]/g, "")) || 0;
          modelosDetectados.push(`${mod}:${cant}`);
        } else {
          modelosDetectados.push(`${linea.trim()}:1`);
        }
      }
      if (l.includes("$") || l.includes("precio") || l.includes("venta")) {
        let num = parseInt(linea.replace(/[^\d]/g, ""));
        if (num > 0) precioVenta = num;
      }
    });

    if (nombreDetectado) document.getElementById("nombre").value = nombreDetectado;
    if (precioVenta > 0) document.getElementById("venta").value = precioVenta;
    if (modelosDetectados.length > 0) {
      document.getElementById("stockPorModelo").value = modelosDetectados.join(", ");
      if (esProductoSinModelo) {
        toggleModoModelo();
      }
    }

    alert("¡Texto procesado! Se autocompletaron los campos detectados en el formulario.");
    toggleFormateador();

  } catch (err) {
    console.error(err);
    alert("No se pudo parsear el bloque de texto. Verifique el formato e intente nuevamente.");
  }
}

// --- GESTIÓN DE FORMULARIO DE PRODUCTOS ---
function mostrarFormulario() {
  ocultarAsistente();
  document.getElementById("nombre").value = "";
  document.getElementById("stockPorModelo").value = "";
  document.getElementById("stockTotalSencillo").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("previewFoto").removeAttribute("src");
  document.getElementById("previewFoto").style.display = "none";
  
  idFundaEditando = null;
  fotoBase64 = "";
  fotoTransparenteBase64 = "";
  urlTransparenteGuardada = "";
  imagenOriginalTemporal = null;
  imagenRecortadaTemporal = null;

  esProductoSinModelo = false;
  const btnToggleModelo = document.getElementById("btnToggleModelo");
  const compContainer = document.getElementById("campoCompatibilidadesContainer");
  const sencContainer = document.getElementById("campoStockSencilloContainer");
  
  btnToggleModelo.textContent = "📱 Por Modelo";
  btnToggleModelo.style.background = "#0071e3";
  compContainer.style.display = "block";
  sencContainer.style.display = "none";

  document.getElementById("fundas").style.display = "none";
  document.getElementById("pantallaClientes").style.display = "none";
  document.getElementById("agregar").style.display = "flex";
}

function ocultarFormulario() {
  idFundaEditando = null;
  fotoBase64 = "";
  fotoTransparenteBase64 = "";
  urlTransparenteGuardada = "";
  imagenOriginalTemporal = null;
  imagenRecortadaTemporal = null;
  document.getElementById("agregar").style.display = "none";
}

function toggleModoModelo() {
  esProductoSinModelo = !esProductoSinModelo;
  const btnToggleModelo = document.getElementById("btnToggleModelo");
  const compContainer = document.getElementById("campoCompatibilidadesContainer");
  const sencContainer = document.getElementById("campoStockSencilloContainer");

  if (esProductoSinModelo) {
    btnToggleModelo.textContent = "🚫 No Modelo";
    btnToggleModelo.style.background = "#6e6e73";
    compContainer.style.display = "none";
    sencContainer.style.display = "block";
  } else {
    btnToggleModelo.textContent = "📱 Por Modelo";
    btnToggleModelo.style.background = "#0071e3";
    compContainer.style.display = "block";
    sencContainer.style.display = "none";
  }
}

function mostrarAsistente() {
  if (!esAdmin) return;
  document.getElementById("asistenteProducto").value = "";
  document.getElementById("asistenteModelo").value = "";
  document.getElementById("asistenteUnidades").value = "1";
  document.getElementById("modalAsistente").style.display = "flex";
}

function ocultarAsistente() {
  document.getElementById("modalAsistente").style.display = "none";
}

function actualizarDatalistBuscador() {
  const datalist = document.getElementById("sugerenciasBuscador");
  if (!datalist) return;
  const sugerencias = new Set();
  todasLasFundas.forEach(f => {
    if (f.nombre) sugerencias.add(f.nombre);
    if (Array.isArray(f.stockPorModelo)) {
      f.stockPorModelo.forEach(m => {
        if (m.modelo && m.modelo !== "Único") sugerencias.add(m.modelo);
      });
    }
  });
  let html = "";
  sugerencias.forEach(val => {
    html += `<option value="${val}"></option>`;
  });
  datalist.innerHTML = html;
}

function procesarImagen(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function(evento) {
    fotoBase64 = evento.target.result;
    const preview = document.getElementById("previewFoto");
    preview.src = fotoBase64;
    preview.style.display = "block";
    
    // Reseteamos estados anteriores de Foto Pro al cambiar de imagen
    imagenOriginalTemporal = null;
    imagenRecortadaTemporal = null;
    fotoTransparenteBase64 = "";
    urlTransparenteGuardada = "";
  };
  lector.readAsDataURL(archivo);
}

async function subirAImgbb(base64Data) {
  const rawBase64 = base64Data.split(",")[1];
  const cuerpo = new FormData();
  cuerpo.append("image", rawBase64);

  const respuesta = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: cuerpo
  });
  const dataJSON = await respuesta.json();
  if (dataJSON.success) {
    return dataJSON.data.url;
  } else {
    throw new Error("Fallo al subir a ImgBB");
  }
}

async function guardarFunda() {
  const btn = document.getElementById("guardarFunda");
  btn.disabled = true;
  btn.innerText = "⏳ Guardando...";

  let urlImagenFinal = "";
  let urlTransparenteFinal = "";

  // 1. Manejo de Subida de Imagenes a ImgBB
  try {
    if (fotoBase64 && fotoBase64.startsWith("data:image")) {
      urlImagenFinal = await subirAImgbb(fotoBase64);
    } else if (idFundaEditando) {
      const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
      if (vieja) urlImagenFinal = vieja.foto || "";
    }

    if (fotoTransparenteBase64 && fotoTransparenteBase64.startsWith("data:image")) {
      urlTransparenteFinal = await subirAImgbb(fotoTransparenteBase64);
    } else if (idFundaEditando) {
      const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
      if (vieja) urlTransparenteFinal = vieja.fotoTransparente || "";
    }
  } catch (err) {
    console.error("Error al alojar imágenes:", err);
    alert("Error al subir la imagen a la nube. Probá de nuevo.");
    btn.disabled = false;
    btn.innerText = "Guardar Case 💾";
    return;
  }

  // 2. Armado del Array de Stock según Modo Seleccionado
  let stockPorModeloArray = [];
  if (esProductoSinModelo) {
    const unidadesTotales = Number(document.getElementById("stockTotalSencillo").value) || 0;
    stockPorModeloArray = [{ modelo: "Único", stock: unidadesTotales }];
  } else {
    const compatiblesInput = document.getElementById("stockPorModelo").value;
    stockPorModeloArray = compatiblesInput.split(",")
      .map(item => {
        const [modelo, cantidad] = item.split(":");
        return {
          modelo: modelo ? modelo.trim() : "",
          stock: cantidad ? Number(cantidad.trim()) : 0
        };
      }).filter(item => item.modelo !== "");
  }

  const datosFunda = {
    nombre: document.getElementById("nombre").value,
    categoria: document.getElementById("categoriaSelect").value,
    stockPorModelo: stockPorModeloArray,
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: urlImagenFinal,
    fotoTransparente: urlTransparenteFinal,
    sinModelo: esProductoSinModelo
  };

  if (!idFundaEditando) datosFunda.orden = todasLasFundas.length;

  try {
    if (idFundaEditando) {
      if (urlImagenFinal === "" && !fotoBase64) {
        const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
        if (vieja && vieja.foto) datosFunda.foto = vieja.foto;
      }
      await updateDoc(doc(db, "fundas", idFundaEditando), datosFunda);
    } else {
      if (!datosFunda.foto) {
        datosFunda.foto = "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=300&auto=format&fit=crop&q=60";
      }
      await addDoc(collection(db, "fundas"), datosFunda);
    }

    ocultarFormulario();
    document.getElementById("fundas").style.display = "grid";
    await cargarFundas();

  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Error de conexión al guardar en la base de datos.");
  } finally {
    btn.disabled = false;
    btn.innerText = "Guardar Case 💾";
  }
}

window.editarFunda = function(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  mostrarFormulario();
  idFundaEditando = id;

  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("categoriaSelect").value = funda.categoria || "";
  document.getElementById("costo").value = funda.costo ?? "";
  document.getElementById("venta").value = funda.venta ?? "";

  fotoBase64 = funda.foto || "";
  fotoTransparenteBase64 = funda.fotoTransparente || "";

  esProductoSinModelo = !!funda.sinModelo;
  const btnToggleModelo = document.getElementById("btnToggleModelo");
  const compContainer = document.getElementById("campoCompatibilidadesContainer");
  const sencContainer = document.getElementById("campoStockSencilloContainer");
  const stockTotalSencillo = document.getElementById("stockTotalSencillo");

  if (esProductoSinModelo) {
    btnToggleModelo.textContent = "🚫 No Modelo";
    btnToggleModelo.style.background = "#6e6e73";
    compContainer.style.display = "none";
    sencContainer.style.display = "block";
    if (Array.isArray(funda.stockPorModelo) && funda.stockPorModelo.length > 0) {
      stockTotalSencillo.value = funda.stockPorModelo[0].stock || 0;
    }
  } else {
    btnToggleModelo.textContent = "📱 Por Modelo";
    btnToggleModelo.style.background = "#0071e3";
    compContainer.style.display = "block";
    sencContainer.style.display = "none";
    stockTotalSencillo.value = "";
    if (Array.isArray(funda.stockPorModelo)) {
      document.getElementById("stockPorModelo").value = funda.stockPorModelo.map(m => `${m.modelo}:${m.stock}`).join(", ");
    }
  }

  const preview = document.getElementById("previewFoto");
  if (funda.foto) {
    preview.src = funda.foto;
    preview.style.display = "block";
    
    // Convertimos la imagen previa de imgbb en el original temporal para habilitar el re-editado pro
    const imgOld = new Image();
    imgOld.crossOrigin = "anonymous";
    imgOld.src = funda.foto;
    imgOld.onload = () => {
      imagenOriginalTemporal = imgOld;
      if (funda.fotoTransparente) {
        const imgTrans = new Image();
        imgTrans.crossOrigin = "anonymous";
        imgTrans.src = funda.fotoTransparente;
        imgTrans.onload = () => {
          imagenRecortadaTemporal = imgTrans;
          fotoTransparenteBase64 = funda.fotoTransparente;
        };
      }
    };
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
};

window.eliminarFunda = async function(id) {
  if (!confirm("¿Seguro que querés eliminar esta funda permanentemente?")) return;
  try {
    await deleteDoc(doc(db, "fundas", id));
    await cargarFundas();
  } catch (error) {
    console.error("Error al eliminar:", error);
  }
};

// --- SISTEMA REVOLUCIONARIO DE ASISTENTE DE VENTAS RÁPIDAS ---
async function procesarVentaAsistente() {
  const btn = document.getElementById("btnRegistrarVenta");
  const nombreBuscado = document.getElementById("asistenteProducto").value.trim().toLowerCase();
  const modeloBuscado = document.getElementById("asistenteModelo").value.trim().toLowerCase();
  const unidadesAVender = Number(document.getElementById("asistenteUnidades").value) || 1;

  if (!nombreBuscado) return alert("Por favor indica el nombre del producto.");

  const producto = todasLasFundas.find(f => f.nombre.toLowerCase().trim() === nombreBuscado);
  if (!producto) return alert("Producto no encontrado exacto. Escribilo tal cual figura en el catálogo.");

  if (!Array.isArray(producto.stockPorModelo) || producto.stockPorModelo.length === 0) {
    return alert("Este producto no posee variantes ni stock registrado.");
  }

  let varianteModificable = null;
  if (producto.sinModelo) {
    varianteModificable = producto.stockPorModelo[0];
  } else {
    if (!modeloBuscado) return alert("Este producto requiere especificar un modelo exacto.");
    varianteModificable = producto.stockPorModelo.find(m => m.modelo.toLowerCase().trim() === modeloBuscado);
  }

  if (!varianteModificable) return alert("Variante/Modelo no encontrado para este producto.");

  if (varianteModificable.stock < unidadesAVender) {
    return alert(`Stock insuficiente. Solo quedan ${varianteModificable.stock} unidades de esta variante.`);
  }

  btn.disabled = true;
  btn.innerText = "⏳ Impactando Stock...";

  try {
    varianteModificable.stock -= unidadesAVender;
    await updateDoc(doc(db, "fundas", producto.id), {
      stockPorModelo: producto.stockPorModelo
    });

    alert(`¡Venta procesada con éxito! Se descontaron ${unidadesAVender} unidades de la variante.`);
    ocultarAsistente();
    await cargarFundas();

  } catch (err) {
    console.error(err);
    alert("Ocurrió un error al intentar impactar la base de datos.");
  } finally {
    btn.disabled = false;
    btn.innerText = "Registrar Descuento en Firebase ⚡";
  }
}

// --- CARGA, RENDERIZADO Y FILTRADO CON DRAG & DROP MULTIPLATAFORMA ---
async function cargarFundas() {
  try {
    const q = query(collection(db, "fundas"), orderBy("orden", "asc"));
    const snapshot = await getDocs(q);
    let lista = [];
    snapshot.forEach(doc => {
      lista.push({ id: doc.id, ...doc.data() });
    });
    todasLasFundas = lista;
    
    actualizarDatalistBuscador();
    renderizarFundas(todasLasFundas);

    const loader = document.getElementById("cargando");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => { loader.style.display = "none"; }, 400);
    }
  } catch (error) {
    console.error("Error al descargar catálogo:", error);
  }
}

function renderizarFundas(listaDeFundas) {
  const textoBuscado = document.getElementById("buscar").value.toLowerCase().trim();
  let html = "";

  listaDeFundas.forEach((f) => {
    let bloqueStockHTML = "";
    let tieneStockGlobal = false;

    if (Array.isArray(f.stockPorModelo)) {
      f.stockPorModelo.forEach(m => { if (m.stock > 0) tieneStockGlobal = true; });

      if (f.sinModelo) {
        const cant = (f.stockPorModelo[0] && f.stockPorModelo[0].stock) || 0;
        bloqueStockHTML = `<p class="${cant > 0 ? 'stock-disponible' : 'stock-agotado'}">Stock: ${cant} u.</p>`;
      } else {
        let detalleModelos = f.stockPorModelo.map(m => `• ${m.modelo}: ${m.stock} u.`).join("<br>");
        bloqueStockHTML = `
          <div class="stock-container-lista">
             <button class="btn-ver-stock" onclick="this.nextElementSibling.style.display='block'; this.style.display='none'">📱 Ver Modelos Disponibles</button>
             <div class="modelos-lista-desplegable" style="display:none;">
                <button class="btn-ocultar-stock" onclick="this.parentElement.previousElementSibling.style.display='block'; this.parentElement.style.display='none'">🙈 Ocultar Detalle</button>
                <p style="margin:8px 0 0 0; font-size:12px; line-height:1.4; color:#515154;">${detalleModelos}</p>
             </div>
          </div>`;
      }
    }

    let bloqueAcciones = "";
    if (esAdmin) {
      bloqueAcciones = `
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button onclick="editarFunda('${f.id}')" style="flex:1; background:#86868b; color:white; border:none; padding:8px; border-radius:8px; font-weight:600; cursor:pointer; font-size:13px;">Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30; color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:600; cursor:pointer; font-size:13px;">🗑️</button>
        </div>`;
    } else {
      bloqueAcciones = `
        <button onclick="abrirModalReservar('${f.id}')" style="width:100%; background:#0071e3; color:white; border:none; padding:10px; border-radius:8px; font-weight:600; margin-top:12px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; gap:6px;">
          🛒 Agregar al Carrito
        </button>`;
    }

    let bloqueMétricasAdmin = "";
    if (esAdmin) {
      const ganancia = (f.venta || 0) - (f.costo || 0);
      bloqueMétricasAdmin = `
        <div style="background:#f5f5f7; padding:8px; border-radius:8px; margin-top:8px; font-size:11px; color:#6e6e73;">
          <strong>Costo:</strong> $${f.costo || 0} | <strong>Rendimiento:</strong> <span style="color:#28a745; font-weight:bold;">+$${ganancia}</span>
        </div>`;
    }

    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=300&auto=format&fit=crop&q=60";

    html += `
    <div class="card" data-id="${f.id}" style="opacity: ${tieneStockGlobal ? '1' : '0.55'};">
      ${esAdmin && textoBuscado === "" && categoriaSeleccionadaFiltro === "Todas" ? `<div class="drag-handle" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.85); padding: 4px 8px; border-radius: 6px; cursor: move; font-size: 14px;">☰</div>` : ''}
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        ${bloqueStockHTML}
        <p>$${f.venta ?? 0}</p>
        ${bloqueMétricasAdmin}
        ${bloqueAcciones}
      </div>
    </div>
    `;
  });
  document.getElementById("fundas").innerHTML = html;

  if (esAdmin && textoBuscado === "" && categoriaSeleccionadaFiltro === "Todas") {
    habilitarReordenamiento();
  }

  // Dispara el listener de imágenes si el loader sigue visible en pantalla
  const loader = document.getElementById("cargando");
  if (loader && window.getComputedStyle(loader).display !== "none") {
    controlarCargaDeImagenes();
  }
}

function filtrarFundas() {
  const textoBuscado = document.getElementById("buscar").value.toLowerCase().trim();

  const fundasFiltradas = todasLasFundas.filter((f) => {
    if (categoriaSeleccionadaFiltro !== "Todas" && f.categoria !== categoriaSeleccionadaFiltro) return false;
    const nombreFunda = f.nombre ? f.nombre.toLowerCase() : "";
    const nombreCoincide = nombreFunda.includes(textoBuscado);
    let compatibleCoincide = false;
    if (Array.isArray(f.stockPorModelo)) {
      compatibleCoincide = f.stockPorModelo.some(m => m.modelo.toLowerCase().includes(textoBuscado));
    }
    return nombreCoincide || compatibleCoincide;
  });

  renderizarFundas(fundasFiltradas);
}

function habilitarReordenamiento() {
  const el = document.getElementById("fundas");
  if (!el) return;

  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = new Sortable(el, {
    handle: ".drag-handle",
    animation: 150,
    ghostClass: "sortable-ghost",
    onEnd: async function () {
      const cards = el.querySelectorAll(".card");
      const nuevosOrdenes = [];
      cards.forEach((card, index) => {
        nuevosOrdenes.push({
          id: card.getAttribute("data-id"),
          nuevoOrden: index
        });
      });
      await actualizarOrdenEnFirebase(nuevosOrdenes);
    }
  });
}

async function actualizarOrdenEnFirebase(listaOrdenada) {
  try {
    const batch = writeBatch(db);
    listaOrdenada.forEach(item => {
      const docRef = doc(db, "fundas", item.id);
      batch.update(docRef, { orden: item.nuevoOrden });
    });
    await batch.commit();
    console.log("Nuevo orden establecido con éxito.");
  } catch (error) {
    console.error("Error al guardar nuevo orden de arrastre:", error);
  }
}

function controlarCargaDeImagenes() {
  const imagenes = document.querySelectorAll(".card-img");
  if (imagenes.length === 0) return;

  let cargadas = 0;
  imagenes.forEach(img => {
    if (img.complete) {
      cargadas++;
    } else {
      img.addEventListener("load", () => {
        cargadas++;
        if (cargadas === imagenes.length) {
          ocultarLoaderCompleto();
        }
      });
      img.addEventListener("error", () => {
        cargadas++;
        if (cargadas === imagenes.length) {
          ocultarLoaderCompleto();
        }
      });
    }
  });

  if (cargadas === imagenes.length) {
    ocultarLoaderCompleto();
  }
}

function ocultarLoaderCompleto() {
  const loader = document.getElementById("cargando");
  if (loader) {
    loader.style.opacity = "0";
    setTimeout(() => { loader.style.display = "none"; }, 400);
  }
}

// --- MODAL DE RESERVAS / DETALLE DE PRODUCTO PARA CLIENTES ---
window.abrirModalReservar = function(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  fundaReservando = funda;
  document.getElementById("reservaNombre").innerText = funda.nombre || "Sin nombre";
  document.getElementById("reservaPrecio").innerText = `$${funda.venta || 0}`;
  
  const imgEl = document.getElementById("reservaFoto");
  imgEl.src = funda.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=300&auto=format&fit=crop&q=60";

  const select = document.getElementById("reservaModelo");
  const containerSelect = document.getElementById("contenedorSelectorReserva");
  select.innerHTML = "";

  if (funda.sinModelo) {
    containerSelect.style.display = "none";
  } else {
    containerSelect.style.display = "block";
    if (Array.isArray(funda.stockPorModelo)) {
      funda.stockPorModelo.forEach(m => {
        if (m.stock > 0) {
          const op = document.createElement("option");
          op.value = m.modelo;
          op.innerText = `${m.modelo} (Disponibles: ${m.stock})`;
          select.appendChild(op);
        }
      });
    }
    if (select.children.length === 0) {
      const op = document.createElement("option");
      op.value = "";
      op.innerText = "Sin stock de variantes";
      select.appendChild(op);
    }
  }

  document.getElementById("modalReservar").style.display = "flex";
};

window.cerrarModalReservar = function() {
  document.getElementById("modalReservar").style.display = "none";
  fundaReservando = null;
};
