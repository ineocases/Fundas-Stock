import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  writeBatch,
  getDoc      
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("Panel Admin conectado con éxito a Firestore.");

const REMOVE_BG_API_KEY = "zyLqt5m3r5FLcahT49QKDwK1"; 
const IMGBB_API_KEY = "3c78e7313902208295c2b09b745a9b94";

// Variables de estado del Admin
let todasLasFundas = [];
let listaCategorias = []; 
let categoriaSeleccionadaFiltro = "Todas"; 
let idFundaEditando = null;
let fotoBase64 = ""; 
let sortableInstance = null; 
let esProductoSinModelo = false; 

// Variables Foto Pro Editor
let imagenOriginalTemporal = null; 
let imagenRecortadaTemporal = null; 
let fotoTransparenteBase64 = ""; 
let urlTransparenteGuardada = ""; 
let opacidadSombra = 0.35;
let tipoFondoElegido = "estudio"; 
let porcentajeEscala = 0.72; 
let rotacionGrados = 0;
let canvasPosX = 500;
let canvasPosY = 500;
let imgFondoEstudio = new Image();
imgFondoEstudio.src = "fondo-estudio.png";

document.addEventListener("DOMContentLoaded", () => {
  // Asignación completa de tus eventos de gestión
  if(document.getElementById("btnLogin")) document.getElementById("btnLogin").onclick = loginAdmin;
  if(document.getElementById("btnNuevaFunda")) document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
  if(document.getElementById("guardarFunda")) document.getElementById("guardarFunda").onclick = guardarFunda;
  if(document.getElementById("buscar")) document.getElementById("buscar").addEventListener("input", filtrarFundas);
  if(document.getElementById("btnAsistente")) document.getElementById("btnAsistente").onclick = mostrarAsistente;
  if(document.getElementById("btnRegistrarVenta")) document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;
  if(document.getElementById("fotoInput")) document.getElementById("fotoInput").onchange = procesarImagen;
  if(document.getElementById("btnMenuHamburguesa")) document.getElementById("btnMenuHamburguesa").onclick = toggleSidebar;
  if(document.getElementById("sidebarOverlay")) document.getElementById("sidebarOverlay").onclick = toggleSidebar;
  
  if(document.getElementById("btnCambiarRol")) {
    document.getElementById("btnCambiarRol").onclick = async () => {
      await signOut(auth);
      window.location.href = "index.html";
    };
  }

  if(document.getElementById("btnToggleModelo")) document.getElementById("btnToggleModelo").onclick = toggleModoModelo;
  if(document.getElementById("btnGestorCategorias")) document.getElementById("btnGestorCategorias").onclick = abrirModalCategorias;
  if(document.getElementById("btnCerrarCategorias")) document.getElementById("btnCerrarCategorias").onclick = cerrarModalCategorias;
  if(document.getElementById("btnGuardarCategoria")) document.getElementById("btnGuardarCategoria").onclick = crearNuevaCategoria;
  if(document.getElementById("btnImportarExcel")) document.getElementById("btnImportarExcel").onclick = () => document.getElementById("inputExcel").click();
  if(document.getElementById("inputExcel")) document.getElementById("inputExcel").onchange = procesarImportacionExcel;
  if(document.getElementById("btnAccionesIA")) document.getElementById("btnAccionesIA").onclick = toggleMenuMenuIA;
  
  if(document.getElementById("btnMenuFormatear")) {
    document.getElementById("btnMenuFormatear").onclick = () => {
      document.getElementById("menuAccionesIA").style.display = "none";
      toggleFormateador();
    };
  }
  if(document.getElementById("btnProcesarStock")) document.getElementById("btnProcesarStock").onclick = procesarTextoStock;
  if(document.getElementById("btnVerClientes")) document.getElementById("btnVerClientes").onclick = cargarVistaClientes;
  if(document.getElementById("btnCerrarClientes")) document.getElementById("btnCerrarClientes").onclick = () => {
      document.getElementById("pantallaClientes").style.display = "none";
      document.getElementById("fundas").style.display = "grid"; 
  };

  // Eventos Foto Pro
  if(document.getElementById("btnCrearFoto")) { document.getElementById("btnCrearFoto").onclick = () => { document.getElementById("menuAccionesIA").style.display = "none"; abrirEditorFotoPro(); }; }
  if(document.getElementById("btnCerrarFotoPro")) document.getElementById("btnCerrarFotoPro").onclick = cerrarEditorFotoPro;
  if(document.getElementById("btnBorrarFondo")) document.getElementById("btnBorrarFondo").onclick = ejecutarBorradoFondoIA;
  if(document.getElementById("btnReEditar")) document.getElementById("btnReEditar").onclick = reEditarMontaje;
  if(document.getElementById("selectFondoPro")) document.getElementById("selectFondoPro").onchange = (e) => { tipoFondoElegido = e.target.value; dibujarCanvasGestos(); };
  if(document.getElementById("sliderSombra")) { document.getElementById("sliderSombra").oninput = (e) => { opacidadSombra = e.target.value / 100; document.getElementById("valorSombra").innerText = e.target.value + "%"; dibujarCanvasGestos(); }; }
  if(document.getElementById("sliderRotacion")) { document.getElementById("sliderRotacion").oninput = (e) => { rotacionGrados = parseFloat(e.target.value); document.getElementById("valorRotacion").innerText = e.target.value + "°"; dibujarCanvasGestos(); }; }
  if(document.getElementById("btnGuardarFotoPro")) document.getElementById("btnGuardarFotoPro").onclick = aplicarMontajeFinal;

  configurarGestosCanvas();
});

