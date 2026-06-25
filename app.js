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
let rolUsuario = "cliente"; // Identifica si es "cliente" o "mayorista"
let todasLasFundas = [];
let listaCategorias = []; 
let categoriaSeleccionadaFiltro = "Todas"; 
let idFundaEditando = null;
let fotoBase64 = ""; 
let esAdmin = false; 
let fundaReservando = null; 
let sortableInstance = null; 
let esProductoSinModelo = false; 

// Variables globales para Banner y Descuentos Avanzados
let urlBannerActual = "";
let descuentoGlobal = 0;
let tipoDescuento = "global"; // "global" o "especifico"
let productosDescuento = []; // Array con IDs de productos si es específico

// 📸 VARIABLES PARA FOTO PRO INTERACTIVA (MODAL SEPARADO)
let imagenOriginalTemporal = null; 
let imagenRecortadaTemporal = null; 
let fotoTransparenteBase64 = ""; 
let urlTransparenteGuardada = ""; 
let opacidadSombra = 0.35;
let tipoFondoElegido = "estudio";
let porcentajeEscala = 0.72; 
let rotacionGrados = 0;
let nivelBrillo = 100;
let canvasPosX = 500;
let canvasPosY = 500;
let imgFondoEstudio = new Image();
imgFondoEstudio.src = "fondo-estudio.png"; 

// 🛒 Variables del Carrito de Compras
let carritoDeCompras = JSON.parse(localStorage.getItem("carritoINeo")) || [];

// --- INICIALIZACIÓN DE EVENTOS Y PROTECCIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const barra = document.getElementById("loaderProgreso");
  if (barra) barra.style.width = "15%";

  cargarConfiguracionTienda(); // Carga el banner y los descuentos al iniciar

  const inputBuscar = document.getElementById("buscar");
  if (inputBuscar && !document.getElementById("sugerenciasBuscador")) {
    const datalist = document.createElement("datalist");
    datalist.id = "sugerenciasBuscador";
    document.body.appendChild(datalist);
    inputBuscar.setAttribute("list", "sugerenciasBuscador");
  }

  // Asignación de eventos de la interfaz principal
  if(document.getElementById("btnLogin")) document.getElementById("btnLogin").onclick = loginAdmin;
  
  function validarYEntrar() {
    const datosCliente = localStorage.getItem("clienteINeoDatos");
    if (!datosCliente) {
      document.getElementById("modalRegistroCliente").style.display = "flex";
    } else {
      loginCliente();
    }
  }

  if(document.getElementById("btnCliente")) {
    document.getElementById("btnCliente").onclick = (e) => {
      e.preventDefault();
      rolUsuario = "cliente";
      validarYEntrar();
    };
  }

  if(document.getElementById("btnMayorista")) {
    document.getElementById("btnMayorista").onclick = (e) => {
      e.preventDefault();
      rolUsuario = "mayorista";
      validarYEntrar();
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

  // --- EVENTOS MODAL BANNER Y DESCUENTOS ---
  if(document.getElementById("btnAbrirBanner")) {
    document.getElementById("btnAbrirBanner").onclick = () => {
      toggleSidebar();
      document.getElementById("modalBanner").style.display = "flex";
    };
  }
  if(document.getElementById("btnCerrarBanner")) {
    document.getElementById("btnCerrarBanner").onclick = () => {
      document.getElementById("modalBanner").style.display = "none";
    };
  }
  if(document.getElementById("btnGuardarBanner")) {
    document.getElementById("btnGuardarBanner").onclick = subirYGuardarBanner;
  }

  // --- NUEVA LÓGICA DE UI PARA DESCUENTOS ---
  if(document.getElementById("btnAbrirDescuentos")) {
    document.getElementById("btnAbrirDescuentos").onclick = () => {
      toggleSidebar();
      document.getElementById("inputPorcentajeDescuento").value = descuentoGlobal;
      document.getElementById("selectTipoDescuento").value = tipoDescuento;
      renderizarListaDescuentosUI();
      toggleSeleccionProductosUI();
      document.getElementById("modalDescuentos").style.display = "flex";
    };
  }
  if(document.getElementById("selectTipoDescuento")) {
    document.getElementById("selectTipoDescuento").onchange = toggleSeleccionProductosUI;
  }
  if(document.getElementById("btnCerrarDescuentos")) {
    document.getElementById("btnCerrarDescuentos").onclick = () => {
      document.getElementById("modalDescuentos").style.display = "none";
    };
  }
  if(document.getElementById("btnGuardarDescuentos")) {
    document.getElementById("btnGuardarDescuentos").onclick = guardarDescuentoGlobal;
  }

  // --- EVENTOS DEL MODAL FOTO PRO ---
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
  if(document.getElementById("sliderBrillo")) {
    document.getElementById("sliderBrillo").oninput = (e) => {
      nivelBrillo = parseInt(e.target.value);
      document.getElementById("valorBrillo").innerText = e.target.value + "%";
      dibujarCanvasGestos();
    };
  }
  if(document.getElementById("btnGuardarFotoPro")) {
    document.getElementById("btnGuardarFotoPro").onclick = aplicarMontajeFinal;
  }

  configurarGestosCanvas();
  actualizarUI_Carrito();
});

// --- LÓGICA BANNER Y DESCUENTOS ---
async function cargarConfiguracionTienda() {
  try {
    const docRef = doc(db, "configuracion", "tienda");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      urlBannerActual = data.bannerUrl || "";
      
      // Cargar configuraciones de descuento avanzadas
      descuentoGlobal = data.descuento || 0;
      tipoDescuento = data.tipo || "global";
      productosDescuento = data.productosIds || [];
      
      const contenedorBanner = document.getElementById("contenedorBannerTienda");
      const imgBanner = document.getElementById("imgBannerTienda");
      
      if (urlBannerActual && contenedorBanner && imgBanner) {
        imgBanner.src = urlBannerActual;
        
        const appDiv = document.getElementById("app");
        const topBar = document.querySelector(".top-bar");
        if (appDiv && topBar) {
          appDiv.insertBefore(contenedorBanner, topBar);
        }
        
        contenedorBanner.style.display = "block";
      }
    }
  } catch (error) {
    console.error("Error cargando configuración:", error);
  }
}

