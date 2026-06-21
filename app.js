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
  writeBatch
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
let sortableInstance = null; 

// Almacenamiento local de productos del cliente
let carrito = []; 

// 🚀 CREAR EL DATALIST PARA SUGERENCIAS DEL BUSCADOR PRINCIPAL
const inputBuscar = document.getElementById("buscar");
if (inputBuscar && !document.getElementById("sugerenciasBuscador")) {
  const datalist = document.createElement("datalist");
  datalist.id = "sugerenciasBuscador";
  document.body.appendChild(datalist);
  inputBuscar.setAttribute("list", "sugerenciasBuscador");
}

// Asignación de eventos de la interfaz
document.getElementById("btnLogin").onclick = loginAdmin;
document.getElementById("btnCliente").onclick = loginCliente; 
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);
document.getElementById("btnAsistente").onclick = mostrarAsistente;
document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;
document.getElementById("fotoInput").onchange = procesarImagen;

const btnOldWA = document.getElementById("btnConfirmarWhatsApp");
if (btnOldWA) btnOldWA.onclick = enviarWhatsApp;

document.getElementById("btnAbrirAdminModal").onclick = abrirModalAdmin;
document.getElementById("btnCerrarAdminModal").onclick = cerrarModalAdmin;

document.getElementById("btnMenuHamburguesa").onclick = toggleSidebar;
document.getElementById("sidebarOverlay").onclick = toggleSidebar;
document.getElementById("btnCambiarRol").onclick = ejecutarCambioRol;

document.getElementById("btnGestorCategorias").onclick = abrirModalCategorias;
document.getElementById("btnCerrarCategorias").onclick = cerrarModalCategorias;
document.getElementById("btnGuardarCategoria").onclick = crearNuevaCategoria;

document.getElementById("btnImportarExcel").onclick = () => {
  document.getElementById("inputExcel").click();
};
document.getElementById("inputExcel").onchange = procesarImportacionExcel;

document.getElementById("btnAccionesIA").onclick = toggleMenuIA;
document.getElementById("btnMenuFormatear").onclick = () => {
  document.getElementById("menuAccionesIA").style.display = "none";
  toggleFormateador();
};
document.getElementById("btnCrearFoto").onclick = () => {
  document.getElementById("menuAccionesIA").style.display = "none";
  procesarImagenPro();
};
document.getElementById("btnProcesarStock").onclick = procesarTextoStock;


function toggleSidebar() {
  const sidebar = document.getElementById("sidebarMenu");
  const overlay = document.getElementById("sidebarOverlay");
  const btnMenu = document.getElementById("btnMenuHamburguesa");

  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");

  // Ajuste: Ocultar por completo el botón de menú cuando el panel lateral está abierto
  if (btnMenu) {
    if (sidebar.classList.contains("active")) {
      btnMenu.style.display = "none";
    } else {
      btnMenu.style.display = ""; // Restaura el estilo original (flex/block) definido en CSS
    }
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

// OBSERVADOR DE SESIÓN NATIVO (Firebase Auth)
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
    await cargarFundas(); 
    actualizarCarritoUI(); 
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

// 📂 CREACIÓN Y GESTIÓN DE CATEGORÍAS (FIRESTORE)
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
  } catch (error) {
    console.error(error);
  }
}

