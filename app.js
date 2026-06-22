import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,      
  getDoc,      
  updateDoc,   
  arrayUnion   
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// 🔑 CONFIGURACIÓN DE CONTACTO
const NUMERO_WHATSAPP = "5491170089123"; 

// Variables globales de control de cara al cliente
let todasLasFundas = [];
let listaCategorias = []; 
let categoriaSeleccionadaFiltro = "Todas"; 
let fundaReservando = null; 

// 🛒 Variables del Carrito de Compras
let carritoDeCompras = JSON.parse(localStorage.getItem("carritoINeo")) || [];

// --- INICIALIZACIÓN DE EVENTOS CLIENTE ---
document.addEventListener("DOMContentLoaded", () => {
  const barra = document.getElementById("loaderProgreso");
  if (barra) barra.style.width = "20%";

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

  if(document.getElementById("buscar")) document.getElementById("buscar").addEventListener("input", filtrarFundas);
  if(document.getElementById("btnConfirmarWhatsApp")) document.getElementById("btnConfirmarWhatsApp").onclick = agregarAlCarrito;
  if(document.getElementById("btnAbrirCarrito")) document.getElementById("btnAbrirCarrito").onclick = abrirCarrito;
  if(document.getElementById("btnCerrarCarrito")) document.getElementById("btnCerrarCarrito").onclick = cerrarCarrito;
  
  const btnComprar = document.getElementById("btnComprarWhatsAppCarrito");
  if (btnComprar) {
    btnComprar.onclick = enviarPedidoWhatsApp;
  }

  if(document.getElementById("btnMenuHamburguesa")) document.getElementById("btnMenuHamburguesa").onclick = toggleSidebar;
  if(document.getElementById("sidebarOverlay")) document.getElementById("sidebarOverlay").onclick = toggleSidebar;
  
  // Si alguien toca cambiar rol desde el index, lo mandamos a tu búnker de admin
  if(document.getElementById("btnCambiarRol")) {
    document.getElementById("btnCambiarRol").onclick = () => {
      window.location.href = "admin.html";
    };
  }

  if(document.getElementById("btnRegistrarCliente")) document.getElementById("btnRegistrarCliente").onclick = procesarRegistroCliente;

  actualizarUI_Carrito();
});

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

// --- AUTENTICACIÓN ANÓNIMA CLIENTE ---
onAuthStateChanged(auth, async (user) => {
  const barra = document.getElementById("loaderProgreso");
  if (barra) barra.style.width = "50%"; 

  if (user) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    
    if (barra) barra.style.width = "75%"; 
    await cargarCategorias();
    await cargarFundas(); 
  } else {
    if (barra) barra.style.width = "100%";
    document.getElementById("login").style.display = "flex";
    document.getElementById("app").style.display = "none";
    solicitarDatosCliente();
  }
});

async function loginCliente() {
  try { await signInAnonymously(auth); } catch (error) { console.error(error); }
}

function solicitarDatosCliente() {
  const datosCliente = localStorage.getItem("clienteINeoDatos");
  if (!datosCliente && document.getElementById("modalRegistroCliente")) {
    document.getElementById("modalRegistroCliente").style.display = "flex";
  }
}

async function procesarRegistroCliente() {
  const nombre = document.getElementById("registroNombre").value.trim();
  let telefonoCrudo = document.getElementById("registroTelefono").value.trim();
  if (!nombre || !telefonoCrudo) return alert("Por favor, completá ambos campos.");

  let telefono = telefonoCrudo.replace(/[^\d+]/g, ''); 
  if (!telefono.startsWith("+") && !telefono.startsWith("54")) telefono = "549" + telefono; 

  const btn = document.getElementById("btnRegistrarCliente");
  btn.disabled = true;
  btn.innerText = "⏳ Ingresando...";

  try {
    const docRef = doc(db, "clientes", telefono); 
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, { nombres: arrayUnion(nombre), ultimoAcceso: new Date().toISOString() });
    } else {
      await setDoc(docRef, { nombres: [nombre], telefono: telefono, primerAcceso: new Date().toISOString(), ultimoAcceso: new Date().toISOString() });
    }
    localStorage.setItem("clienteINeoDatos", JSON.stringify({ nombre: nombre, telefono: telefono }));
    document.getElementById("modalRegistroCliente").style.display = "none";
    loginCliente();
  } catch (error) {
    console.error(error);
    btn.disabled = false;
    btn.innerText = "Entrar al Catálogo 🚀";
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
      if(btnAbrir) btnAbrir.style.display = "none";
      if(totalEl) totalEl.innerText = "$0";
      if(contador) contador.innerText = "0";
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
          </div>`;
  });
  if(totalEl) totalEl.innerText = `$${total}`;
  if(contador) contador.innerText = carritoDeCompras.length; 
  if(btnAbrir) btnAbrir.style.display = "block"; 
}

function abrirCarrito() { document.getElementById("modalCarrito").style.display = "flex"; }
function cerrarCarrito() { document.getElementById("modalCarrito").style.display = "none"; }

function enviarPedidoWhatsApp() {
  if(carritoDeCompras.length === 0) return;
  const datosClienteStr = localStorage.getItem("clienteINeoDatos");
  let nombreCliente = "Cliente";
  if(datosClienteStr) { nombreCliente = JSON.parse(datosClienteStr).nombre; }

  let mensaje = `Hola iNeo Cases! 👋 Soy *${nombreCliente}* y este es mi pedido:\n\n`;
  let totalPedido = 0;

  carritoDeCompras.forEach(item => {
      mensaje += `📦 *${item.nombre}*\n`;
      if (item.modelo !== "Único" && item.modelo !== "") mensaje += `⚙️ Variante: ${item.modelo}\n`;
      mensaje += `💰 $${item.precio}\n────────────────\n`;
      totalPedido += item.precio;
  });

  mensaje += `\n🧾 *TOTAL ESTIMADO: $${totalPedido}*\n\n¿Podemos coordinar el pago y la entrega? ¡Gracias!`;
  window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`, "_blank");
  cerrarCarrito();
}