async function subirYGuardarBanner() {
  const fileInput = document.getElementById("inputFotoBanner");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Seleccioná una imagen para el banner.");
    return;
  }

  const btn = document.getElementById("btnGuardarBanner");
  btn.disabled = true;
  btn.innerText = "⏳ Subiendo...";

  const archivo = fileInput.files[0];
  const formData = new FormData();
  formData.append("image", archivo);

  try {
    const respuesta = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData
    });
    const datosDeSubida = await respuesta.json();
    
    if (datosDeSubida.success) {
      const nuevaUrlBanner = datosDeSubida.data.url;
      await setDoc(doc(db, "configuracion", "tienda"), { bannerUrl: nuevaUrlBanner }, { merge: true });
      
      urlBannerActual = nuevaUrlBanner;
      const imgBanner = document.getElementById("imgBannerTienda");
      const contenedorBanner = document.getElementById("contenedorBannerTienda");
      
      if (imgBanner && contenedorBanner) {
        imgBanner.src = nuevaUrlBanner;
        contenedorBanner.style.display = "block";
        
        const appDiv = document.getElementById("app");
        const topBar = document.querySelector(".top-bar");
        if (appDiv && topBar && contenedorBanner.parentNode !== appDiv) {
          appDiv.insertBefore(contenedorBanner, topBar);
        }
      }
      
      document.getElementById("modalBanner").style.display = "none";
      alert("Banner actualizado correctamente.");
    } else {
      alert("Error al subir imagen.");
    }
  } catch (err) {
    console.error(err);
    alert("Error de conexión al guardar el banner.");
  } finally {
    btn.disabled = false;
    btn.innerText = "Subir y Aplicar";
  }
}

// --- FUNCIONES EXCLUSIVAS PARA DESCUENTOS ESPECÍFICOS ---
function toggleSeleccionProductosUI() {
  const tipo = document.getElementById("selectTipoDescuento").value;
  document.getElementById("contenedorListaProductos").style.display = tipo === "especifico" ? "block" : "none";
}

function renderizarListaDescuentosUI() {
  const contenedor = document.getElementById("listaProductosCheck");
  if (!contenedor) return;
  
  if (todasLasFundas.length === 0) {
    contenedor.innerHTML = "<p style='font-size:13px; color:#6e6e73;'>No hay productos cargados en la tienda aún.</p>";
    return;
  }

  contenedor.innerHTML = todasLasFundas.map(f => {
      const isChecked = productosDescuento.includes(f.id) ? "checked" : "";
      return `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid #e5e5ea; padding-bottom: 8px;">
          <input type="checkbox" id="chk-desc-${f.id}" value="${f.id}" ${isChecked} style="width: 20px; height: 20px; margin: 0; accent-color: #0071e3; cursor: pointer;">
          <label for="chk-desc-${f.id}" style="margin: 0; font-size: 14px; font-weight: 500; cursor: pointer; color: #1d1d1f;">${f.nombre}</label>
      </div>`;
  }).join("");
}