function toggleSidebar() {
  const menu = document.getElementById("sidebarMenu");
  const overlay = document.getElementById("sidebarOverlay");
  if(menu) menu.classList.toggle("active");
  if(overlay) overlay.classList.toggle("active");
}

async function loginAdmin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { alert("Error de credenciales de Administrador."); }
}

onAuthStateChanged(auth, async (user) => {
  if (user && !user.isAnonymous) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    await cargarCategorias();
    await cargarFundas();
  } else {
    document.getElementById("login").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

// --- ENTORNO CRUD Y METRICAS ADMIN ---
async function cargarCategorias() {
  const snapshot = await getDocs(collection(db, "categorias"));
  listaCategorias = []; snapshot.forEach(doc => { listaCategorias.push({ id: doc.id, nombre: doc.data().nombre }); });
  renderizarPildorasCategorias();
  actualizarSelectFormulario();
  renderizarListaCrudCategorias();
}

function renderizarPildorasCategorias() {
  const contenedor = document.getElementById("filtrosCategorias");
  if (!contenedor) return;
  let html = `<div class="categoria-pill ${categoriaSeleccionadaFiltro === 'Todas' ? 'active' : ''}" data-cat="Todas">Todas</div>`;
  listaCategorias.forEach(cat => { html += `<div class="categoria-pill ${categoriaSeleccionadaFiltro === cat.nombre ? 'active' : ''}" data-cat="${cat.nombre}">${cat.nombre}</div>`; });
  contenedor.innerHTML = html;
  contenedor.querySelectorAll(".categoria-pill").forEach(pill => {
    pill.onclick = function() {
      categoriaSeleccionadaFiltro = this.getAttribute("data-cat");
      filtrarFundas();
    };
  });
}

function actualizarSelectFormulario() {
  const select = document.getElementById("categoriaSelect");
  if (select) select.innerHTML = listaCategorias.map(cat => `<option value="${cat.nombre}">${cat.nombre}</option>`).join("");
}

function renderizarListaCrudCategorias() {
  const contenedor = document.getElementById("listaCategoriasCrud");
  if (!contenedor) return;
  let html = "";
  listaCategorias.forEach(cat => { html += `<div class="item-crud-categoria"><span>${cat.nombre}</span><button class="btn-eliminar-cat" data-id="${cat.id}" data-nombre="${cat.nombre}">🗑️</button></div>`; });
  contenedor.innerHTML = html || "<p>Sin categorías.</p>";
  contenedor.querySelectorAll(".btn-eliminar-cat").forEach(btn => { btn.onclick = function() { eliminarCategoria(this.getAttribute("data-id"), this.getAttribute("data-nombre")); }; });
}

async function crearNuevaCategoria() {
  const input = document.getElementById("nuevoNombreCategoria");
  if (!input.value.trim()) return;
  await addDoc(collection(db, "categorias"), { nombre: input.value.trim() });
  input.value = ""; await cargarCategorias();
}

async function eliminarCategoria(id, nombre) {
  if (confirm(`¿Eliminar categoría "${nombre}"?`)) { await deleteDoc(doc(db, "categorias", id)); await cargarCategorias(); }
}

async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  todasLasFundas = []; snapshot.forEach((doc) => { todasLasFundas.push({ id: doc.id, ...doc.data() }); });
  todasLasFundas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  actualizarDatalistAsistente();
  filtrarFundas();
}

function renderizarFundas(arrayDeFundas, textoBuscado = "") {
  const contenedor = document.getElementById("fundas");
  let html = "";

  arrayDeFundas.forEach((f) => {
    const modelosTotales = f.stockPorModelo || [];
    const modelosFiltrados = (textoBuscado !== "") ? modelosTotales.filter(m => m.modelo.toLowerCase().includes(textoBuscado)) : modelosTotales;
    const totalStock = modelosTotales.reduce((acc, item) => acc + item.stock, 0);
    const listaModelosHTML = modelosFiltrados.map(m => `• ${m.modelo}: <b>${m.stock} u.</b>`).join("<br>");
    
    const costo = f.costo || 0; const venta = f.venta || 0;
    const ganancia = venta - costo;
    const margen = costo > 0 ? Math.round((ganancia / costo) * 100) : 0;

    html += `
    <div class="card" data-id="${f.id}" style="position: relative;">
      <div class="drag-handle" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 10;">☰</div>
      <div class="badge-categoria">${f.categoria || "Varios"}</div>
      <img src="${f.foto || ''}" class="card-img" loading="lazy">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        <p>Stock: ${totalStock} u.</p>
        <div class="stock-list" style="display:block; font-size: 13px; color:#515154;">${listaModelosHTML}</div>
        <p>$${venta}</p>
        <p style="color: #43a047; font-weight: bold; font-size:13px;">📈 Ganancia: $${ganancia} (${margen}%)</p>
        <div style="margin-top: 15px; display: flex; gap: 5px;">
          <button onclick="abrirEditarFunda('${f.id}')" style="flex:1;">✏️ Editar</button>
          <button onclick="window.eliminarFunda('${f.id}')" style="background:#ff3b30; flex:1;">🗑️ Eliminar</button>
        </div>
      </div>
    </div>`;
  });
  contenedor.innerHTML = html;
  if (textoBuscado === "" && categoriaSeleccionadaFiltro === "Todas") habilitarReordenamiento();
}

function filtrarFundas() {
  const txt = document.getElementById("buscar").value.toLowerCase().trim();
  const filtradas = todasLasFundas.filter(f => {
    if (categoriaSeleccionadaFiltro !== "Todas" && f.categoria !== categoriaSeleccionadaFiltro) return false;
    return (f.nombre || "").toLowerCase().includes(txt);
  });
  renderizarFundas(filtradas, txt);
}

function habilitarReordenamiento() {
  const contenedor = document.getElementById('fundas');
  if (!contenedor || !window.Sortable) return;
  if (sortableInstance) sortableInstance.destroy();
  sortableInstance = new Sortable(contenedor, {
    animation: 150, handle: '.drag-handle',
    onEnd: async () => {
      const tarjetas = document.querySelectorAll('#fundas .card');
      const batch = writeBatch(db);
      tarjetas.forEach((tarjeta, index) => { batch.update(doc(db, "fundas", tarjeta.dataset.id), { orden: index }); });
      await batch.commit();
    }
  });
}

// --- SUBIDA A IMGBB Y FORMULARIO DE PRODUCTOS ---
async function guardarFunda() {
  const btn = document.getElementById("guardarFunda");
  btn.disabled = true; btn.innerText = "⏳ Subiendo imágenes...";
  let urlImagenFinal = fotoBase64; let urlTransparenteFinal = urlTransparenteGuardada;

  const subirAImgBB = async (b64) => {
    const formData = new FormData(); formData.append("image", b64.split(',')[1]);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
    const data = await res.json(); return data.data.url;
  };

  try {
    if (fotoTransparenteBase64.startsWith("data:image")) urlTransparenteFinal = await subirAImgBB(fotoTransparenteBase64);
    if (fotoBase64.startsWith("data:image")) urlImagenFinal = await subirAImgBB(fotoBase64);
    
    let stockPorModeloArray = esProductoSinModelo 
      ? [{ modelo: "Único", stock: Number(document.getElementById("stockTotalSencillo").value) || 0 }]
      : document.getElementById("stockPorModelo").value.split(",").map(item => {
          const [m, c] = item.split(":");
          return { modelo: m ? m.trim() : "", stock: c ? Number(c.trim()) : 0 };
        }).filter(item => item.modelo !== "");

    const datos = {
      nombre: document.getElementById("nombre").value,
      categoria: document.getElementById("categoriaSelect").value,
      stockPorModelo: stockPorModeloArray,
      costo: Number(document.getElementById("costo").value),
      venta: Number(document.getElementById("venta").value),
      foto: urlImagenFinal, fotoTransparente: urlTransparenteFinal, sinModelo: esProductoSinModelo
    };

    if (idFundaEditando) {
      await updateDoc(doc(db, "fundas", idFundaEditando), datos);
    } else {
      datos.orden = todasLasFundas.length;
      await addDoc(collection(db, "fundas"), datos);
    }
    ocultarFormulario(); await cargarFundas();
  } catch (e) { console.error(e); alert("Error guardando producto."); }
  finally { btn.disabled = false; btn.innerText = "Guardar"; }
}

function abrirEditarFunda(id) {
  const f = todasLasFundas.find(item => item.id === id); if (!f) return;
  idFundaEditando = id; fotoBase64 = ""; fotoTransparenteBase64 = "";
  urlTransparenteGuardada = f.fotoTransparente || "";
  
  document.getElementById("modalTitulo").innerText = "✏️ Editar Artículo";
  document.getElementById("nombre").value = f.nombre || "";
  document.getElementById("categoriaSelect").value = f.categoria || "";
  document.getElementById("costo").value = f.costo || 0;
  document.getElementById("venta").value = f.venta || 0;
  
  esProductoSinModelo = !!f.sinModelo;
  if(esProductoSinModelo) {
    document.getElementById("stockTotalSencillo").value = f.stockPorModelo[0]?.stock || 0;
  } else {
    document.getElementById("stockPorModelo").value = f.stockPorModelo.map(m => `${m.modelo}:${m.stock}`).join(", ");
  }
  document.getElementById("previewFoto").src = f.foto || "";
  document.getElementById("previewFoto").style.display = "block";
  document.getElementById("agregar").style.display = "flex";
}

// --- LÓGICA DE HERRAMIENTAS EXCEL E IA STOCK ---
function procesarImportacionExcel(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheets = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    for (const row of sheets) {
      await addDoc(collection(db, "fundas"), {
        nombre: row.Nombre || "Sin nombre", categoria: row.Categoria || "Varios",
        costo: Number(row.Costo || 0), venta: Number(row.Venta || 0), stockPorModelo: [{ modelo: "Único", stock: Number(row.Stock || 0) }], orden: todasLasFundas.length
      });
    }
    alert("¡Importación masiva completada! 🎉"); await cargarFundas();
  };
  reader.readAsArrayBuffer(file);
}