async function eliminarCategoria(id, nombre) {
  if (confirm(`¿Estás seguro que quieres eliminar la categoría "${nombre}"?`)) {
    try {
      await deleteDoc(doc(db, "categorias", id));
      await cargarCategorias();
    } catch (error) {
      console.error(error);
    }
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
      </div>
    `;
  });
  contenedor.innerHTML = html;

  contenedor.querySelectorAll(".btn-eliminar-cat").forEach(btn => {
    btn.onclick = function() {
      eliminarCategoria(this.getAttribute("data-id"), this.getAttribute("data-nombre"));
    };
  });
}

// 📥 PROCESADOR LECTOR DE EXCEL A FIRESTORE
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

      if (confirm(`Se detectaron ${filas.length} artículos en el archivo. ¿Proceder a importarlos masivamente?`)) {
        let importados = 0;

        for (const fila of filas) {
          let stockPorModeloArray = [];
          
          if (fila.StockPorModelo) {
            stockPorModeloArray = String(fila.StockPorModelo).split(",")
              .map(item => {
                const [modelo, cantidad] = item.split(":");
                return {
                  modelo: modelo ? modelo.trim() : "Único",
                  stock: cantidad ? Number(cantidad.trim()) : 0
                };
              })
              .filter(item => item.modelo !== "");
          }

          const nuevoProducto = {
            nombre: fila.Nombre || "Artículo Sin Nombre",
            categoria: fila.Categoria || "Varios",
            costo: Number(fila.Costo || 0),
            venta: Number(fila.Venta || 0),
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

// 🚀 ENVIAR FOTO A REMOVE.BG Y CONFIGURAR INTERFAZ EN VIVO
async function procesarImagenPro() {
  const fileInput = document.getElementById("fotoInput");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Por favor, selecciona un archivo de imagen primero.");
    return;
  }

  const btnCrear = document.getElementById("btnCrearFoto");
  btnCrear.disabled = true;
  btnCrear.innerText = "🚀 Recortando...";

  const file = fileInput.files[0];

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
    const urlImagenRecortada = URL.createObjectURL(blobImagenRecortada);

    imagenRecortadaTemporal = new Image();
    imagenRecortadaTemporal.src = urlImagenRecortada;

    await new Promise((res) => imagenRecortadaTemporal.onload = res);

    const preview = document.getElementById("previewFoto");
    preview.src = urlImagenRecortada;
    preview.style.display = "block";

    const contenedorSliders = document.getElementById("controlCamposPro");
    if (contenedorSliders) {
      contenedorSliders.style.display = "block";
      
      const sliderEscala = document.getElementById("sliderEscala");
      sliderEscala.value = 72;
      porcentajeEscala = 0.72;
      document.getElementById("valorEscala").innerText = "72%";

      const sliderRotacion = document.getElementById("sliderRotacion");
      sliderRotacion.value = 0;
      anguloRotacion = 0;
      document.getElementById("valorRotacion").innerText = "0°";
      
      sliderEscala.oninput = function() {
        porcentajeEscala = Number(this.value) / 100;
        document.getElementById("valorEscala").innerText = this.value + "%";
        aplicarMontajeFinal(false); 
      };

      sliderRotacion.oninput = function() {
        anguloRotacion = Number(this.value);
        document.getElementById("valorRotacion").innerText = this.value + "°";
        aplicarMontajeFinal(false); 
      };
    }

    crearBotonesConfirmacion();
    aplicarMontajeFinal(false); 

  } catch (err) {
    console.error(err);
    alert("Hubo un problema al conectar con Remove.bg.");
  } finally {
    btnCrear.disabled = false;
    btnCrear.innerText = "📷 Crear foto Pro";
  }
}

function crearBotonesConfirmacion() {
  if (document.getElementById("contenedorConfirmacion")) return;

  const contenedor = document.createElement("div");
  contenedor.id = "contenedorConfirmacion";
  contenedor.style.cssText = "margin-top: 15px; display: flex; flex-direction: column; gap: 10px; align-items: center;";

  const filaAcciones = document.createElement("div");
  filaAcciones.style.cssText = "display: flex; gap: 10px; justify-content: center; width: 100%;";

  const btnAceptar = document.createElement("button");
  btnAceptar.innerText = "✅ Aplicar y Confirmar";
  btnAceptar.style.background = "#28a745";
  btnAceptar.onclick = () => aplicarMontajeFinal(true);

  const btnCancelar = document.createElement("button");
  btnCancelar.innerText = "❌ Cancelar";
  btnCancelar.style.background = "#dc3545";
  btnCancelar.onclick = () => {
    document.getElementById("contenedorConfirmacion").remove();
    document.getElementById("controlCamposPro").style.display = "none";
    document.getElementById("previewFoto").style.display = "none";
    imagenRecortadaTemporal = null;
  };

  filaAcciones.appendChild(btnAceptar);
  filaAcciones.appendChild(btnCancelar);

  contenedor.appendChild(filaAcciones);
  const preview = document.getElementById("previewFoto");
  preview.parentNode.insertBefore(contenedor, preview.nextSibling);
}

async function aplicarMontajeFinal(mostrarAlerta = false) {
  if (!imagenRecortadaTemporal) return;

  try {
    const imgFondo = new Image();
    imgFondo.src = "fondo-estudio.png";

    await new Promise((res, rej) => {
      imgFondo.onload = res;
      imgFondo.onerror = () => rej(new Error("Falta fondo-estudio.png"));
    });

    const canvasFinal = document.createElement("canvas");
    canvasFinal.width = 1000;
    canvasFinal.height = 1000;
    const ctxFinal = canvasFinal.getContext("2d");

    ctxFinal.drawImage(imgFondo, 0, 0, 1000, 1000);

    const limitePixel = 1000 * porcentajeEscala;
    const escala = Math.min(limitePixel / imagenRecortadaTemporal.width, limitePixel / imagenRecortadaTemporal.height);
    const anchoFinal = imagenRecortadaTemporal.width * escala;
    const altoFinal = imagenRecortadaTemporal.height * escala;

    const radianes = (anguloRotacion * Math.PI) / 180;

    ctxFinal.save();
    ctxFinal.translate(1000 / 2, 1000 / 2); 
    ctxFinal.rotate(radianes);
    ctxFinal.shadowColor = "rgba(0, 0, 0, 0.35)"; 
    ctxFinal.shadowBlur = 35; 
    ctxFinal.drawImage(imagenRecortadaTemporal, -anchoFinal / 2, -altoFinal / 2, anchoFinal, altoFinal);
    ctxFinal.restore();

    fotoBase64 = canvasFinal.toDataURL("image/png");
    document.getElementById("previewFoto").src = fotoBase64;

    if (mostrarAlerta) {
      if (document.getElementById("contenedorConfirmacion")) document.getElementById("contenedorConfirmacion").remove();
      document.getElementById("controlCamposPro").style.display = "none";
      alert("¡Montaje Pro acoplado! El fondo se aplicó correctamente. 🚀");
    }
  } catch (error) {
    console.error(error);
  }
}

function abrirModalReservar(id) {
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  fundaReservando = funda;
  document.getElementById("reservaNombreFunda").innerText = funda.nombre || "Sin Nombre";
  document.getElementById("reservaPrecio").innerText = `$${funda.venta ?? 0}`;

  const selectModelo = document.getElementById("reservaModelo");
  selectModelo.innerHTML = "";

  const btnConfirmarCarrito = document.getElementById("btnConfirmarCarrito");

  if (Array.isArray(funda.stockPorModelo)) {
    const modelsDisponibles = funda.stockPorModelo.filter(m => m.stock > 0);

    if (modelsDisponibles.length === 0) {
      selectModelo.innerHTML = `<option value="">⚠️ Sin stock disponible</option>`;
      if (btnConfirmarCarrito) btnConfirmarCarrito.disabled = true;
    } else {
      if (btnConfirmarCarrito) btnConfirmarCarrito.disabled = false;
      modelsDisponibles.forEach(m => {
        const option = document.createElement("option");
        option.value = m.modelo;
        option.innerText = `${m.modelo} (${m.stock} u.)`;
        selectModelo.appendChild(option);
      });
    }
  } else {
    selectModelo.innerHTML = `<option value="Estándar">Variante Única</option>`;
    if (btnConfirmarCarrito) btnConfirmarCarrito.disabled = false;
  }

  document.getElementById("modalReservar").style.display = "flex";
}

function cerrarModalReservar() {
  fundaReservando = null;
  document.getElementById("modalReservar").style.display = "none";
}

function enviarWhatsApp() {
  const modeloSeleccionado = document.getElementById("reservaModelo").value;
  if (!modeloSeleccionado) return;

  const mensaje = `Hola IneoCases! 👋 Me gustaría reservar:\n\n` +
                  `📦 *Producto:* ${fundaReservando.nombre}\n` +
                  `⚙️ *Variante/Modelo:* ${modeloSeleccionado}\n` +
                  `💰 *Precio:* $${fundaReservando.venta}\n\n` +
                  `¿Tienen disponibilidad para coordinar? ¡Gracias!`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
  cerrarModalReservar();
}

// 🛒 SISTEMA DE CARRITO DE COMPRAS CLIENTE
function confirmarAgregarAlCarrito() {
  const modeloSeleccionado = document.getElementById("reservaModelo").value;
  if (!modeloSeleccionado || modeloSeleccionado.includes("⚠️")) return;

  const itemExistente = carrito.find(item => item.idProducto === fundaReservando.id && item.modelo === modeloSeleccionado);

  if (itemExistente) {
    itemExistente.cantidad++;
  } else {
    carrito.push({
      idProducto: fundaReservando.id,
      nombre: fundaReservando.nombre,
      modelo: modeloSeleccionado,
      precio: fundaReservando.venta ?? 0,
      foto: fundaReservando.foto || "",
      cantidad: 1
    });
  }

  actualizarCarritoUI();
  cerrarModalReservar();
}

function abrirModalCarrito() {
  document.getElementById("modalCarrito").style.display = "flex";
  actualizarCarritoUI();
}

function cerrarModalCarrito() {
  document.getElementById("modalCarrito").style.none = "none";
  document.getElementById("modalCarrito").style.display = "none";
}

function cambiarCantidadCarrito(index, cambio) {
  carrito[index].cantidad += cambio;
  if (carrito[index].cantidad <= 0) {
    carrito.splice(index, 1); 
  }
  actualizarCarritoUI();
}

function actualizarCarritoUI() {
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  
  const carritoBadge = document.getElementById("carritoBadge");
  if (carritoBadge) carritoBadge.innerText = totalItems;

  const btnVerCarrito = document.getElementById("btnVerCarrito");
  if (btnVerCarrito) {
    btnVerCarrito.style.display = (!esAdmin && totalItems > 0) ? "flex" : "none";
  }

  const contenedorItems = document.getElementById("listaCarritoItems");
  if (!contenedorItems) return;

  if (carrito.length === 0) {
    contenedorItems.innerHTML = `<p style="text-align:center; color:#6e6e73; padding: 40px 0; font-size:15px;">Tu carrito está vacío.<br>¡Elegí los mejores accesorios e inicialo!</p>`;
    const carritoTotal = document.getElementById("carritoTotal");
    if (carritoTotal) carritoTotal.innerText = "$0";
    return;
  }

  let html = "";
  carrito.forEach((item, index) => {
    const imgUrl = item.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60";
    const subtotal = item.precio * item.cantidad;

    html += `
      <div style="display: flex; align-items: center; gap: 15px; padding: 15px 0; border-bottom: 1px solid #e5e5ea;">
        <img src="${imgUrl}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 10px; border: 1px solid #d2d2d7; background: #f5f5f7;">
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: #1d1d1f;">${item.nombre}</h4>
          <p style="margin: 2px 0 0 0; font-size: 13px; color: #6e6e73;">Modelo: ${item.modelo}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: #0071e3;">$${item.precio}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="cambiarCantidadCarrito(${index}, -1)" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #e5e5ea; color: #1d1d1f; font-weight: 800; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; user-select:none;">-</button>
          <span style="font-size: 15px; font-weight: 600; min-width: 15px; text-align: center; color: #1d1d1f;">${item.cantidad}</span>
          <button onclick="cambiarCantidadCarrito(${index}, 1)" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #e5e5ea; color: #1d1d1f; font-weight: 800; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; user-select:none;">+</button>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #1d1d1f; min-width: 75px; text-align: right;">
          $${subtotal}
        </div>
      </div>
    `;
  });

  contenedorItems.innerHTML = html;

  const totalPrecio = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const carritoTotal = document.getElementById("carritoTotal");
  if (carritoTotal) carritoTotal.innerText = `$${totalPrecio}`;

  setTimeout(() => {
    const btnPedidoWA = document.getElementById("btnEnviarPedido") || document.querySelector("button[onclick*='enviarPedidoWhatsApp']");
    if (btnPedidoWA) {
      btnPedidoWA.style.display = "flex";
      btnPedidoWA.style.alignItems = "center";
      btnPedidoWA.style.justifyContent = "center";
      btnPedidoWA.style.gap = "10px";
      btnPedidoWA.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 16 16" style="vertical-align: middle;"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.69-4.936c-.202-.101-1.192-.588-1.378-.656-.185-.067-.32-.101-.454.101-.134.2-.522.656-.641.789-.118.134-.237.151-.439.051-2-.1-3.554-.737-4.665-1.723-.13-.114-.13-.183-.02-.283.093-.085.203-.238.304-.358.101-.12.134-.2.201-.336.067-.134.034-.253-.017-.355-.05-.101-.454-1.093-.622-1.499-.163-.393-.332-.34-.454-.341h-.388c-.134 0-.353.05-.538.254-.185.203-.708.692-.708 1.688s.72 1.954.82 2.088c.101.134 1.417 2.167 3.432 3.036.48.207.854.33 1.146.422.482.153.92.131 1.267.081.387-.056 1.192-.487 1.358-.957.166-.47.166-.874.118-.957-.05-.083-.185-.134-.387-.235"/></svg> Pedir por WhatsApp`;
    }
  }, 50);
}