async function guardarDescuentoGlobal() {
  const selectTipo = document.getElementById("selectTipoDescuento").value;
  const valor = parseInt(document.getElementById("inputPorcentajeDescuento").value) || 0;

  if (valor < 0 || valor > 100) return alert("Ingresá un porcentaje válido entre 0 y 100.");

  const btn = document.getElementById("btnGuardarDescuentos");
  btn.disabled = true;
  btn.innerText = "⏳ Guardando...";

  let seleccionados = [];
  
  if (selectTipo === "especifico") {
     const checkboxes = document.querySelectorAll('#listaProductosCheck input[type="checkbox"]:checked');
     seleccionados = Array.from(checkboxes).map(cb => cb.value);
     
     if (seleccionados.length === 0 && valor > 0) {
         alert("Seleccioná al menos un producto para aplicar el descuento específico.");
         btn.disabled = false;
         btn.innerText = "Aplicar Cambios";
         return;
     }
  }

  try {
    await setDoc(doc(db, "configuracion", "tienda"), { 
      descuento: valor,
      tipo: selectTipo,
      productosIds: seleccionados
    }, { merge: true });
    
    // Actualizar variables globales al instante
    descuentoGlobal = valor;
    tipoDescuento = selectTipo;
    productosDescuento = seleccionados;

    document.getElementById("modalDescuentos").style.display = "none";
    alert(`¡Configuración de descuentos actualizada con éxito!`);
    
    renderizarFundas(todasLasFundas); // Re-renderiza para actualizar todos los precios
  } catch (err) {
    console.error(err);
    alert("Error al guardar el descuento.");
  } finally {
    btn.disabled = false;
    btn.innerText = "Aplicar Cambios";
  }
}

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
      const btnBanner = document.getElementById("btnAbrirBanner");
      const btnDesc = document.getElementById("btnAbrirDescuentos");

      if (esAdmin) {
        if(btnCambiarRol) btnCambiarRol.innerHTML = "📱 Cambiar a Cliente";
        if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").style.display = "inline-block";
        if(btnImportarExcel) btnImportarExcel.style.display = "inline-block"; 
        if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").style.display = "flex";
        if(btnGestorCategorias) btnGestorCategorias.style.display = "block";
        if(btnVerClientes) btnVerClientes.style.display = "block";
        if(btnBanner) btnBanner.style.display = "block";
        if(btnDesc) btnDesc.style.display = "block";
      } else {
        if(btnCambiarRol) btnCambiarRol.innerHTML = "🔐 Cambiar a Admin";
        if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").style.display = "none";
        if(btnImportarExcel) btnImportarExcel.style.display = "none"; 
        if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").style.display = "none";
        if(btnGestorCategorias) btnGestorCategorias.style.display = "none";
        if(btnVerClientes) btnVerClientes.style.display = "none";
        if(btnBanner) btnBanner.style.display = "none";
        if(btnDesc) btnDesc.style.display = "none";
        
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
  const datosClienteStr = localStorage.getItem("clienteINeoDatos");
  if (!datosClienteStr) {
    document.getElementById("app").style.display = "none";
    signOut(auth);
    document.getElementById("login").style.display = "flex";
  } else {
    const datos = JSON.parse(datosClienteStr);
    rolUsuario = datos.rol || "cliente"; // Recupera el rol guardado
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

  // SOLUCIÓN: Guardamos el LocalStorage PRIMERO.
  // También aprovechamos para incluir el rol (cliente o mayorista)
  localStorage.setItem("clienteINeoDatos", JSON.stringify({ nombre: nombre, telefono: telefono, rol: rolUsuario }));

  try {
    // 1. Iniciamos sesión anónima (ahora no nos cerrará la sesión porque el LocalStorage ya existe)
    await signInAnonymously(auth);

    // 2. Guardamos los datos en Firestore
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

    document.getElementById("modalRegistroCliente").style.display = "none";
    
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

  // --- REVISIÓN SI APLICA DESCUENTO ANTES DE AGREGAR ---
  let aplicaDescuento = false;
  if (descuentoGlobal > 0) {
      if (tipoDescuento === "global") {
          aplicaDescuento = true;
      } else if (tipoDescuento === "especifico" && productosDescuento.includes(fundaReservando.id)) {
          aplicaDescuento = true;
      }
  }

  // Evaluamos qué precio usar dependiendo el rol
  let precioOriginal = fundaReservando.venta || 0;
  if (rolUsuario === "mayorista" && fundaReservando.mayorista > 0) {
      precioOriginal = fundaReservando.mayorista;
  }

  const precioFinal = aplicaDescuento ? Math.round(precioOriginal * (1 - (descuentoGlobal / 100))) : precioOriginal;

  const item = {
      id: fundaReservando.id,
      nombre: fundaReservando.nombre,
      modelo: fundaReservando.sinModelo ? "Único" : modeloSeleccionado,
      precio: precioFinal,
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
  contador.innerText = carritoDeCompras.length; 
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

  let html = `<div class="categoria-pill ${categoriaSeleccionadaFiltro === 'Todas' ? 'active' : ''}" data-cat="Todas">Todas</div>`;
  listaCategorias.forEach(cat => {
    html += `<div class="categoria-pill ${categoriaSeleccionadaFiltro === cat.nombre ? 'active' : ''}" data-cat="${cat.nombre}">${cat.nombre}</div>`;
  });
  contenedor.innerHTML = html;

  const pills = contenedor.querySelectorAll(".categoria-pill");
  pills.forEach(pill => {
    pill.onclick = function() {
      categoriaSeleccionadaFiltro = this.getAttribute("data-cat");
      pills.forEach(p => p.classList.remove("active"));
      this.classList.add("active");
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
function cerrarModalCategorias() { document.getElementById("modalCategorias").style.display = "none"; }

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

// 📥 PROCESADOR LECTOR DE EXCEL
function procesarImportacionExcel(evento) {
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

      if (confirm(`Se detectaron ${filas.length} artículos en el archivo. ¿Proceder a importarlos masivamente?`)) {
        let importados = 0;
        for (const fila of filas) {
          let stockPorModeloArray = [];
          if (fila.StockPorModelo) {
            stockPorModeloArray = String(fila.StockPorModelo).split(",")
              .map(item => {
                const [modelo, cantidad] = item.split(":");
                return { modelo: modelo ? modelo.trim() : "Único", stock: cantidad ? Number(cantidad.trim()) : 0 };
              }).filter(item => item.modelo !== "");
          }

          const nuevoProducto = {
            nombre: fila.Nombre || "Artículo Sin Nombre",
            categoria: fila.Categoria || "Varios",
            costo: Number(fila.Costo || 0),
            venta: Number(fila.Venta || 0),
            mayorista: Number(fila.Mayorista || 0),
            stockPorModelo: stockPorModeloArray,
            foto: "",
            orden: todasLasFundas.length + importados 
          };
          await addDoc(collection(db, "fundas"), nuevoProducto);
          importados++;
        }
        alert(`¡Listo! Se añadieron ${importados} productos correctamente. 🎉`);
        document.getElementById("inputExcel").value = ""; 
        cargarFundas(); 
      }
    } catch (error) {
      console.error("Error al importar:", error);
      alert("Hubo problemas al procesar las celdas del Excel. Valida los nombres de columnas.");
    }
  };
  lector.readAsArrayBuffer(archivo);
}

// 🚀 IA Y REMOVE BG CON CANVAS INTERACTIVO (MODAL FOTO PRO)
function abrirEditorFotoPro() {
  if (!imagenOriginalTemporal) {
    alert("Por favor, selecciona una foto de tu galería antes de abrir el Editor Pro.");
    return;
  }
  document.getElementById("modalFotoPro").style.display = "flex";
  
  // Reseteamos valores visuales del modal a su estado base
  document.getElementById("sliderSombra").value = 35;
  document.getElementById("valorSombra").innerText = "35%";
  document.getElementById("sliderRotacion").value = 0;
  document.getElementById("valorRotacion").innerText = "0°";
  document.getElementById("selectFondoPro").value = tipoFondoElegido;

  if(document.getElementById("sliderBrillo")) {
    document.getElementById("sliderBrillo").value = 100;
    document.getElementById("valorBrillo").innerText = "100%";
  }

  porcentajeEscala = 0.72;
  rotacionGrados = 0;
  nivelBrillo = 100;
  canvasPosX = 500;
  canvasPosY = 500;
  opacidadSombra = 0.35;

  dibujarCanvasGestos();
}

function cerrarEditorFotoPro() {
  document.getElementById("modalFotoPro").style.display = "none";
}

async function ejecutarBorradoFondoIA() {
  const fileInput = document.getElementById("fotoInput");
  const file = fileInput.files[0];
  if (!file && !fotoTransparenteBase64) return alert("No se encontró la imagen original para procesar.");

  const btn = document.getElementById("btnBorrarFondo");
  const textoOriginal = btn.innerText;
  btn.innerText = "⏳ Borrando...";
  btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("image_file", file);
    formData.append("size", "auto");

    const respuestaAPI = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_API_KEY },
      body: formData
    });

    if (!respuestaAPI.ok) throw new Error("Error en la API de Remove.bg.");

    const blobImagenRecortada = await respuestaAPI.blob();
    const reader = new FileReader();
    
    reader.onloadend = function() {
      fotoTransparenteBase64 = reader.result; 
      imagenRecortadaTemporal = new Image();
      imagenRecortadaTemporal.crossOrigin = "anonymous";
      imagenRecortadaTemporal.onload = () => {
        dibujarCanvasGestos();
        btn.innerText = textoOriginal;
        btn.disabled = false;
      };
      imagenRecortadaTemporal.src = fotoTransparenteBase64;
    };
    reader.readAsDataURL(blobImagenRecortada);

  } catch (err) {
    console.error(err);
    alert("Hubo un problemita al conectar con Remove.bg. Verifica tu API Key o conexión.");
    btn.innerText = textoOriginal;
    btn.disabled = false;
  }
}

function reEditarMontaje() {
  porcentajeEscala = 0.72;
  rotacionGrados = 0;
  nivelBrillo = 100; // Reset variable de brillo
  canvasPosX = 500;
  canvasPosY = 500;
  
  if (document.getElementById("sliderRotacion")) {
    document.getElementById("sliderRotacion").value = 0;
    document.getElementById("valorRotacion").innerText = "0°";
  }
  
  if (document.getElementById("sliderBrillo")) {
    document.getElementById("sliderBrillo").value = 100;
    document.getElementById("valorBrillo").innerText = "100%";
  }

  dibujarCanvasGestos();
}

function configurarGestosCanvas() {
  const canvas = document.getElementById("canvasGestos");
  if (!canvas) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let prevTouchDist = null;

  canvas.onpointerdown = (e) => { 
    isDragging = true; 
    startX = e.clientX; 
    startY = e.clientY; 
    canvas.style.cursor = "grabbing"; 
    canvas.setPointerCapture(e.pointerId);
  };
  
  canvas.onpointerup = (e) => { 
    isDragging = false; 
    canvas.style.cursor = "grab"; 
    canvas.releasePointerCapture(e.pointerId);
    prevTouchDist = null;
  };

  canvas.onpointermove = (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    canvasPosX += (e.clientX - startX) * scaleX;
    canvasPosY += (e.clientY - startY) * scaleY;
    
    startX = e.clientX;
    startY = e.clientY;
    dibujarCanvasGestos();
  };

  canvas.onwheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      porcentajeEscala = Math.min(porcentajeEscala + 0.05, 3.5); 
    } else {
      porcentajeEscala = Math.max(porcentajeEscala - 0.05, 0.1); 
    }
    dibujarCanvasGestos();
  };

  canvas.ontouchstart = (e) => {
    if (e.touches.length === 2) {
      prevTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  canvas.ontouchmove = (e) => {
    if (e.touches.length === 2 && prevTouchDist) {
      e.preventDefault(); 
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      porcentajeEscala *= (currentDist / prevTouchDist);
      porcentajeEscala = Math.max(0.1, Math.min(porcentajeEscala, 3.5));
      prevTouchDist = currentDist;
      dibujarCanvasGestos();
    }
  };
}

function dibujarCanvasGestos() {
  const canvas = document.getElementById("canvasGestos");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Usamos la imagen recortada si existe, de lo contrario la original base
  let imagenADibujar = imagenRecortadaTemporal || imagenOriginalTemporal;
  if (!imagenADibujar) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Lógica del selector de fondos
  if (tipoFondoElegido === "estudio") {
    if (imgFondoEstudio.complete && imgFondoEstudio.naturalWidth > 0) {
      ctx.drawImage(imgFondoEstudio, 0, 0, canvas.width, canvas.height);
    } else {
      const grad = ctx.createRadialGradient(500, 500, 100, 500, 500, 800);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#e5e5ea");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else if (tipoFondoElegido === "blanco") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (tipoFondoElegido === "original") {
    // Si elige original, idealmente renderizamos la foto sin transparencia al fondo
    // o simplemente la dejamos sin fondo artificial para que quede como venía de fábrica.
  }

  ctx.save();
  ctx.translate(canvasPosX, canvasPosY); 
  ctx.rotate(rotacionGrados * Math.PI / 180); 
  
  // La sombra solo se aplica si no elegimos el fondo "original"
  if (opacidadSombra > 0 && tipoFondoElegido !== "original") {
    ctx.shadowColor = `rgba(0, 0, 0, ${opacidadSombra})`;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 30; 
    ctx.shadowOffsetY = 40; 
  }

  const limitePixel = 1000 * porcentajeEscala;
  const escala = Math.min(limitePixel / imagenADibujar.width, limitePixel / imagenADibujar.height);
  const anchoFinal = imagenADibujar.width * escala;
  const altoFinal = imagenADibujar.height * escala;

  ctx.filter = `brightness(${nivelBrillo}%)`;
  ctx.drawImage(imagenADibujar, -anchoFinal / 2, -altoFinal / 2, anchoFinal, altoFinal);
  
  // El restore resetea todos los filtros, escalas y rotaciones para el próximo dibujo
  ctx.restore();
}

async function aplicarMontajeFinal() {
  const canvas = document.getElementById("canvasGestos");
  if (!canvas) return;

  fotoBase64 = canvas.toDataURL("image/png"); 
  
  const preview = document.getElementById("previewFoto");
  preview.src = fotoBase64;
  preview.style.display = "block";

  cerrarEditorFotoPro();
}

// --- HERRAMIENTAS DE FORMATEO Y STOCK ---
function toggleMenuMenuIA() {
  const menu = document.getElementById("menuAccionesIA");
  if(menu) menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none";
}

function toggleFormateador() {
  const caja = document.getElementById("cajaFormateador");
  if(caja) caja.style.display = (caja.style.display === "none" || caja.style.display === "") ? "block" : "none";
}

function procesarTextoStock() {
  const textoCrudo = document.getElementById("textoCrudoStock").value;
  if (!textoCrudo.trim()) return alert("Pegá una lista primero.");

  const lineas = textoCrudo.split('\n');
  const resultado = [];

  lineas.forEach(linea => {
    let str = linea.trim();
    if (!str) return;

    let cantidad = 1; 
    const matchCant = str.match(/x\s*(\d+)$/i);
    if (matchCant) {
      cantidad = matchCant[1];
      str = str.replace(/x\s*\d+$/i, '').trim(); 
    }

    str = str.replace(/^(Iph|iphone|i)\s*/i, '');
    str = str.replace(/\bpm\b/ig, 'Pro Max');
    str = str.replace(/\bp\b/ig, 'Pro');
    str = str.replace(/\bplus\b/ig, 'Plus');

    if (str.length > 0) str = str.charAt(0).toUpperCase() + str.slice(1);
    resultado.push(`${str}:${cantidad}`);
  });

  document.getElementById("stockPorModelo").value = resultado.join(', ');
  document.getElementById("textoCrudoStock").value = "";
  document.getElementById("cajaFormateador").style.display = "none";
}

function toggleModoModelo() {
  esProductoSinModelo = !esProductoSinModelo;
  const labelStock = document.getElementById('labelStock');
  const stockPorModelo = document.getElementById('stockPorModelo');
  const stockTotalSencillo = document.getElementById('stockTotalSencillo');
  const cajaFormateador = document.getElementById('cajaFormateador');
  const btnToggleModelo = document.getElementById('btnToggleModelo');

  if (esProductoSinModelo) {
    labelStock.textContent = "Cantidad Total de Piezas en Stock";
    stockPorModelo.style.display = 'none';
    stockTotalSencillo.style.display = 'block';
    if (cajaFormateador) cajaFormateador.style.display = 'none';
    btnToggleModelo.textContent = "✨ Usar Variantes";
    btnToggleModelo.style.background = "#0071e3";
    stockPorModelo.value = "";
  } else {
    labelStock.textContent = "Modelos / Variantes y Stock (Formato: variante:cantidad)";
    stockPorModelo.style.display = 'block';
    stockTotalSencillo.style.display = 'none';
    btnToggleModelo.textContent = "🚫 No Modelo";
    btnToggleModelo.style.background = "#6e6e73";
    stockTotalSencillo.value = "";
  }
}

// --- GESTIÓN DE FORMULARIO DE PRODUCTO ---
function procesarImagen(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  const btnGuardar = document.getElementById("guardarFunda");
  btnGuardar.disabled = true;

  const lector = new FileReader();
  lector.onload = function (e) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      
      // Guardamos la imagen original en memoria para el editor Pro
      imagenOriginalTemporal = img;
      imagenRecortadaTemporal = null; // Reseteamos recorte anterior si sube una nueva
      fotoTransparenteBase64 = "";

      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");

      const ladoMenor = Math.min(img.width, img.height);
      const sx = (img.width - ladoMenor) / 2;
      const sy = (img.height - ladoMenor) / 2;

      ctx.drawImage(img, sx, sy, ladoMenor, ladoMenor, 0, 0, 500, 500);
      fotoBase64 = canvas.toDataURL("image/jpeg", 0.6);

      const preview = document.getElementById("previewFoto");
      preview.src = fotoBase64;
      preview.style.display = "block";

      btnGuardar.disabled = false;
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarFormulario() {
  if (!esAdmin) return;
  if (listaCategorias.length === 0) {
    alert("⚠️ Primero debés crear al menos una categoría desde el menú lateral.");
    return;
  }
  
  idFundaEditando = null;
  fotoBase64 = ""; 
  fotoTransparenteBase64 = "";
  urlTransparenteGuardada = "";
  imagenOriginalTemporal = null;
  imagenRecortadaTemporal = null;
  
  document.getElementById("modalTitulo").innerText = "➕ Nuevo Artículo";
  document.getElementById("guardarFunda").innerText = "Guardar";
  document.getElementById("guardarFunda").disabled = false;
  
  document.getElementById("nombre").value = "";
  if(document.getElementById("categoriaSelect").options.length > 0) document.getElementById("categoriaSelect").selectedIndex = 0;
  
  esProductoSinModelo = false;
  document.getElementById('labelStock').textContent = "Modelos / Variantes y Stock (Formato: variante:cantidad)";
  document.getElementById('stockPorModelo').style.display = 'block';
  document.getElementById('stockTotalSencillo').style.display = 'none';
  document.getElementById('stockPorModelo').value = "";
  document.getElementById('stockTotalSencillo').value = "";
  
  const btnToggleModelo = document.getElementById('btnToggleModelo');
  btnToggleModelo.textContent = "🚫 No Modelo";
  btnToggleModelo.style.background = "#6e6e73";
  
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  if(document.getElementById("mayorista")) document.getElementById("mayorista").value = "";
  document.getElementById("fotoInput").value = "";
  
  document.getElementById("previewFoto").style.display = "none";
  
  if(document.getElementById("menuAccionesIA")) document.getElementById("menuAccionesIA").style.display = "none";
  if(document.getElementById("cajaFormateador")) document.getElementById("cajaFormateador").style.display = "none";
  if(document.getElementById("textoCrudoStock")) document.getElementById("textoCrudoStock").value = "";
  if(document.getElementById("btnReeditarMontaje")) document.getElementById("btnReeditarMontaje").style.display = "none";

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

function mostrarAsistente() {
  if (!esAdmin) return;
  document.getElementById("asistenteProducto").value = "";
  document.getElementById("asistenteModelo").value = "";
  document.getElementById("asistenteUnidades").value = "1";
  document.getElementById("modalAsistente").style.display = "flex";
}
function ocultarAsistente() { document.getElementById("modalAsistente").style.display = "none"; }

function actualizarDatalistBuscador() {
  const datalist = document.getElementById("sugerenciasBuscador");
  if (!datalist) return;
  
  const sugerencias = new Set();
  todasLasFundas.forEach(f => {
    if (f.nombre) sugerencias.add(f.nombre); 
    if (Array.isArray(f.stockPorModelo)) {
      f.stockPorModelo.forEach(m => {
        if (m.modelo) sugerencias.add(m.modelo.trim()); 
      });
    }
  });
  
  datalist.innerHTML = Array.from(sugerencias).sort().map(texto => `<option value="${texto}"></option>`).join("");
}

// --- CRUD DE FUNDAS ---
async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; 
    let necesitaMigracion = false;

    snapshot.forEach((doc) => {
      const datos = doc.data();
      if (datos.orden === undefined) necesitaMigracion = true;
      todasLasFundas.push({ id: doc.id, ...datos });
    });

    if (necesitaMigracion) {
      console.log("⚙️ Corrigiendo base de datos sin índices de orden...");
      const batch = writeBatch(db);
      todasLasFundas.forEach((funda, index) => {
        if (funda.orden === undefined) {
          const docRef = doc(db, "fundas", funda.id);
          batch.update(docRef, { orden: index });
          funda.orden = index; 
        }
      });
      await batch.commit();
    }

    todasLasFundas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    
    actualizarDatalistAsistente();
    actualizarDatalistBuscador(); 
    filtrarFundas();
  } catch (error) { console.error("Error al cargar o migrar fundas:", error); }
}

function actualizarDatalistAsistente() {
  const datalist = document.getElementById("listaProductos");
  if (!datalist) return;
  const nombresUnicos = [...new Set(todasLasFundas.map(f => f.nombre).filter(Boolean))];
  datalist.innerHTML = nombresUnicos.map(nombre => `<option value="${nombre}"></option>`).join("");
}

async function guardarFunda() {
  if (!esAdmin) return;
  const btnGuardar = document.getElementById("guardarFunda");
  const textoOriginal = btnGuardar.innerText;
  
  btnGuardar.disabled = true;
  btnGuardar.innerText = "⏳ Subiendo imágenes..."; 

  let urlImagenFinal = fotoBase64; 
  let urlTransparenteFinal = urlTransparenteGuardada; 

  const subirAImgBB = async (base64) => {
    const base64Clean = base64.split(',')[1];
    const formData = new FormData();
    formData.append("image", base64Clean);
    const respuesta = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData
    });
    const resultado = await respuesta.json();
    if (!resultado.success) throw new Error("Error en ImgBB");
    return resultado.data.url;
  };

  try {
    if (fotoTransparenteBase64 && fotoTransparenteBase64.startsWith("data:image")) {
      urlTransparenteFinal = await subirAImgBB(fotoTransparenteBase64);
    }
    if (fotoBase64 && fotoBase64.startsWith("data:image")) {
      urlImagenFinal = await subirAImgBB(fotoBase64);
    }
    btnGuardar.innerText = "💾 Guardando datos..."; 
  } catch (err) {
    console.error(err);
    alert("Error al subir la foto a ImgBB. Intenta de nuevo.");
    btnGuardar.disabled = false;
    btnGuardar.innerText = textoOriginal;
    return;
  }

  let stockPorModeloArray = [];
  if (esProductoSinModelo) {
    const unidadesTotales = Number(document.getElementById("stockTotalSencillo").value) || 0;
    stockPorModeloArray = [{ modelo: "Único", stock: unidadesTotales }];
  } else {
    const compatiblesInput = document.getElementById("stockPorModelo").value;
    stockPorModeloArray = compatiblesInput.split(",")
      .map(item => {
        const [modelo, cantidad] = item.split(":");
        return { modelo: modelo ? modelo.trim() : "", stock: cantidad ? Number(cantidad.trim()) : 0 };
      }).filter(item => item.modelo !== "");
  }

  const datosFunda = {
    nombre: document.getElementById("nombre").value,
    categoria: document.getElementById("categoriaSelect").value, 
    stockPorModelo: stockPorModeloArray,
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    mayorista: Number(document.getElementById("mayorista").value), 
    foto: urlImagenFinal, 
    fotoTransparente: urlTransparenteFinal, 
    sinModelo: esProductoSinModelo 
  };

  if (!idFundaEditando) datosFunda.orden = todasLasFundas.length;

  try {
    if (idFundaEditando) {
      if (urlImagenFinal === "" && !fotoBase64) {
         const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
         datosFunda.foto = vieja ? (vieja.foto || "") : "";
      }
      if (urlTransparenteFinal === "" && !fotoTransparenteBase64) {
         const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
         datosFunda.fotoTransparente = vieja ? (vieja.fotoTransparente || "") : "";
      }
      await updateDoc(doc(db, "fundas", idFundaEditando), datosFunda);
      alert("Artículo actualizado 🎉");
    } else {
      await addDoc(collection(db, "fundas"), datosFunda);
      alert("Artículo guardado 🎉");
    }
    ocultarFormulario();
    cargarFundas();
  } catch (error) {
    console.error(error);
    alert("Error al guardar en base de datos.");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerText = textoOriginal;
  }
}

