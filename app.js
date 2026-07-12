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

// ☁️ CLOUDINARY - IMPORTANTE: Reemplazá el string de abajo con el nombre real de tu cuenta de Cloudinary.
const CLOUDINARY_CLOUD_NAME = "dwhvbnypz"; 
const CLOUDINARY_UPLOAD_PRESET = "catalogo_ineo";

// ==========================================================================
// CONTROL DE SESIÓN, ROLES Y SEGURIDAD DUAL
// ==========================================================================
let rolUsuario = sessionStorage.getItem("mayoristaValidado") === "true" ? "mayorista" : "cliente";
let todasLasFundas = [];
let listaCategorias = []; 
let categoriaSeleccionadaFiltro = "Todas"; 
let idFundaEditando = null;
let esAdmin = false; 
let fundaReservando = null; 
let sortableInstance = null; 
let esProductoSinModelo = false; 
let carruselTimer = null; 

// 📸 VARIABLES PARA GALERÍA Y FOTO PRO
let galeriaTemporal = []; 
let indiceEdicionPro = null; 
let imagenOriginalTemporal = null; 
let imagenRecortadaTemporal = null; 
let opacidadSombra = 0.35;
let tipoFondoElegido = "estudio";
let porcentajeEscala = 0.72; 
let rotacionGrados = 0;
let nivelBrillo = 100;
let canvasPosX = 500;
let canvasPosY = 500;
let imgFondoEstudio = new Image();
imgFondoEstudio.src = "fondo-estudio.png"; 

// Variables globales para Descuentos Avanzados
let descuentoGlobal = 0;
let tipoDescuento = "global"; 
let productosDescuento = []; 

// Variables de control para Banners Duales y Seguridad
let urlBannerGeneral = "";
let urlBannerMayorista = "";
const PASSWORD_MAYORISTA = "mayorista2024"; 

// 🛒 Variables del Carrito de Compras
let carritoDeCompras = JSON.parse(localStorage.getItem("carritoINeo")) || [];

// --- FUNCIONES DE BANNER VISUAL ---
function actualizarBannerVisual() {
  const imgBanner = document.getElementById("imgBannerTienda");
  const contenedorBanner = document.getElementById("contenedorBannerTienda");
  
  if (imgBanner && contenedorBanner) {
    let bannerMostrar = "";
    
    if (rolUsuario === "mayorista" && urlBannerMayorista) {
      bannerMostrar = urlBannerMayorista;
    } else if (urlBannerGeneral) {
      bannerMostrar = urlBannerGeneral;
    }

    if (bannerMostrar) {
      imgBanner.src = bannerMostrar;
      contenedorBanner.style.display = "block";
      
      const appDiv = document.getElementById("app");
      const topBar = document.querySelector(".top-bar");
      if (appDiv && topBar && contenedorBanner.parentNode !== appDiv) {
        appDiv.insertBefore(contenedorBanner, topBar);
      }
    } else {
      contenedorBanner.style.display = "none";
    }
  }
}

async function cargarBanners() {
  try {
    const docRef = doc(db, "configuracion", "banners");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      urlBannerGeneral = data.urlGeneral || "";
      urlBannerMayorista = data.urlMayorista || "";
    }
    actualizarBannerVisual();
  } catch (error) {
    console.error("Error al sincronizar banners:", error);
  }
}