function procesarTextoStock() {
  const raw = document.getElementById("textoCrudoStock").value;
  const lines = raw.split('\n'); const res = [];
  lines.forEach(l => {
    let s = l.trim(); if(!s) return;
    let c = 1; const m = s.match(/x\s*(\d+)$/i); if (m) { c = m[1]; s = s.replace(/x\s*\d+$/i, '').trim(); }
    res.push(`${s}:${c}`);
  });
  document.getElementById("stockPorModelo").value = res.join(', ');
  document.getElementById("cajaFormateador").style.display = "none";
}

// --- DISEÑO CANVAS FOTO PRO INTERACTIVA ---
function abrirEditorFotoPro() {
  if (!imagenOriginalTemporal) return alert("Subí una foto base primero.");
  document.getElementById("modalFotoPro").style.display = "flex";
  dibujarCanvasGestos();
}
function cerrarEditorFotoPro() { document.getElementById("modalFotoPro").style.display = "none"; }

async function ejecutarBorradoFondoIA() {
  const file = document.getElementById("fotoInput").files[0]; if(!file) return;
  const btn = document.getElementById("btnBorrarFondo"); btn.innerText = "⏳ Borrando...";
  const fData = new FormData(); fData.append("image_file", file); fData.append("size", "auto");
  try {
    const res = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": REMOVE_BG_API_KEY }, body: fData });
    const blob = await res.blob(); const r = new FileReader();
    r.onloadend = () => {
      fotoTransparenteBase64 = r.result; imagenRecortadaTemporal = new Image();
      imagenRecortadaTemporal.onload = () => { dibujarCanvasGestos(); btn.innerText = "✨ Borrar Fondo"; };
      imagenRecortadaTemporal.src = fotoTransparenteBase64;
    };
    r.readAsDataURL(blob);
  } catch(err) { alert("Error con Remove.bg"); btn.innerText = "✨ Borrar Fondo"; }
}