function enviarPedidoWhatsApp() {
  if (carrito.length === 0) return;

  let mensaje = `¡Hola iNeo Cases! 👋 Te paso mi pedido listo para coordinar:\n\n`;
  
  carrito.forEach((item, idx) => {
    mensaje += `${idx + 1}. *${item.nombre}*\n`;
    mensaje += `   ⚙️ Modelo/Variante: ${item.modelo}\n`;
    mensaje += `   🔢 Cantidad: ${item.cantidad} unidad/es\n`;
    mensaje += `   💰 Valor total: $${item.precio * item.cantidad}\n\n`;
  });

  const totalFinal = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  mensaje += `📊 *Monto Total Estimado:* $${totalFinal}\n\n`;
  mensaje += `¿Tienen disponibilidad para confirmar stock de la lista y coordinar? ¡Muchas gracias!`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");

  carrito = [];
  actualizarCarritoUI();
  cerrarModalCarrito();
}

// Funciones de IA y Formateo
function toggleMenuIA() {
  const menu = document.getElementById("menuAccionesIA");
  if(menu) {
    menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none";
  }
}

function toggleFormateador() {
  const caja = document.getElementById("cajaFormateador");
  if(caja) {
    caja.style.display = (caja.style.display === "none" || caja.style.display === "") ? "block" : "none";
  }
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

    if (str.length > 0) {
      str = str.charAt(0).toUpperCase() + str.slice(1);
    }

    resultado.push(`${str}:${cantidad}`);
  });

  document.getElementById("stockPorModelo").value = resultado.join(', ');
  document.getElementById("textoCrudoStock").value = "";
  document.getElementById("cajaFormateador").style.display = "none";
}