// --- INICIALIZACIÓN DE EVENTOS Y PROTECCIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const barra = document.getElementById("loaderProgreso");
  if (barra) barra.style.width = "15%";

  cargarConfiguracionTienda(); 
  cargarBanners(); 

  const inputBuscar = document.getElementById("buscar");
  if (inputBuscar && !document.getElementById("sugerenciasBuscador")) {
    const datalist = document.createElement("datalist");
    datalist.id = "sugerenciasBuscador";
    document.body.appendChild(datalist);
    inputBuscar.setAttribute("list", "sugerenciasBuscador");
  }

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
      actualizarBannerVisual();
      validarYEntrar();
    };
  }

  if (document.getElementById("btnMayorista")) {
    document.getElementById("btnMayorista").onclick = (e) => {
      e.preventDefault();
      if (sessionStorage.getItem("mayoristaValidado") === "true") {
        rolUsuario = "mayorista";
        actualizarBannerVisual();
        validarYEntrar();
      } else {
        document.getElementById("modalPasswordMayorista").style.display = "flex";
        document.getElementById("passwordMayorista").focus();
      }
    };
  }

  if (document.getElementById("btnCerrarPasswordMayorista")) {
    document.getElementById("btnCerrarPasswordMayorista").onclick = () => {
      document.getElementById("modalPasswordMayorista").style.display = "none";
      document.getElementById("passwordMayorista").value = "";
    };
  }

  if (document.getElementById("btnValidarMayorista")) {
    document.getElementById("btnValidarMayorista").onclick = () => {
      const inputPass = document.getElementById("passwordMayorista").value;
      
      if (inputPass === PASSWORD_MAYORISTA) {
        sessionStorage.setItem("mayoristaValidado", "true");
        document.getElementById("modalPasswordMayorista").style.display = "none";
        document.getElementById("passwordMayorista").value = "";
        rolUsuario = "mayorista";
        
        actualizarBannerVisual();
        validarYEntrar();
      } else {
        alert("Contraseña incorrecta. Validá los datos comerciales provistos.");
      }
    };
  }

  if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
  if(document.getElementById("guardarFunda")) document.getElementById("guardarFunda").onclick = guardarFunda;
  if(document.getElementById("buscar")) document.getElementById("buscar").addEventListener("input", filtrarFundas);
  if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").onclick = mostrarAsistente;
  if(document.getElementById("btnRegistrarVenta")) document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;
  if(document.getElementById("fotoInput")) document.getElementById("fotoInput").onchange = procesarImagenesList; 
  
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

  // --- GUARDADO DE BANNERS EN CLOUDINARY ---
  if (document.getElementById("btnGuardarBanner")) {
    document.getElementById("btnGuardarBanner").onclick = async () => {
      const modal = document.getElementById("modalBanner");
      const fileInput = modal.querySelector("input[type='file']");
      const tipoBanner = document.getElementById("selectTipoBanner").value;
      
      if (!fileInput || fileInput.files.length === 0) {
        alert("Por favor, seleccioná un archivo de imagen válido.");
        return;
      }

      if (CLOUDINARY_CLOUD_NAME === "TU_CLOUD_NAME_AQUI") {
        return alert("⚠️ Faltan datos: Por favor, colocá tu Cloud Name de Cloudinary en el archivo app.js.");
      }
      
      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      
      const loader = document.getElementById("cargando");
      if (loader) loader.style.display = "flex";
      
      try {
        const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: formData
        });
        const datosCloudinary = await respuesta.json();
        
        if (datosCloudinary.secure_url) {
          const urlSubida = datosCloudinary.secure_url;
          const docRef = doc(db, "configuracion", "banners");
          
          if (tipoBanner === "mayorista") {
            urlBannerMayorista = urlSubida;
            await setDoc(docRef, { urlMayorista: urlSubida }, { merge: true });
            alert("¡Banner de la sección Mayorista actualizado con éxito!");
          } else {
            urlBannerGeneral = urlSubida;
            await setDoc(docRef, { urlGeneral: urlSubida }, { merge: true });
            alert("¡Banner de la sección Pública actualizado con éxito!");
          }
          
          actualizarBannerVisual();
          modal.style.display = "none";
          fileInput.value = "";
        } else {
          alert("Ocurrió un inconveniente al procesar la imagen en Cloudinary.");
        }
      } catch (error) {
        console.error("Error crítico al guardar la configuración del banner:", error);
        alert("Error de conexión al guardar los datos del banner.");
      } finally {
        if (loader) loader.style.display = "none";
      }
    };
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
  if(document.getElementById("btnCerrarFotoPro")) {
    document.getElementById("btnCerrarFotoPro").onclick = cerrarEditorFotoPro;
  }
  if(document.getElementById("btnBorrarFondo")) {
    document.getElementById("btnBorrarFondo").onclick = ejecutarBorradoFondoIA;
  }
  if(document.getElementById("btnMejorarCalidad")) {
    document.getElementById("btnMejorarCalidad").onclick = ejecutarMejoraIA;
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

// --- LÓGICA DESCUENTOS ---
async function cargarConfiguracionTienda() {
  try {
    const docRef = doc(db, "configuracion", "tienda");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      descuentoGlobal = data.descuento || 0;
      tipoDescuento = data.tipo || "global";
      productosDescuento = data.productosIds || [];
    }
  } catch (error) {
    console.error("Error cargando configuración de descuentos:", error);
  }
}

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
    
    descuentoGlobal = valor;
    tipoDescuento = selectTipo;
    productosDescuento = seleccionados;

    document.getElementById("modalDescuentos").style.display = "none";
    alert(`¡Configuración de descuentos actualizada con éxito!`);
    
    renderizarFundas(todasLasFundas);
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
  
  document.getElementById("app").style.display = "none";
  document.getElementById("modalAdminLogin").style.display = "none";
  document.getElementById("login").style.display = "flex";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
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
      actualizarBannerVisual();
      
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
    if (sessionStorage.getItem("mayoristaValidado") !== "true") {
      const datos = JSON.parse(datosClienteStr);
      rolUsuario = datos.rol || "cliente";
    }
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

  localStorage.setItem("clienteINeoDatos", JSON.stringify({ nombre: nombre, telefono: telefono, rol: rolUsuario }));

  try {
    await signInAnonymously(auth);

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
    actualizarBannerVisual();
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

  let aplicaDescuento = false;
  if (descuentoGlobal > 0) {
      if (tipoDescuento === "global" || (tipoDescuento === "especifico" && productosDescuento.includes(fundaReservando.id))) {
          aplicaDescuento = true;
      }
  }

  let precioOriginal = fundaReservando.venta || 0;
  if (rolUsuario === "mayorista" && fundaReservando.mayorista > 0) {
      precioOriginal = fundaReservando.mayorista;
  }

  const precioFinal = aplicaDescuento ? Math.round(precioOriginal * (1 - (descuentoGlobal / 100))) : precioOriginal;

  let fotoPrincipal = "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=100&auto=format&fit=crop&q=60";
  if (fundaReservando.fotos && fundaReservando.fotos.length > 0) {
      fotoPrincipal = fundaReservando.fotos[0].url;
  } else if (fundaReservando.foto) {
      fotoPrincipal = fundaReservando.foto;
  }

  const item = {
      id: fundaReservando.id,
      nombre: fundaReservando.nombre,
      modelo: fundaReservando.sinModelo ? "Único" : modeloSeleccionado,
      precio: precioFinal,
      foto: fotoPrincipal
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
            fotos: [],
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

// ==========================================================================
// 🚀 GESTIÓN DE GALERÍA Y FOTO PRO
// ==========================================================================

async function procesarImagenesList(evento) {
  const archivos = Array.from(evento.target.files);
  if (!archivos.length) return;

  const btnGuardar = document.getElementById("guardarFunda");
  btnGuardar.disabled = true;
  btnGuardar.innerText = "⏳ Procesando Imágenes...";

  for (const archivo of archivos) {
    const base64 = await leerArchivoBase64(archivo);
    galeriaTemporal.push({
      idLocal: Date.now() + Math.random(),
      base64: base64,
      url: "",
      transparenteBase64: "",
      urlTransparente: ""
    });
  }

  document.getElementById("fotoInput").value = ""; 
  renderGaleriaFormulario();
  
  btnGuardar.disabled = false;
  btnGuardar.innerText = idFundaEditando ? "Actualizar" : "Guardar";
}

function leerArchivoBase64(archivo) {
  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            canvas.width = 800;
            canvas.height = 800;
        
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 800, 800);

            const ladoMenor = Math.min(img.width, img.height);
            const sx = (img.width - ladoMenor) / 2;
            const sy = (img.height - ladoMenor) / 2;

            ctx.drawImage(img, sx, sy, ladoMenor, ladoMenor, 0, 0, 800, 800);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
        }
        img.src = e.target.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function renderGaleriaFormulario() {
  const contenedor = document.getElementById("contenedorGaleria");
  contenedor.innerHTML = "";
  
  if (galeriaTemporal.length === 0) {
     contenedor.innerHTML = "<p style='font-size:13px; color:#6e6e73;'>No hay imágenes seleccionadas.</p>";
     return;
  }

  galeriaTemporal.forEach((imgData, index) => {
     const imgSrc = imgData.base64 || imgData.url;
     const div = document.createElement("div");
     div.style.cssText = "position: relative; flex-shrink: 0; width: 130px; border: 1px solid #d2d2d7; border-radius: 8px; overflow: hidden; background: white;";

     div.innerHTML = `
        ${index === 0 ? '<span style="position:absolute; top:4px; left:4px; background:#34c759; color:white; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold; z-index:2;">Principal</span>' : ''}
        <img src="${imgSrc}" style="width: 100%; height: 130px; object-fit: cover; display: block;">
      
        <div style="padding: 6px; display: flex; flex-direction: column; gap: 5px;">
           <button type="button" onclick="iniciarEdicionPro(${index})" style="padding: 6px; font-size: 11px; font-weight: bold; background: linear-gradient(135deg, #5856d6, #ff2d55); color: white; border: none; border-radius: 6px; cursor: pointer;">✨ Editor Pro</button>
           <button type="button" onclick="eliminarImagenGaleria(${index})" style="padding: 6px; font-size: 11px; font-weight: bold; background: #ff3b30; color: white; border: none; border-radius: 6px; cursor: pointer;">🗑️ Quitar</button>
        </div>
     `;
     contenedor.appendChild(div);
  });
}

window.eliminarImagenGaleria = (index) => {
   galeriaTemporal.splice(index, 1);
   renderGaleriaFormulario();
};

window.iniciarEdicionPro = (index) => {
    indiceEdicionPro = index;
    const imgData = galeriaTemporal[index];

    const imgOriginal = new Image();
    imgOriginal.crossOrigin = "anonymous";
    imgOriginal.onload = () => {
        imagenOriginalTemporal = imgOriginal;

        if (imgData.transparenteBase64 || imgData.urlTransparente) {
            const imgRecortada = new Image();
            imgRecortada.crossOrigin = "anonymous";
            imgRecortada.onload = () => {
                imagenRecortadaTemporal = imgRecortada;
                abrirEditorFotoPro();
            };
            imgRecortada.src = imgData.transparenteBase64 || imgData.urlTransparente;
        } else {
            imagenRecortadaTemporal = null;
            abrirEditorFotoPro();
        }
    };
    imgOriginal.src = imgData.base64 || imgData.url;
};

// 🚀 IA Y REMOVE BG CON CANVAS INTERACTIVO (MODAL FOTO PRO)
function abrirEditorFotoPro() {
  document.getElementById("modalFotoPro").style.display = "flex";
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
  if (indiceEdicionPro === null) return alert("Error de selección de imagen.");
  const imgData = galeriaTemporal[indiceEdicionPro];
  const imgSrc = imgData.base64 || imgData.url;

  if (!imgSrc) return alert("No hay imagen para procesar.");

  const btn = document.getElementById("btnBorrarFondo");
  const textoOriginal = btn.innerText;
  btn.innerText = "⏳ Borrando..."; 
  btn.disabled = true;

  try {
    const formData = new FormData();
    if (imgSrc.startsWith("data:image")) {
      formData.append("image_file_b64", imgSrc.split(',')[1]);
    } else {
      formData.append("image_url", imgSrc);
    }
    
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
      const base64Recortada = reader.result;
      galeriaTemporal[indiceEdicionPro].transparenteBase64 = base64Recortada; 

      imagenRecortadaTemporal = new Image();
      imagenRecortadaTemporal.crossOrigin = "anonymous";
      imagenRecortadaTemporal.onload = () => { 
        dibujarCanvasGestos(); 
        btn.innerText = textoOriginal; 
        btn.disabled = false; 
      };
      imagenRecortadaTemporal.src = base64Recortada;
    };

    reader.readAsDataURL(blobImagenRecortada);

  } catch (err) { 
    console.error(err); 
    alert("Problemita con Remove.bg. Verifica API Key o conexión."); 
    btn.innerText = textoOriginal; 
    btn.disabled = false;
  }
}