async function eliminarFunda(id) {
  if (!esAdmin) return;
  if (confirm("¿Seguro que deseas eliminar este artículo?")) {
    try {
      await deleteDoc(doc(db, "fundas", id));
      cargarFundas();
    } catch (error) { console.error(error); }
  }
}

function abrirEditarFunda(id) {
  if (!esAdmin) return;
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  idFundaEditando = id;
  fotoBase64 = "";
  fotoTransparenteBase64 = "";
  urlTransparenteGuardada = funda.fotoTransparente || "";
  imagenOriginalTemporal = null;
  imagenRecortadaTemporal = null;

  document.getElementById("modalTitulo").innerText = "✏️ Editar Artículo";
  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("categoriaSelect").value = funda.categoria || (listaCategorias[0] ? listaCategorias[0].nombre : "");
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;
  if(document.getElementById("mayorista")) document.getElementById("mayorista").value = funda.mayorista ?? 0;

  esProductoSinModelo = !!funda.sinModelo;
  const labelStock = document.getElementById('labelStock');
  const stockPorModelo = document.getElementById('stockPorModelo');
  const stockTotalSencillo = document.getElementById('stockTotalSencillo');
  const btnToggleModelo = document.getElementById('btnToggleModelo');

  if (esProductoSinModelo) {
    labelStock.textContent = "Cantidad Total de Piezas en Stock";
    stockPorModelo.style.display = 'none';
    stockTotalSencillo.style.display = 'block';
    btnToggleModelo.textContent = "✨ Usar Variantes";
    btnToggleModelo.style.background = "#0071e3";
    
    const primerItem = Array.isArray(funda.stockPorModelo) && funda.stockPorModelo[0] ? funda.stockPorModelo[0].stock : 0;
    stockTotalSencillo.value = primerItem;
    stockPorModelo.value = "";
  } else {
    labelStock.textContent = "Modelos / Variantes y Stock (Formato: variante:cantidad)";
    stockPorModelo.style.display = 'block';
    stockTotalSencillo.style.display = 'none';
    btnToggleModelo.textContent = "🚫 No Modelo";
    btnToggleModelo.style.background = "#6e6e73";
    stockTotalSencillo.value = "";

    if (Array.isArray(funda.stockPorModelo)) {
      document.getElementById("stockPorModelo").value = funda.stockPorModelo.map(m => `${m.modelo}:${m.stock}`).join(", ");
    }
  }

  const preview = document.getElementById("previewFoto");
  if (funda.foto) {
    preview.src = funda.foto;
    preview.style.display = "block";
    
    const imgOld = new Image();
    imgOld.crossOrigin = "anonymous";
    imgOld.onload = () => { imagenOriginalTemporal = imgOld; };
    imgOld.src = funda.foto;
    
  } else {
    preview.style.display = "none";
  }

  let btnReeditar = document.getElementById("btnReeditarMontaje");
  if (!btnReeditar) {
    btnReeditar = document.createElement("button");
    btnReeditar.id = "btnReeditarMontaje";
    btnReeditar.style.cssText = "width: 100%; background: #5856d6; margin-bottom: 15px; color: white; padding: 12px; border-radius: 12px; border:none; font-weight:bold; cursor:pointer;";
    btnReeditar.innerText = "🖼️ Re-editar Montaje Guardado (No gasta API)";
    preview.parentNode.insertBefore(btnReeditar, preview);
  }

  if (funda.fotoTransparente) {
    btnReeditar.style.display = "block";
    btnReeditar.onclick = (e) => {
      e.preventDefault();
      const imgRecorteViejo = new Image();
      imgRecorteViejo.crossOrigin = "anonymous";
      imgRecorteViejo.onload = () => {
        imagenRecortadaTemporal = imgRecorteViejo;
        abrirEditorFotoPro();
      };
      imgRecorteViejo.src = funda.fotoTransparente;
    };
  } else {
    btnReeditar.style.display = "none";
  }

  if(document.getElementById("menuAccionesIA")) document.getElementById("menuAccionesIA").style.display = "none";
  if(document.getElementById("cajaFormateador")) document.getElementById("cajaFormateador").style.display = "none";
  if(document.getElementById("textoCrudoStock")) document.getElementById("textoCrudoStock").value = "";

  document.getElementById("guardarFunda").innerText = "Actualizar";
  document.getElementById("agregar").style.display = "flex";
}