function mostrarFormulario() {
  if (!esAdmin) return;
  if (listaCategorias.length === 0) {
    alert("⚠️ Primero debés crear al menos una categoría desde el menú lateral.");
    return;
  }
  
  idFundaEditando = null;
  fotoBase64 = ""; 
  document.getElementById("modalTitulo").innerText = "➕ Nuevo Artículo";
  document.getElementById("guardarFunda").innerText = "Guardar";
  document.getElementById("guardarFunda").disabled = false;
  
  document.getElementById("nombre").value = "";
  if(document.getElementById("categoriaSelect").options.length > 0) document.getElementById("categoriaSelect").selectedIndex = 0;
  document.getElementById("stockPorModelo").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("fotoInput").value = "";
  
  document.getElementById("previewFoto").style.display = "none";
  if (document.getElementById("contenedorConfirmacion")) document.getElementById("contenedorConfirmacion").remove();
  document.getElementById("controlCamposPro").style.display = "none";
  
  if(document.getElementById("menuAccionesIA")) document.getElementById("menuAccionesIA").style.display = "none";
  if(document.getElementById("cajaFormateador")) document.getElementById("cajaFormateador").style.display = "none";
  if(document.getElementById("textoCrudoStock")) document.getElementById("textoCrudoStock").value = "";

  document.getElementById("agregar").style.display = "flex";
}