// ✨ NUEVA FUNCIONALIDAD: MEJORAR CALIDAD CON CLOUDINARY
// ✨ NUEVA FUNCIONALIDAD: MEJORAR CALIDAD CON CLOUDINARY (CORREGIDA PARA PNG)
async function ejecutarMejoraIA() {
  if (indiceEdicionPro === null) return alert("Error de selección de imagen.");
  if (CLOUDINARY_CLOUD_NAME === "TU_CLOUD_NAME_AQUI") {
      return alert("⚠️ Falta configurar: Colocá tu 'Cloud Name' de Cloudinary en la parte superior del archivo app.js para poder usar la mejora de IA.");
  }

  // Detectamos si la imagen actual es la recortada (sin fondo) o la original
  let esTransparente = !!imagenRecortadaTemporal;
  
  let imagenActualData = esTransparente ? galeriaTemporal[indiceEdicionPro].transparenteBase64 : galeriaTemporal[indiceEdicionPro].base64;
  let imgSrc = imagenActualData || galeriaTemporal[indiceEdicionPro].urlTransparente || galeriaTemporal[indiceEdicionPro].url;
  
  if (!imgSrc) return alert("No hay imagen para procesar.");

  const btn = document.getElementById("btnMejorarCalidad");
  const textoOriginal = btn.innerText;
  btn.innerText = "🪄 Procesando..."; 
  btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", imgSrc);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    
    // Subimos la foto temporalmente a Cloudinary
    const respuestaAPI = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { 
      method: "POST", 
      body: formData 
    });

    const resultado = await respuestaAPI.json();
    if (resultado.error) throw new Error(resultado.error.message);

    // 💡 SOLUCIÓN A LA TRANSPARENCIA:
    // Si la foto está recortada (transparente), NO usamos e_improve porque elimina el fondo. 
    // Usamos Upscale (escala la IA), Sharpen (enfoque) y forzamos el formato a PNG (f_png).