function configurarGestosCanvas() {
  const canvas = document.getElementById("canvasGestos"); if (!canvas) return;
  let drag = false, sx = 0, sy = 0;
  canvas.onpointerdown = (e) => { drag = true; sx = e.clientX; sy = e.clientY; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointerup = (e) => { drag = false; canvas.releasePointerCapture(e.pointerId); };
  canvas.onpointermove = (e) => {
    if (!drag) return;
    canvasPosX += (e.clientX - sx) * 2; canvasPosY += (e.clientY - sy) * 2;
    sx = e.clientX; sy = e.clientY; dibujarCanvasGestos();
  };
  canvas.onwheel = (e) => { e.preventDefault(); porcentajeEscala += e.deltaY < 0 ? 0.05 : -0.05; dibujarCanvasGestos(); };
}

function dibujarCanvasGestos() {
  const cv = document.getElementById("canvasGestos"); if(!cv) return;
  const ctx = cv.getContext("2d"); let img = imagenRecortadaTemporal || imagenOriginalTemporal; if(!img) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (tipoFondoElegido === "estudio" && imgFondoEstudio.complete) ctx.drawImage(imgFondoEstudio, 0, 0, cv.width, cv.height);
  else { ctx.fillStyle = tipoFondoElegido === "blanco" ? "#ffffff" : "#f5f5f7"; ctx.fillRect(0,0,cv.width,cv.height); }
  ctx.save(); ctx.translate(canvasPosX, canvasPosY); ctx.rotate(rotacionGrados * Math.PI / 180);
  if (opacidadSombra > 0) { ctx.shadowColor = `rgba(0,0,0,${opacidadSombra})`; ctx.shadowBlur = 40; ctx.shadowOffsetX = 20; ctx.shadowOffsetY = 20; }
  const sc = Math.min((1000 * porcentajeEscala) / img.width, (1000 * porcentajeEscala) / img.height);
  ctx.drawImage(img, (-img.width * sc)/2, (-img.height * sc)/2, img.width*sc, img.height*sc); ctx.restore();
}

function aplicarMontajeFinal() {
  fotoBase64 = document.getElementById("canvasGestos").toDataURL("image/png");
  document.getElementById("previewFoto").src = fotoBase64; cerrarEditorFotoPro();
}

// --- RESTO DE FUNCIONES ACCESORIAS ---
function procesarImagen(e) {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader(); r.onload = (evt) => {
    const img = new Image(); img.onload = () => {
      imagenOriginalTemporal = img; const cv = document.createElement("canvas"); cv.width=500; cv.height=500;
      cv.getContext("2d").drawImage(img, 0,0,500,500); fotoBase64 = cv.toDataURL("image/jpeg", 0.7);
      document.getElementById("previewFoto").src = fotoBase64; document.getElementById("previewFoto").style.display="block";
    };
    img.src = evt.target.result;
  };
  r.readAsDataURL(f);
}

async function cargarVistaClientes() {
  const snap = await getDocs(collection(db, "clientes"));
  let html = `<table style="width:100%; background:white; border-radius:8px; overflow:hidden; padding:10px;">`;
  snap.forEach(d => { html += `<tr style="border-bottom:1px solid #eee;"><td style="padding:10px; font-weight:bold;">📱 ${d.data().telefono}</td><td>${d.data().nombres.join(" / ")}</td></tr>`; });
  document.getElementById("listaClientesRender").innerHTML = html + `</table>`;
  document.getElementById("fundas").style.display = "none"; document.getElementById("pantallaClientes").style.display = "block";
}

async function procesarVentaAsistente() {
  const prod = document.getElementById("asistenteProducto").value.trim().toLowerCase();
  const f = todasLasFundas.find(item => item.nombre?.toLowerCase() === prod);
  if(!f) return alert("No encontrado");
  f.stockPorModelo[0].stock -= Number(document.getElementById("asistenteUnidades").value);
  await updateDoc(doc(db, "fundas", f.id), { stockPorModelo: f.stockPorModelo });
  ocultarAsistente(); await cargarFundas();
}

function mostrarFormulario() { idFundaEditando=null; fotoBase64=""; document.getElementById("agregar").style.display="flex"; }
function ocultarFormulario() { document.getElementById("agregar").style.display="none"; }
function mostrarAsistente() { document.getElementById("modalAsistente").style.display="flex"; }
function ocultarAsistente() { document.getElementById("modalAsistente").style.display="none"; }
function toggleMenuMenuIA() { const m = document.getElementById("menuAccionesIA"); m.style.display = m.style.display === "block" ? "none" : "block"; }
function toggleFormateador() { const c = document.getElementById("cajaFormateador"); c.style.display = c.style.display === "block" ? "none" : "block"; }
function toggleModoModelo() { esProductoSinModelo = !esProductoSinModelo; document.getElementById("stockPorModelo").style.display = esProductoSinModelo ? "none" : "block"; document.getElementById("stockTotalSencillo").style.display = esProductoSinModelo ? "block" : "none"; }
function reEditarMontaje() { porcentajeEscala=0.72; rotacionGrados=0; canvasPosX=500; canvasPosY=500; dibujarCanvasGestos(); }
function actualizarDatalistAsistente() { document.getElementById("listaProductos").innerHTML = [...new Set(todasLasFundas.map(f => f.nombre).filter(Boolean))].map(n => `<option value="${n}"></option>`).join(""); }

window.eliminarFunda = async (id) => { if(confirm("¿Seguro?")) { await deleteDoc(doc(db, "fundas", id)); await cargarFundas(); } };
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente;
window.toggleStock = (btn, act) => { const s = btn.closest('.card').querySelector('.stock-list'); s.style.display = act === 'show' ? 'block' : 'none'; };