function ocultarFormulario() {
  idFundaEditando = null;
  fotoBase64 = "";
  if (document.getElementById("contenedorConfirmacion")) document.getElementById("contenedorConfirmacion").remove();
  document.getElementById("controlCamposPro").style.display = "none";
  document.getElementById("agregar").style.display = "none";
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

function procesarImagen(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  if (document.getElementById("contenedorConfirmacion")) document.getElementById("contenedorConfirmacion").remove();
  document.getElementById("controlCamposPro").style.display = "none";

  const btnGuardar = document.getElementById("guardarFunda");
  btnGuardar.disabled = true;

  const lector = new FileReader();
  lector.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");

      const ladoMenor = Math.min(img.width, img.height);
      const sx = (img.width - ladoMenor) / 2;
      const sy = (img.height - ladoMenor) / 2;

      ctx.drawImage(img, sx, sy, ladoMenor, ladoMenor, 0, 0, 600, 600);
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
  
  datalist.innerHTML = Array.from(sugerencias)
    .sort() 
    .map(texto => `<option value="${texto}"></option>`)
    .join("");
}

async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; 
    let necesitaMigracion = false;

    snapshot.forEach((doc) => {
      const datos = doc.data();
      if (datos.orden === undefined) {
        necesitaMigracion = true;
      }
      todasLasFundas.push({ id: doc.id, ...datos });
    });

    if (necesitaMigracion) {
      console.log("⚙️ Sincronizando índices correlativos...");
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
  } catch (error) {
    console.error("Error al cargar o migrar fundas:", error);
  }
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
  btnGuardar.disabled = true;

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
    categoria: document.getElementById("categoriaSelect").value, 
    stockPorModelo: stockPorModeloArray,
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: fotoBase64 
  };

  if (!idFundaEditando) {
    datosFunda.orden = todasLasFundas.length;
  }

  try {
    if (idFundaEditando) {
      if (!fotoBase64) {
        const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
        datosFunda.foto = vieja ? (vieja.foto || "") : "";
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
  } finally {
    btnGuardar.disabled = false;
  }
}

async function eliminarFunda(id) {
  if (!esAdmin) return;
  if (confirm("¿Seguro que deseas eliminar este artículo?")) {
    try {
      await deleteDoc(doc(db, "fundas", id));
      cargarFundas();
    } catch (error) {
      console.error(error);
    }
  }
}

function abrirEditarFunda(id) {
  if (!esAdmin) return;
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  idFundaEditando = id;
  document.getElementById("modalTitulo").innerText = "✏️ Editar Artículo";

  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("categoriaSelect").value = funda.categoria || (listaCategorias[0] ? listaCategorias[0].nombre : "");
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;

  if (Array.isArray(funda.stockPorModelo)) {
    document.getElementById("stockPorModelo").value = funda.stockPorModelo
      .map(m => `${m.modelo}:${m.stock}`)
      .join(", ");
  }

  const preview = document.getElementById("previewFoto");
  if (funda.foto) {
    fotoBase64 = funda.foto;
    preview.src = funda.foto;
    preview.style.display = "block";
  } else {
    fotoBase64 = "";
    preview.style.display = "none";
  }

  if (document.getElementById("contenedorConfirmacion")) document.getElementById("contenedorConfirmacion").remove();
  document.getElementById("controlCamposPro").style.display = "none";
  
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

  if (Array.isArray(fundaEncontrada.stockPorModelo)) {
    const modeloStock = fundaEncontrada.stockPorModelo.find(m => m.modelo.toLowerCase().trim() === modeloBuscado);
    if (!modeloStock) return alert("Variante/Modelo no encontrado.");
    if (modeloStock.stock < unidadesAVender) return alert("Stock insuficiente.");

    modeloStock.stock -= unidadesAVender;

    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), {
        stockPorModelo: fundaEncontrada.stockPorModelo
      });
      alert(`¡Venta registrada!`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) {
      console.error(error);
    }
  }
}