async function procesarVentaAsistente() {
  if (!esAdmin) return;
  const prodBuscado = document.getElementById("asistenteProducto").value.trim().toLowerCase();
  const modeloBuscado = document.getElementById("asistenteModelo").value.trim().toLowerCase();
  const unidadesAVender = Number(document.getElementById("asistenteUnidades").value);

  const fundaEncontrada = todasLasFundas.find(f => f.nombre && f.nombre.toLowerCase() === prodBuscado);
  if (!fundaEncontrada) return alert("Producto no encontrado.");

  if (fundaEncontrada.sinModelo) {
    if (!fundaEncontrada.stockPorModelo || fundaEncontrada.stockPorModelo.length === 0) {
      fundaEncontrada.stockPorModelo = [{ modelo: "Único", stock: 0 }];
    }
    const modeloStock = fundaEncontrada.stockPorModelo[0];
    if (modeloStock.stock < unidadesAVender) return alert("Stock insuficiente.");

    modeloStock.stock -= unidadesAVender;
    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), { stockPorModelo: fundaEncontrada.stockPorModelo });
      alert(`¡Venta registrada!`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) { console.error(error); }
    return;
  }

  if (Array.isArray(fundaEncontrada.stockPorModelo)) {
    const modeloStock = fundaEncontrada.stockPorModelo.find(m => m.modelo.toLowerCase().trim() === modeloBuscado);
    if (!modeloStock) return alert("Variante/Modelo no encontrado.");
    if (modeloStock.stock < unidadesAVender) return alert("Stock insuficiente.");

    modeloStock.stock -= unidadesAVender;
    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), { stockPorModelo: fundaEncontrada.stockPorModelo });
      alert(`¡Venta registrada!`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) { console.error(error); }
  }
}

