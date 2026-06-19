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

// Asignación de eventos de la interfaz
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
    if (esAdmin) {
      btnCambiarRol.innerHTML = "📱 Cambiar a Cliente";
      document.getElementById("btnNuevaFunda").style.display = "inline-block";
      document.getElementById("btnAsistente").style.display = "flex";
    } else {
      btnCambiarRol.innerHTML = "🔐 Cambiar a Admin";
      document.getElementById("btnNuevaFunda").style.display = "none";
      document.getElementById("btnAsistente").style.display = "none";
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

// 📂 GESTIÓN Y CARGA DE CATEGORÍAS (FIRESTORE)
async function cargarCategorias() {
  try {
    const snapshot = await getDocs(collection(db, "categorias"));
    let lista = [];
    snapshot.forEach(doc => {
      lista.push(doc.data().nombre);
    });

    // ✨ CATEGORÍAS COMERCIALES SOLICITADAS
    if (lista.length === 0) {
      const predeterminadas = ["Fundas", "Auriculares", "Cargadores", "Hidrogel", "Protectores"];
      for (const cat of predeterminadas) {
        await addDoc(collection(db, "categorias"), { nombre: cat });
        lista.push(cat);
      }
    }
    
    listaCategorias = lista;
    renderizarPildorasCategorias();
    actualizarSelectFormulario();
  } catch (error) {
    console.error("Error al cargar categorías:", error);
  }
}

function renderizarPildorasCategorias() {
  const contenedor = document.getElementById("filtrosCategorias");
  if (!contenedor) return;

  let html = `<div class="categoria-pill ${categoriaSeleccionadaFiltro === 'Todas' ? 'active' : ''}" data-cat="Todas">Todas</div>`;
  
  listaCategorias.forEach(cat => {
    html += `<div class="categoria-pill ${categoriaSeleccionadaFiltro === cat ? 'active' : ''}" data-cat="${cat}">${cat}</div>`;
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
  select.innerHTML = listaCategorias.map(cat => `<option value="${cat}">${cat}</option>`).join("");
}

// 🚀 ENVIAR FOTO A REMOVE.BG Y CONFIGURAR INTERFAZ EN VIVO
async function procesarImagenPro() {
  const fileInput = document.getElementById("fotoInput");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Por favor, selecciona un archivo primero.");
    return;
  }

  const btnCrear = document.getElementById("btnCrearFoto");
  btnCrear.disabled = true;
  btnCrear.innerText = "🚀 Recortando con Remove.bg...";

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
    btnCrear.innerText = "Crear foto Pro";
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

  if (Array.isArray(funda.stockPorModelo)) {
    const modelosDisponibles = funda.stockPorModelo.filter(m => m.stock > 0);

    if (modelosDisponibles.length === 0) {
      selectModelo.innerHTML = `<option value="">⚠️ Sin stock disponible</option>`;
      document.getElementById("btnConfirmarWhatsApp").disabled = true;
    } else {
      document.getElementById("btnConfirmarWhatsApp").disabled = false;
      modelosDisponibles.forEach(m => {
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

  const mensaje = `Hola IneoCases! 👋 Me gustaría reservar:\n\n` +
                  `📦 *Producto:* ${fundaReservando.nombre}\n` +
                  `⚙️ *Variante/Modelo:* ${modeloSeleccionado}\n` +
                  `💰 *Precio:* $${fundaReservando.venta}\n\n` +
                  `¿Tienen disponibilidad para coordinar? ¡Gracias!`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
  cerrarModalReservar();
}

function mostrarFormulario() {
  if (!esAdmin) return;
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

async function cargarFundas() {
  try {
    const snapshot = await getDocs(collection(db, "fundas"));
    todasLasFundas = []; 
    snapshot.forEach((doc) => {
      todasLasFundas.push({ id: doc.id, ...doc.data() });
    });
    actualizarDatalistAsistente();
    filtrarFundas();
  } catch (error) {
    console.error(error);
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
  document.getElementById("categoriaSelect").value = funda.categoria || listaCategorias[0];
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

window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente;
window.abrirModalReservar = abrirModalReservar;
window.cerrarModalReservar = cerrarModalReservar;

function renderizarFundas(arrayDeFundas) {
  let html = "";
  arrayDeFundas.forEach((f) => {
    let listaModelosHTML = "";
    let totalStock = 0;

    if (Array.isArray(f.stockPorModelo)) {
      totalStock = f.stockPorModelo.reduce((acc, item) => acc + item.stock, 0);
      listaModelosHTML = f.stockPorModelo
        .map(m => `• ${m.modelo}: <b>${m.stock} u.</b>`)
        .join("<br>");
    }

    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60";
    let bloqueAcciones = "";
    
    if (esAdmin) {
      bloqueAcciones = `
        <p style="margin-top:8px; color:#1d1d1f;">💵 Costo: <b>$${f.costo ?? 0}</b></p>
        <div style="margin-top: 15px;">
          <button onclick="abrirEditarFunda('${f.id}')">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30">🗑️ Eliminar</button>
        </div>
      `;
    } else {
      bloqueAcciones = `
        <div style="margin-top: 20px;">
          <button onclick="abrirModalReservar('${f.id}')" style="background: #25D366; color: white; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; padding: 12px;">
            Reservar Artículo
          </button>
        </div>
      `;
    }

    html += `
    <div class="card">
      <div class="badge-categoria">${f.categoria || "Fundas"}</div>
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock Total: ${totalStock} u.</b></p>
        
        <div style="margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5;">
          ${listaModelosHTML}
        </div>

        <p style="font-size: 17px; color:#0071e3; font-weight:700;">💰 Precio: $${f.venta ?? 0}</p>
        ${bloqueAcciones}
      </div>
    </div>
    `;
  });
  document.getElementById("fundas").innerHTML = html;
}

function filtrarFundas() {
  const textoBuscado = document.getElementById("buscar").value.toLowerCase().trim();
  
  const fundasFiltradas = todasLasFundas.filter((f) => {
    if (categoriaSeleccionadaFiltro !== "Todas") {
      if (f.categoria !== categoriaSeleccionadaFiltro) return false;
    }

    const nombreFunda = f.nombre ? f.nombre.toLowerCase() : "";
    const nombreCoincide = nombreFunda.includes(textoBuscado);
    
    let compatibleCoincide = false;
    if (Array.isArray(f.stockPorModelo)) {
      compatibleCoincide = f.stockPorModelo.some((m) => 
        String(m.modelo).toLowerCase().trim().includes(textoBuscado)
      );
    }
    
    return nombreCoincide || compatibleCoincide;
  });
  
  renderizarFundas(fundasFiltradas);
}
