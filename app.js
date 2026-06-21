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
let sortableInstance = null; // Instancia global para el Drag and Drop
let esProductoSinModelo = false; // Variable global para controlar el modo del producto actual

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
document.getElementById("btnConfirmarWhatsApp").onclick = enviarWhatsApp;

document.getElementById("btnAbrirAdminModal").onclick = abrirModalAdmin;
document.getElementById("btnCerrarAdminModal").onclick = cerrarModalAdmin;

document.getElementById("btnMenuHamburguesa").onclick = toggleSidebar;
document.getElementById("sidebarOverlay").onclick = toggleSidebar;
document.getElementById("btnCambiarRol").onclick = ejecutarCambioRol;

// Evento para el botón dinámico "No Modelo"
document.getElementById("btnToggleModelo").onclick = toggleModoModelo;

// Eventos del Gestor de Categorías Personalizadas
document.getElementById("btnGestorCategorias").onclick = abrirModalCategorias;
document.getElementById("btnCerrarCategorias").onclick = cerrarModalCategorias;
document.getElementById("btnGuardarCategoria").onclick = crearNuevaCategoria;

// Evento para activar importación por Excel
document.getElementById("btnImportarExcel").onclick = () => {
  document.getElementById("inputExcel").click();
};
document.getElementById("inputExcel").onchange = procesarImportacionExcel;

// Eventos para el Menú IA y Formateador
document.getElementById("btnAccionesIA").onclick = toggleMenuMenuIA;
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
    alert("Hubo un problemita al conectar con Remove.bg.");
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

function cerrarModalReservar() {
  fundaReservando = null;
  document.getElementById("modalReservar").style.display = "none";
}

function enviarWhatsApp() {
  const modeloSeleccionado = document.getElementById("reservaModelo").value;
  if (!modeloSeleccionado) return;

  const bloqueModelo = fundaReservando.sinModelo ? "" : `⚙️ *Variante/Modelo:* ${modeloSeleccionado}\n`;

  const mensaje = `Hola iNeo Cases! 👋 Me gustaría reservar:\n\n` +
                  `📦 *Producto:* ${fundaReservando.nombre}\n` +
                  bloqueModelo +
                  `💰 *Precio:* $${fundaReservando.venta}\n\n` +
                  `¿Tienen disponibilidad para coordinar? ¡Gracias!`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
  cerrarModalReservar();
}

function toggleMenuMenuIA() {
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

// OPTIMIZACIÓN EXCLUSIVA PARA EVITAR ERRORES DE DOCUMENTO DE MÁS DE 1MB AL SUBIR IMÁGENES
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
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");

      const ladoMenor = Math.min(img.width, img.height);
      const sx = (img.width - ladoMenor) / 2;
      const sy = (img.height - ladoMenor) / 2;

      ctx.drawImage(img, sx, sy, ladoMenor, ladoMenor, 0, 0, 500, 500);
      fotoBase64 = canvas.toDataURL("image/jpeg", 0.4);

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
      })
      .filter(item => item.modelo !== "");
  }

  const datosFunda = {
    nombre: document.getElementById("nombre").value,
    categoria: document.getElementById("categoriaSelect").value, 
    stockPorModelo: stockPorModeloArray,
    costo: Number(document.getElementById("costo").value),
    venta: Number(document.getElementById("venta").value),
    foto: fotoBase64,
    sinModelo: esProductoSinModelo 
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
      document.getElementById("stockPorModelo").value = funda.stockPorModelo
        .map(m => `${m.modelo}:${m.stock}`)
        .join(", ");
    }
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

  if (fundaEncontrada.sinModelo) {
    if (!fundaEncontrada.stockPorModelo || fundaEncontrada.stockPorModelo.length === 0) {
      fundaEncontrada.stockPorModelo = [{ modelo: "Único", stock: 0 }];
    }
    const modeloStock = fundaEncontrada.stockPorModelo[0];
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
    return;
  }

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

window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente;
window.abrirModalReservar = abrirModalReservar;
window.cerrarModalReservar = cerrarModalReservar;
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

// 👁️ RENDERIZADO CON INFORMACIÓN FINANCIERA INTEGRADA PARA EL ADMIN
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
    
    let bloqueStockHTML = "";
    if (f.sinModelo) {
      if (esAdmin) {
        bloqueStockHTML = `<p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock Total: ${totalStock} u.</b></p>`;
      } else {
        bloqueStockHTML = ``;
      }
    } else {
      bloqueStockHTML = `
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
      `;
    }

    // 📈 CÁLCULO DE MÉTRICAS ECONÓMICAS EN TIEMPO REAL (SOLO ADMIN)
    let bloqueMétricasAdmin = "";
    if (esAdmin) {
      const costo = f.costo || 0;
      const venta = f.venta || 0;
      const gananciaPesos = venta - costo;
      const porcentajeMargen = costo > 0 ? Math.round((gananciaPesos / costo) * 100) : 0;

      bloqueMétricasAdmin = `
        <p style="font-size: 14px; color: #43a047; font-weight: 600; margin: 4px 0 12px 0;">
          📈 Ganancia: $${gananciaPesos} (${porcentajeMargen}%)
        </p>
      `;
    }

    let bloqueAcciones = esAdmin ? `
        <div style="margin-top: 15px; display: flex; gap: 5px;">
          <button onclick="abrirEditarFunda('${f.id}')" style="flex:1;">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30; flex:1;">🗑️ Eliminar</button>
        </div>` : `
        <div style="margin-top: 20px;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #25D366; color: white; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 12px; border-radius: 12px; border:none; cursor:pointer;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="20" height="20" alt="WA"> Reservar
          </button>
        </div>`;

    html += `
    <div class="card" data-id="${f.id}" style="position: relative;">
      ${esAdmin ? `<div class="drag-handle" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 10; font-size: 14px;">☰</div>` : ''}
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        
        ${bloqueStockHTML}

        <p style="font-size: 17px; color:#0071e3; font-weight:700; margin-bottom: 2px;">💰 Precio: $${f.venta ?? 0}</p>
        
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