// --- UTILIDADES ---
window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente;
window.eliminarItemCarrito = eliminarItemCarrito; 

function abrirModalReservar(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  fundaReservando = funda;
  document.getElementById("reservaNombreFunda").innerText = funda.nombre || "Sin Nombre";
  
  // --- REVISIÓN SI APLICA DESCUENTO EN VISTA PREVIA ---
  let aplicaDescuento = false;
  if (descuentoGlobal > 0) {
      if (tipoDescuento === "global") {
          aplicaDescuento = true;
      } else if (tipoDescuento === "especifico" && productosDescuento.includes(funda.id)) {
          aplicaDescuento = true;
      }
  }

  // Evaluamos qué precio usar dependiendo el rol
  let precioOriginal = funda.venta || 0;
  if (rolUsuario === "mayorista" && funda.mayorista > 0) {
      precioOriginal = funda.mayorista;
  }

  const precioFinal = aplicaDescuento ? Math.round(precioOriginal * (1 - (descuentoGlobal / 100))) : precioOriginal;
  document.getElementById("reservaPrecio").innerText = `$${precioFinal}`;

  const selectModelo = document.getElementById("reservaModelo");
  selectModelo.innerHTML = "";

  if (funda.sinModelo) {
    const totalStock = Array.isArray(funda.stockPorModelo) && funda.stockPorModelo[0] ? funda.stockPorModelo[0].stock : 0;
    if (totalStock <= 0) {
      selectModelo.innerHTML = `<option value="">⚠️ Sin stock disponible</option>`;
      document.getElementById("btnConfirmarWhatsApp").disabled = true;
    } else {
      document.getElementById("btnConfirmarWhatsApp").disabled = false;
      selectModelo.innerHTML = `<option value="Único">Estándar / Único</option>`;
    }
  } else if (Array.isArray(funda.stockPorModelo)) {
    const modelsDisponibles = funda.stockPorModelo.filter(m => m.stock > 0);
    if (modelsDisponibles.length === 0) {
      selectModelo.innerHTML = `<option value="">⚠️ Sin stock disponible</option>`;
      document.getElementById("btnConfirmarWhatsApp").disabled = true;
    } else {
      document.getElementById("btnConfirmarWhatsApp").disabled = false;
      modelsDisponibles.forEach(m => {
        const option = document.createElement("option");
        option.value = m.modelo;
        option.innerText = `${m.modelo} (${m.stock} u.)`;
        selectModelo.appendChild(option);
      });
    }
  } else {
    selectModelo.innerHTML = `<option value="Estándar">Variante Única</option>`;
    document.getElementById("btnConfirmarWhatsApp").disabled = false;
  }
  document.getElementById("modalReservar").style.display = "flex";
}
window.abrirModalReservar = abrirModalReservar;