// Usamos auto-contraste, auto-color, escalado por IA y enfoque para mejorar la calidad sin romper el PNG
    let parametrosCloudinary = esTransparente 
        ? "e_auto_contrast,e_auto_color,e_upscale,e_sharpen:30,f_png" 
        : "e_improve,e_upscale,f_png";
    
    // Aplicamos los parámetros a la URL
    const urlMejorada = resultado.secure_url.replace("/upload/", `/upload/${parametrosCloudinary}/`);
    
    // Traemos la imagen procesada y la convertimos de nuevo a base64 para el canvas
    const blobRes = await fetch(urlMejorada);
    const blob = await blobRes.blob();
    const reader = new FileReader();

    reader.onloadend = function() {
      const base64Mejorada = reader.result;
      
      if (esTransparente) {
          galeriaTemporal[indiceEdicionPro].transparenteBase64 = base64Mejorada;
          imagenRecortadaTemporal = new Image();
          imagenRecortadaTemporal.crossOrigin = "anonymous";
          imagenRecortadaTemporal.onload = () => { dibujarCanvasGestos(); };
          imagenRecortadaTemporal.src = base64Mejorada;
      } else {
          galeriaTemporal[indiceEdicionPro].base64 = base64Mejorada;
          imagenOriginalTemporal = new Image();
          imagenOriginalTemporal.crossOrigin = "anonymous";
          imagenOriginalTemporal.onload = () => { dibujarCanvasGestos(); };
          imagenOriginalTemporal.src = base64Mejorada;
      }
      
      btn.innerText = textoOriginal; 
      btn.disabled = false; 
    };
    reader.readAsDataURL(blob);

  } catch (err) { 
    console.error(err); 
    alert("Hubo un error al mejorar la imagen. Revisa la conexión o verifica el Cloud Name."); 
    btn.innerText = textoOriginal; 
    btn.disabled = false;
  }
}