function habilitarReordenamiento() {
    if (!esAdmin) return; 

    const contenedor = document.getElementById('fundas');
    if (!contenedor) return;

    if (sortableInstance) {
       sortableInstance.destroy();
    }
    
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
        console.error("Error al reordenar:", error);
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

    const listaModelosHTML = modelosFiltrados
      .map(m => `• ${m.modelo}: <b>${m.stock} u.</b>`)
      .join("<br>");

    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60";
    
    let bloqueAcciones = esAdmin ? `
        <div style="margin-top: 15px; display: flex; gap: 5px;">
          <button onclick="abrirEditarFunda('${f.id}')" style="flex:1;">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30; flex:1;">🗑️ Eliminar</button>
        </div>` : `
        <div style="margin-top: 20px;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #1d1d1f; color: white; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 12px; border-radius: 12px; border:none; cursor:pointer; user-select:none;">
            Comprar 🛒
          </button>
        </div>`;

    html += `
    <div class="card" data-id="${f.id}" style="position: relative;">
      ${esAdmin ? `<div class="drag-handle" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 10; font-size: 14px;">☰</div>` : ''}
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock Total: ${totalStock} u.</b></p>
        
        <button onclick="toggleStock(this, 'show')" 
                class="btn-ver-stock"
                style="width:100%; margin-bottom:10px; background:#28a745; color:white; border:none; padding:8px; border-radius:8px; cursor:pointer; font-weight:600; display: ${mostrarDirecto ? 'none' : 'block'}">
          🔍 Ver Stock por Modelo
        </button>

        <button onclick="toggleStock(this, 'hide')" 
                class="btn-ocultar-stock"
                style="width:100%; margin-bottom:10px; background:#6c757d; color:white; border:none; padding:8px; border-radius:8px; cursor:pointer; font-weight:600; display: ${mostrarDirecto ? 'block' : 'none'}">
          ⬆️ Ocultar Stock
        </button>

        <div class="stock-list" style="margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5; display: ${mostrarDirecto ? 'block' : 'none'};">
          ${listaModelosHTML}
        </div>

        <p style="font-size: 17px; color:#0071e3; font-weight:700;">💰 Precio: $${f.venta ?? 0}</p>
        ${bloqueAcciones}
      </div>
    </div>
    `;
  });
  document.getElementById("fundas").innerHTML = html;

  if (esAdmin && textoBuscado === "" && categoriaSeleccionadaFiltro === "Todas") {
    habilitarReordenamiento();
  }
}

function filtrarFundas() {
  const textoBuscado = document.getElementById("buscar").value.toLowerCase().trim();

  const fundasFiltradas = todasLasFundas.filter((f) => {
    if (categoriaSeleccionadaFiltro !== "Todas" && f.categoria !== categoriaSeleccionadaFiltro) {
      return false;
    }

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

function coincideModelo(modelo, textoBuscado) {
  const mod = String(modelo).toLowerCase().trim();
  const txt = textoBuscado.toLowerCase().trim();
  
  if (!mod.includes(txt)) return false;

  if (/\d/.test(txt)) {
    const variantes = ["pro", "max", "plus", "mini", "ultra", "fe", "lite", "5g"];
    
    for (let variante of variantes) {
      if (mod.includes(variante) && !txt.includes(variante)) {
        return false;
      }
    }
  }
  
  return true;
}

// EXPOSICIÓN DE MÉTODOS AL OBJETO WINDOW
window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente;
window.abrirModalReservar = abrirModalReservar;
window.cerrarModalReservar = cerrarModalReservar;

window.confirmarAgregarAlCarrito = confirmarAgregarAlCarrito;
window.abrirModalCarrito = abrirModalCarrito;
window.cerrarModalCarrito = cerrarModalCarrito;
window.cambiarCantidadCarrito = cambiarCantidadCarrito;
window.enviarPedidoWhatsApp = enviarPedidoWhatsApp;

window.toggleStock = (btn, action) => {
  const card = btn.closest('.card');
  const stockDiv = card.querySelector('.stock-list');
  const btnVer = card.querySelector('.btn-ver-stock');
  const btnOcultar = card.querySelector('.btn-ocultar-stock');

  if (action === 'show') {
    stockDiv.style.display = 'block';
    btnVer.style.display = 'none';
    btnOcultar.style.display = 'block';
  } else {
    stockDiv.style.display = 'none';
    btnVer.style.display = 'block';
    btnOcultar.style.display = 'none';
  }
};