function cerrarModalReservar() {
  fundaReservando = null;
  document.getElementById("modalReservar").style.display = "none";
}
window.cerrarModalReservar = cerrarModalReservar;

// MÓDULO: Monitorea de manera fluida y adaptativa la carga de las fotos
function controlarCargaDeImagenes() {
  const imagenes = document.querySelectorAll("#fundas .card-img");
  const totalImagenes = imagenes.length;
  const loader = document.getElementById("cargando");
  const barraProgreso = document.getElementById("loaderProgreso");

  if (totalImagenes === 0) {
    if (barraProgreso) barraProgreso.style.width = "100%";
    setTimeout(() => {
      if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => { loader.style.display = "none"; }, 400);
      }
    }, 300);
    return;
  }

  let imagenesCargadas = 0;

  function verificarFin() {
    imagenesCargadas++;
    
    const porcentajeBase = 92;
    const porcentajeRestante = 8;
    const porcentaje = porcentajeBase + ((imagenesCargadas / totalImagenes) * porcentajeRestante);
    
    if (barraProgreso) {
      barraProgreso.style.width = `${porcentaje}%`;
    }

    if (imagenesCargadas === totalImagenes) {
      setTimeout(() => {
        if (loader) {
          loader.style.opacity = "0";
          loader.style.transition = "opacity 0.4s ease";
          setTimeout(() => {
            loader.style.display = "none";
          }, 400);
        }
      }, 300);
    }
  }

  imagenes.forEach((img) => {
    if (img.complete) {
      verificarFin();
    } else {
      img.addEventListener("load", verificarFin);
      img.addEventListener("error", verificarFin);
    }
  });
}

window.toggleStock = (btn, action) => {
  const card = btn.closest('.card');
  const stockDiv = card.querySelector('.stock-list');
  const btnVer = card.querySelector('.btn-ver-stock');
  const btnOcultar = card.querySelector('.btn-ocultar-stock');

  if (action === 'show') {
    stockDiv.style.setProperty('display', 'block', 'important');
    btnVer.style.setProperty('display', 'none', 'important');
    btnOcultar.style.setProperty('display', 'block', 'important');
  } else {
    stockDiv.style.setProperty('display', 'none', 'important');
    btnVer.style.setProperty('display', 'block', 'important');
    btnOcultar.style.setProperty('display', 'none', 'important');
  }
};