function reEditarMontaje() {
  porcentajeEscala = 0.72; 
  rotacionGrados = 0; 
  nivelBrillo = 100; 
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
  
  let isDragging = false, startX = 0, startY = 0, prevTouchDist = null;
  
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
    const rect = canvas.getBoundingClientRect(), scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
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
      prevTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };
  
  canvas.ontouchmove = (e) => {
    if (e.touches.length === 2 && prevTouchDist) {
      e.preventDefault();
      const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
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
  
  let imagenADibujar = imagenRecortadaTemporal || imagenOriginalTemporal;
  if (!imagenADibujar) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  }

  ctx.save(); 
  ctx.translate(canvasPosX, canvasPosY); 
  ctx.rotate(rotacionGrados * Math.PI / 180);

  if (opacidadSombra > 0 && tipoFondoElegido !== "original") { 
    ctx.shadowColor = `rgba(0, 0, 0, ${opacidadSombra})`; 
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 30; 
    ctx.shadowOffsetY = 40; 
  }

  const limitePixel = 1000 * porcentajeEscala;
  const escala = Math.min(limitePixel / imagenADibujar.width, limitePixel / imagenADibujar.height);
  const anchoFinal = imagenADibujar.width * escala, altoFinal = imagenADibujar.height * escala;

  ctx.filter = `brightness(${nivelBrillo}%)`;
  ctx.drawImage(imagenADibujar, -anchoFinal / 2, -altoFinal / 2, anchoFinal, altoFinal);
  ctx.restore();
}