// --- DATOS DEL CATÁLOGO ---
async function cargarCategorias() {
  try {
    const snapshot = await getDocs(collection(db, "categorias"));
    listaCategorias = [];
    snapshot.forEach(doc => { listaCategorias.push({ id: doc.id, nombre: doc.data().nombre }); });
    renderizarPildorasCategorias();
  } catch (error) { console.error(error); }
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
      contenedor.querySelectorAll(".categoria-pill").forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      filtrarFundas();
    };
  });
}

async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; 
    snapshot.forEach((doc) => { todasLasFundas.push({ id: doc.id, ...doc.data() }); });
    todasLasFundas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    filtrarFundas();
  } catch (error) { console.error(error); }
}

function renderizarFundas(arrayDeFundas, textoBuscado = "") {
  const contenedor = document.getElementById("fundas");
  let html = "";

  arrayDeFundas.forEach((f) => {
    const modelosTotales = f.stockPorModelo || [];
    const modelosFiltrados = (textoBuscado !== "") ? modelosTotales.filter(m => coincideModelo(m.modelo, textoBuscado)) : modelosTotales;
    const totalStock = modelosTotales.reduce((acc, item) => acc + item.stock, 0);
    const mostrarDirecto = (textoBuscado !== "" && modelosFiltrados.length > 0 && modelosFiltrados.length < modelosTotales.length);
    const listaModelosHTML = modelosFiltrados.map(m => `• ${m.modelo}: <b>${m.stock} u.</b>`).join("<br>");
    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60";

    let bloqueStockHTML = f.sinModelo ? `<p>Stock Total: ${totalStock} u.</p>` : `
        <p>Stock Total: ${totalStock} u.</p>
        <button onclick="toggleStock(this, 'show')" class="btn-ver-stock" style="${mostrarDirecto ? 'display: none !important;' : 'display: block !important;'}">Ver stock por modelo</button>
        <button onclick="toggleStock(this, 'hide')" class="btn-ocultar-stock" style="${mostrarDirecto ? 'display: block !important;' : 'display: none !important;'}">Ocultar Stock</button>
        <div class="stock-list" style="${mostrarDirecto ? 'display: block !important;' : 'display: none !important;'} margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5;">${listaModelosHTML}</div>`;

    html += `
    <div class="card" data-id="${f.id}">
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img" loading="lazy">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        ${bloqueStockHTML}
        <p>$${f.venta ?? 0}</p>
        <div style="margin-top: 20px;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #ffffff; color: #000000; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 12px; border-radius: 12px; border:none; cursor:pointer;">+ Añadir</button>
        </div>
      </div>
    </div>`;
  });
  contenedor.innerHTML = html;

  const loader = document.getElementById("cargando");
  if (loader && window.getComputedStyle(loader).display !== "none") controlarCargaDeImagenes();
}

function filtrarFundas() {
  const textoBuscado = document.getElementById("buscar").value.toLowerCase().trim();
  const fundasFiltradas = todasLasFundas.filter((f) => {
    if (categoriaSeleccionadaFiltro !== "Todas" && f.categoria !== categoriaSeleccionadaFiltro) return false;
    return (f.nombre || "").toLowerCase().includes(textoBuscado) || (f.stockPorModelo || []).some((m) => coincideModelo(m.modelo, textoBuscado));
  });
  renderizarFundas(fundasFiltradas, textoBuscado);
}

function coincideModelo(modelo, textoBuscado) {
  const mod = String(modelo).toLowerCase().trim();
  const txt = textoBuscado.toLowerCase().trim();
  if (!mod.includes(txt)) return false;
  if (/\d/.test(txt)) {
    for (let varnt of ["pro", "max", "plus", "mini", "ultra", "fe", "lite", "5g"]) {
      if (mod.includes(varnt) && !txt.includes(varnt)) return false;
    }
  }
  return true;
}

function abrirModalReservar(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;
  fundaReservando = funda;
  document.getElementById("reservaNombreFunda").innerText = funda.nombre || "Sin Nombre";
  document.getElementById("reservaPrecio").innerText = `$${funda.venta ?? 0}`;
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
        option.value = m.modelo; option.innerText = `${m.modelo} (${m.stock} u.)`;
        selectModelo.appendChild(option);
      });
    }
  }
  document.getElementById("modalReservar").style.display = "flex";
}

function controlarCargaDeImagenes() {
  const imagenes = document.querySelectorAll("#fundas .card-img");
  let imagenesCargadas = 0;
  if (imagenes.length === 0) {
    ocultarLoader(); return;
  }
  function verificarFin() {
    imagenesCargadas++;
    if (document.getElementById("loaderProgreso")) document.getElementById("loaderProgreso").style.width = `${92 + ((imagenesCargadas / imagenes.length) * 8)}%`;
    if (imagenesCargadas === imagenes.length) ocultarLoader();
  }
  imagenes.forEach((img) => { if (img.complete) { verificarFin(); } else { img.addEventListener("load", verificarFin); img.addEventListener("error", verificarFin); } });
}

function ocultarLoader() {
  const loader = document.getElementById("cargando");
  if (loader) { loader.style.opacity = "0"; setTimeout(() => { loader.style.display = "none"; }, 400); }
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

window.abrirModalReservar = abrirModalReservar;
window.cerrarModalReservar = () => { fundaReservando = null; document.getElementById("modalReservar").style.display = "none"; };
window.eliminarItemCarrito = eliminarItemCarrito;