function coincideModelo(modelo, textoBuscado) {
  const mod = String(modelo).toLowerCase().trim();
  const txt = textoBuscado.toLowerCase().trim();
  
  if (!mod.includes(txt)) return false;

  if (/\d/.test(txt)) {
    const variantes = ["pro", "max", "plus", "mini", "ultra", "fe", "lite", "5g"];
    for (let variante of variantes) {
      if (mod.includes(variante) && !txt.includes(variante)) return false;
    }
  }
  return true;
}

function habilitarReordenamiento() {
    if (!esAdmin) return; 
    const contenedor = document.getElementById('fundas');
    if (!contenedor) return;

    if (sortableInstance) sortableInstance.destroy();
    
    sortableInstance = new Sortable(contenedor, {
        animation: 150,
        handle: '.drag-handle', 
        ghostClass: 'sortable-ghost', 
        onEnd: async (evt) => {
            if (evt.oldIndex === evt.newIndex) return;
            console.log("Sincronizando nuevo orden visual con Firebase...");
            await actualizarOrdenEnFirebase();
        }
    });
}

async function actualizarOrdenEnFirebase() {
    const tarjetas = document.querySelectorAll('#fundas .card');
    const batch = writeBatch(db); 

    tarjetas.forEach((tarjeta, index) => {
        const id = tarjeta.dataset.id;
        if (id) {
          const docRef = doc(db, "fundas", id); 
          batch.update(docRef, { orden: index });
        }
    });

    try {
        await batch.commit();
        tarjetas.forEach((tarjeta, index) => {
            const id = tarjeta.dataset.id;
            const fundaLocal = todasLasFundas.find(f => f.id === id);
            if (fundaLocal) fundaLocal.orden = index;
        });
        todasLasFundas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    } catch (error) {
        console.error("Error guardando el ordenamiento:", error);
        alert("No se pudo persistir el orden en la base de datos.");
    }
}

function renderizarFundas(arrayDeFundas, textoBuscado = "") {
  const contenedor = document.getElementById("fundas");
  let html = "";

  arrayDeFundas.forEach((f) => {
    const modelosTotales = f.stockPorModelo || [];
    const modelosFiltrados = (textoBuscado !== "")
      ? modelosTotales.filter(m => coincideModelo(m.modelo, textoBuscado))
      : modelosTotales;

    const totalStock = modelosTotales.reduce((acc, item) => acc + item.stock, 0);
    const mostrarDirecto = (textoBuscado !== "" && modelosFiltrados.length > 0 && modelosFiltrados.length < modelosTotales.length);

    const listaModelosHTML = modelosFiltrados.map(m => `• ${m.modelo}: <b>${m.stock} u.</b>`).join("<br>");
    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60";
    const estiloOculto = (f.sinModelo && !esAdmin) ? 'style="display: none !important;"' : '';

    let bloqueStockHTML = "";
    if (f.sinModelo) {
      bloqueStockHTML = `<p ${estiloOculto}>Stock Total: ${totalStock} u.</p>`;
    } else {
      const styleVerStock = mostrarDirecto ? 'display: none !important;' : 'display: block !important;';
      const styleOcultarStock = mostrarDirecto ? 'display: block !important;' : 'display: none !important;';
      
      bloqueStockHTML = `
        <p>Stock Total: ${totalStock} u.</p>
        <button onclick="toggleStock(this, 'show')" class="btn-ver-stock" style="${styleVerStock}">Ver stock por modelo</button>
        <button onclick="toggleStock(this, 'hide')" class="btn-ocultar-stock" style="${styleOcultarStock}">Ocultar Stock</button>
        <div class="stock-list" style="${styleOcultarStock} margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5;">${listaModelosHTML}</div>
      `;
    }

    let bloqueMétricasAdmin = "";
    if (esAdmin) {
      const costo = f.costo || 0;
      const venta = f.venta || 0;
      const gananciaPesos = venta - costo;
      const porcentajeMargen = costo > 0 ? Math.round((gananciaPesos / costo) * 100) : 0;
      bloqueMétricasAdmin = `<p style="font-size: 14px; color: #43a047; font-weight: 600; margin: 4px 0 12px 0;">📈 Ganancia: $${gananciaPesos} (${porcentajeMargen}%)</p>`;
    }

    let bloqueAcciones = esAdmin ? `
        <div style="margin-top: 15px; display: flex; gap: 5px;">
          <button onclick="abrirEditarFunda('${f.id}')" style="flex:1;">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30; flex:1;">🗑️ Eliminar</button>
        </div>` : `
        <div style="margin-top: 20px;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #ffffff; color: #000000; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 12px; border-radius: 12px; border:none; cursor:pointer;">+ Añadir</button>
        </div>`;

    // --- CÁLCULO E INYECCIÓN DE PRECIO ACTUALIZADA ---
    let bloquePrecioHTML = "";
    
    // Evaluamos qué precio mostrar dependiendo del rol:
    let precioOriginal = f.venta ?? 0;
    if (rolUsuario === "mayorista" && f.mayorista > 0) {
        precioOriginal = f.mayorista;
    }

    let aplicaDescuento = false;
    if (descuentoGlobal > 0) {
        if (tipoDescuento === "global") {
            aplicaDescuento = true;
        } else if (tipoDescuento === "especifico" && productosDescuento.includes(f.id)) {
            aplicaDescuento = true;
        }
    }
    
    if (aplicaDescuento) {
      const precioDescuento = Math.round(precioOriginal * (1 - (descuentoGlobal / 100)));
      bloquePrecioHTML = `
        <div style="display: flex; align-items: baseline; gap: 8px; margin: 5px 0 15px 0; order: 3;">
          <p style="font-size: 19px !important; font-weight: 800 !important; color: #ff3b30 !important; margin: 0 !important;">$${precioDescuento}</p>
          <p style="font-size: 14px !important; font-weight: 500 !important; color: #86868b !important; text-decoration: line-through !important; margin: 0 !important;">$${precioOriginal}</p>
        </div>
      `;
    } else {
      bloquePrecioHTML = `<p style="font-size: 18px !important; font-weight: 800 !important; color: #000000 !important; margin: 5px 0 15px 0 !important; order: 3;">$${precioOriginal}</p>`;
    }

    html += `
    <div class="card" data-id="${f.id}" style="position: relative;">
      ${esAdmin ? `<div class="drag-handle" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 10; font-size: 14px;">☰</div>` : ''}
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        ${bloqueStockHTML}
        ${bloquePrecioHTML}
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
      compatibleCoincide = f.stockPorModelo.some((m) => coincideModelo(m.modelo, textoBuscado));
    }
    return nombreCoincide || compatibleCoincide;
  });

  renderizarFundas(fundasFiltradas, textoBuscado);
}