async function aplicarMontajeFinal() {
  const canvas = document.getElementById("canvasGestos");
  if (!canvas || indiceEdicionPro === null) return;

  const fotoFinalBase64 = canvas.toDataURL("image/jpeg", 0.9); 
  galeriaTemporal[indiceEdicionPro].base64 = fotoFinalBase64; 
  
  renderGaleriaFormulario();
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
    let str = linea.trim(); if (!str) return;
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
  const labelStock = document.getElementById('labelStock'), 
        stockPorModelo = document.getElementById('stockPorModelo'), 
        stockTotalSencillo = document.getElementById('stockTotalSencillo'), 
        cajaFormateador = document.getElementById('cajaFormateador'), 
        btnToggleModelo = document.getElementById('btnToggleModelo');
        
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
function mostrarFormulario() {
  if (!esAdmin) return;
  if (listaCategorias.length === 0) {
    alert("⚠️ Primero debés crear al menos una categoría desde el menú lateral.");
    return;
  }
  
  idFundaEditando = null;
  galeriaTemporal = [];
  indiceEdicionPro = null;
  
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
  
  renderGaleriaFormulario();
  
  if(document.getElementById("menuAccionesIA")) document.getElementById("menuAccionesIA").style.display = "none";
  if(document.getElementById("cajaFormateador")) document.getElementById("cajaFormateador").style.display = "none";
  if(document.getElementById("textoCrudoStock")) document.getElementById("textoCrudoStock").value = "";

  document.getElementById("agregar").style.display = "flex";
}

function ocultarFormulario() {
  idFundaEditando = null; 
  galeriaTemporal = []; 
  indiceEdicionPro = null;
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
  
  if (CLOUDINARY_CLOUD_NAME === "TU_CLOUD_NAME_AQUI" && galeriaTemporal.some(i => i.base64 || i.transparenteBase64)) {
    return alert("⚠️ Falta configurar: Colocá tu 'Cloud Name' de Cloudinary en el archivo app.js para poder guardar las imágenes.");
  }

  btnGuardar.disabled = true;
  btnGuardar.innerText = "⏳ Subiendo imágenes..."; 

  // MIGRACIÓN A CLOUDINARY PARA LAS FOTOS NUEVAS
  const subirACloudinary = async (base64) => {
    const formData = new FormData(); 
    formData.append("file", base64);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    
    const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { 
      method: "POST", 
      body: formData 
    });
    
    const resultado = await respuesta.json();
    if (resultado.error) throw new Error(resultado.error.message);
    return resultado.secure_url;
  };

  let urlsGaleriaFinal = [];
  let urlPortada = "";
  let urlPortadaTransparente = "";

  try {
    for (let i = 0; i < galeriaTemporal.length; i++) {
        let img = galeriaTemporal[i];
        
        // Mantiene la URL vieja (por ejemplo, de ImgBB) si no se editó la foto
        let urlFinal = img.url;
        let urlTransFinal = img.urlTransparente;

        // Si es una imagen nueva o editada (Base64), la sube a Cloudinary
        if (img.base64 && img.base64.startsWith("data:image")) {
            btnGuardar.innerText = `⏳ Subiendo img ${i+1}/${galeriaTemporal.length}...`;
            urlFinal = await subirACloudinary(img.base64);
        }
        if (img.transparenteBase64 && img.transparenteBase64.startsWith("data:image")) {
            urlTransFinal = await subirACloudinary(img.transparenteBase64);
        }

        urlsGaleriaFinal.push({ url: urlFinal, urlTransparente: urlTransFinal });
        
        if (i === 0) { 
          urlPortada = urlFinal; 
          urlPortadaTransparente = urlTransFinal;
        }
    }
    btnGuardar.innerText = "💾 Guardando datos...";
  } catch (err) {
    console.error(err); 
    alert("Error al subir fotos. Intenta de nuevo.");
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
    stockPorModeloArray = compatiblesInput.split(",").map(item => { 
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
    fotos: urlsGaleriaFinal, 
    foto: urlPortada, 
    fotoTransparente: urlPortadaTransparente, 
    sinModelo: esProductoSinModelo 
  };

  if (!idFundaEditando) datosFunda.orden = todasLasFundas.length;

  try {
    if (idFundaEditando) {
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
  galeriaTemporal = [];
  indiceEdicionPro = null;

  if (funda.fotos && funda.fotos.length > 0) {
      funda.fotos.forEach(f => {
          galeriaTemporal.push({
              idLocal: Date.now() + Math.random(),
              base64: "", url: f.url || "",
              transparenteBase64: "", urlTransparente: f.urlTransparente || ""
          });
       });
  } else if (funda.foto) {
      galeriaTemporal.push({
          idLocal: Date.now() + Math.random(),
          base64: "", url: funda.foto,
          transparenteBase64: "", urlTransparente: funda.fotoTransparente || ""
      });
  }

  document.getElementById("modalTitulo").innerText = "✏️ Editar Artículo";
  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("categoriaSelect").value = funda.categoria || (listaCategorias[0] ? listaCategorias[0].nombre : "");
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;
  if(document.getElementById("mayorista")) document.getElementById("mayorista").value = funda.mayorista ?? 0;

  esProductoSinModelo = !!funda.sinModelo;
  const labelStock = document.getElementById('labelStock'), 
        stockPorModelo = document.getElementById('stockPorModelo'), 
        stockTotalSencillo = document.getElementById('stockTotalSencillo'), 
        btnToggleModelo = document.getElementById('btnToggleModelo');
        
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

  renderGaleriaFormulario();

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
    } catch (error) { 
      console.error(error);
    }
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
    } catch (error) { 
      console.error(error);
    }
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
  
  let aplicaDescuento = false;
  if (descuentoGlobal > 0 && (tipoDescuento === "global" || (tipoDescuento === "especifico" && productosDescuento.includes(funda.id)))) {
    aplicaDescuento = true;
  }
  
  let precioOriginal = funda.venta || 0;
  if (rolUsuario === "mayorista" && funda.mayorista > 0) precioOriginal = funda.mayorista;
  
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
    if (barraProgreso) barraProgreso.style.width = `${porcentaje}%`;
    
    if (imagenesCargadas === totalImagenes) {
      setTimeout(() => { 
        if (loader) { 
          loader.style.opacity = "0"; 
          loader.style.transition = "opacity 0.4s ease"; 
          setTimeout(() => { loader.style.display = "none"; }, 400); 
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

// ==========================================================================
// FUNCIÓN NUEVA: CARRUSEL AUTOMÁTICO DE IMÁGENES
// ==========================================================================
function iniciarCarruselAutomatico() {
  if (carruselTimer) clearInterval(carruselTimer);
  
  carruselTimer = setInterval(() => {
      const carruseles = document.querySelectorAll('.carrusel-auto');
      
      carruseles.forEach(carrusel => {
          // Solo animamos si hay más de 1 imagen en el carrusel
          if (carrusel.children.length > 1) {
              const width = carrusel.clientWidth;
              const maxScroll = carrusel.scrollWidth - width;
              
              // Si estamos al final del scroll, volvemos suavemente a la primera imagen
              if (carrusel.scrollLeft >= maxScroll - 10) {
                  carrusel.scrollTo({ left: 0, behavior: 'smooth' });
              } else {
                  // Si no, pasamos a la siguiente imagen
                  carrusel.scrollBy({ left: width, behavior: 'smooth' });
              }
          }
      });
  }, 5000); // 5000 milisegundos = 5 segundos
}

// ==========================================================================
// RENDERIZADO DE PRODUCTOS Y FILTROS
// ==========================================================================

function renderizarFundas(fundasA_Mostrar, textoBuscado = "") {
  const contenedor = document.getElementById("fundas");
  if (!contenedor) return;

  let htmlTotal = "";

  fundasA_Mostrar.forEach((f) => {
    // MÉTRICAS ADMIN
    let bloqueMétricasAdmin = "";
    if (esAdmin) {
      const costo = f.costo || 0, 
            venta = f.venta || 0, 
            mayorista = f.mayorista || 0, 
            gananciaPesos = venta - costo, 
            porcentajeMargen = costo > 0 ? Math.round((gananciaPesos / costo) * 100) : 0;
            
      bloqueMétricasAdmin = `
        <div style="margin: 5px 0 12px 0; order: 3;">
          <p style="font-size: 18px !important; font-weight: 800 !important; color: #1d1d1f !important; margin: 0 0 2px 0 !important;">$${venta}</p>
          <p style="font-size: 13px !important; color: #ff9500 !important; font-weight: 600 !important; margin: 0 0 2px 0 !important;">📦 Mayorista: $${mayorista}</p>
          <p style="font-size: 13px !important; color: #43a047 !important; font-weight: 600 !important; margin: 0 !important;">📈 Ganancia: $${gananciaPesos} (${porcentajeMargen}%)</p>
        </div>`;
    }

    // PRECIOS CLIENTE / MAYORISTA
    let bloquePrecioHTML = ""; 
    let aplicaDescuento = false;
    
    if (descuentoGlobal > 0 && (tipoDescuento === "global" || (tipoDescuento === "especifico" && productosDescuento.includes(f.id)))) {
      aplicaDescuento = true;
    }
    
    if (!esAdmin) {
      if (rolUsuario === "mayorista") {
          let precioMayorista = (f.mayorista && f.mayorista > 0) ? f.mayorista : (f.venta || 0);
          if (aplicaDescuento) {
              const precioDescuento = Math.round(precioMayorista * (1 - (descuentoGlobal / 100)));
              bloquePrecioHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px; margin: 5px 0 15px 0; order: 3;">
                  <span style="font-size: 11px; font-weight: 700; color: #ff9500; text-transform: uppercase;">📦 Tarifa Mayorista</span>
                  <div style="display: flex; align-items: baseline; gap: 8px;">
                    <p style="font-size: 19px !important; font-weight: 800 !important; color: #ff3b30 !important; margin: 0 !important;">$${precioDescuento}</p>
                    <p style="font-size: 14px !important; text-decoration: line-through !important; color: #86868b !important; margin: 0 !important;">$${precioMayorista}</p>
                  </div>
                </div>`;
          } else {
              bloquePrecioHTML = `
                <div style="margin: 5px 0 15px 0; order: 3;">
                  <span style="font-size: 11px; font-weight: 700; color: #ff9500;">📦 Tarifa Mayorista</span>
                  <p style="font-size: 18px !important; font-weight: 800 !important; margin: 0 !important;">$${precioMayorista}</p>
                </div>`;
          }
      } else {
          let precioOriginal = f.venta || 0;
          if (aplicaDescuento) {
              const precioDescuento = Math.round(precioOriginal * (1 - (descuentoGlobal / 100)));
              bloquePrecioHTML = `
                <div style="display: flex; align-items: baseline; gap: 8px; margin: 5px 0 15px 0; order: 3;">
                  <p style="font-size: 19px !important; font-weight: 800 !important; color: #ff3b30 !important; margin: 0 !important;">$${precioDescuento}</p>
                  <p style="font-size: 14px !important; text-decoration: line-through !important; color: #86868b !important; margin: 0 !important;">$${precioOriginal}</p>
                </div>`;
          } else {
              bloquePrecioHTML = `<p style="font-size: 18px !important; font-weight: 800 !important; margin: 5px 0 15px 0; order: 3;">$${precioOriginal}</p>`;
          }
      }
    }

    // STOCK VISUAL
    let bloqueStockHTML = "";
    let stockDetalleHTML = ""; 
    let totalUnidades = 0;
    
    if (f.sinModelo) {
      totalUnidades = Array.isArray(f.stockPorModelo) && f.stockPorModelo[0] ? f.stockPorModelo[0].stock : 0;
    } else if (Array.isArray(f.stockPorModelo)) {
      totalUnidades = f.stockPorModelo.reduce((acc, curr) => acc + curr.stock, 0);
    }
    
    if (totalUnidades > 0) {
      bloqueStockHTML = `<p style="color: #43a047 !important; font-weight: 600 !important;">Stock: ${totalUnidades} u.</p>`;
    } else {
      bloqueStockHTML = `<p style="color: #ff3b30 !important; font-weight: 600 !important;">Sin Stock</p>`;
    }
    
    if (!f.sinModelo && Array.isArray(f.stockPorModelo)) {
        stockDetalleHTML = `<div class="stock-list" style="display: none !important; background: #f5f5f7; padding: 10px; border-radius: 8px;">`;
        f.stockPorModelo.forEach(m => { 
          stockDetalleHTML += `<p style="font-size: 12px; margin: 2px 0;">${m.modelo}: <b>${m.stock} u.</b></p>`; 
        });
        stockDetalleHTML += `</div>
        <button class="btn-ver-stock" style="display: block !important;" onclick="toggleStock(this, 'show')">Ver variantes</button>
        <button class="btn-ocultar-stock" style="display: none !important;" onclick="toggleStock(this, 'hide')">Ocultar variantes</button>`;
    }

    // ACCIONES
    let bloqueAcciones = esAdmin ? `
        <div style="margin-top: 15px; display: flex; gap: 5px; order: 10;">
          <button onclick="abrirEditarFunda('${f.id}')" style="flex:1;">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30; flex:1;">🗑️ Eliminar</button>
        </div>` : `
        <div style="margin-top: 20px; order: 10;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #000; color: #fff; width: 100%; padding: 12px; border-radius: 12px; border:none; cursor:pointer;"
          ${totalUnidades === 0 ? 'disabled style="background: #ccc; cursor: not-allowed;"' : ''}>+ Añadir</button>
        </div>`;

    // 📸 GALERÍA CARRUSEL
    let imagenesArray = [];
    if (f.fotos && f.fotos.length > 0) {
      imagenesArray = f.fotos.map(img => img.url);
    } else if (f.foto) {
      imagenesArray = [f.foto];
    } else {
      imagenesArray = ["https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=300&auto=format&fit=crop&q=60"];
    }

    let carruselHtml = `<div style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; width: 100%; border-radius: var(--radius-md) var(--radius-md) 0 0; scrollbar-width: none;" class="galeria-hide-scrollbar carrusel-auto">`;
    imagenesArray.forEach(url => {
        carruselHtml += `<img src="${url}" class="card-img" style="scroll-snap-align: center; flex: 0 0 100%; width: 100%; aspect-ratio: 1/1; object-fit: cover; background: var(--bg-app);">`;
    });
    carruselHtml += `</div>`;

    // TARJETA FINAL
    htmlTotal += `
      <div class="card" data-id="${f.id}" style="position: relative; display: flex; flex-direction: column;">
        ${esAdmin ? `<div class="drag-handle" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 10; font-size: 14px;">☰</div>` : ''}
        <div class="badge-categoria">${f.categoria || "Varios"}</div>
        ${carruselHtml}
        <div class="card-body">
          <h2 style="margin: 10px 0 5px 0; order: 1;">${f.nombre}</h2>
          ${bloqueStockHTML}
          ${stockDetalleHTML}
          ${!esAdmin ? bloquePrecioHTML : bloqueMétricasAdmin}
          ${bloqueAcciones}
        </div>
      </div>`;
  });
  
  contenedor.innerHTML = htmlTotal;

  if (esAdmin && textoBuscado === "" && categoriaSeleccionadaFiltro === "Todas") {
    habilitarReordenamiento();
  }

  const loader = document.getElementById("cargando");
  if (loader && window.getComputedStyle(loader).display !== "none") {
    controlarCargaDeImagenes();
  }
  
  iniciarCarruselAutomatico();
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
