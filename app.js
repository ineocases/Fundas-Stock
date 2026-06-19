import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously
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

// 📱 TU NÚMERO CONFIGURADO NATIVAMENTE
const NUMERO_WHATSAPP = "5491170089123"; 

// Variables globales de la app
let todasLasFundas = [];
let idFundaEditando = null;
let fotoBase64 = ""; 
let esAdmin = false; 
let fundaReservando = null; 

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

// OBSERVADOR DE SESIÓN (Control de Roles Automático)
onAuthStateChanged(auth, (user) => {
  document.getElementById("cargando").style.display = "none";
  if (user) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    
    esAdmin = !user.isAnonymous;
    
    if (esAdmin) {
      document.getElementById("btnNuevaFunda").style.display = "inline-block";
      document.getElementById("btnAsistente").style.display = "flex";
    } else {
      document.getElementById("btnNuevaFunda").style.display = "none";
      document.getElementById("btnAsistente").style.display = "none";
    }
    
    cargarFundas(); 
  } else {
    document.getElementById("login").style.display = "block";
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
    alert("Error al ingresar en modo cliente. Activa el acceso Anónimo en Firebase.");
    console.error(error);
  }
}

// LOGICA INTEGRADA DEL MENÚ DE RESERVA PARA WHATSAPP
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
      selectModelo.innerHTML = `<option value="">⚠️ Sin stock de ningún modelo</option>`;
      document.getElementById("btnConfirmarWhatsApp").disabled = true;
    } else {
      document.getElementById("btnConfirmarWhatsApp").disabled = false;
      modelosDisponibles.forEach(m => {
        const option = document.createElement("option");
        option.value = m.modelo;
        option.innerText = `iPhone ${m.modelo} (${m.stock} disponibles)`;
        selectModelo.appendChild(option);
      });
    }
  } else {
    selectModelo.innerHTML = `<option value="Estándar">Modelo Único</option>`;
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
  if (!modeloSeleccionado) {
    alert("Por favor, selecciona un modelo válido.");
    return;
  }

  const mensaje = `Hola IneoCases! 👋 Me gustaría reservar el siguiente producto:\n\n` +
                  `📱 *Funda:* ${fundaReservando.nombre}\n` +
                  `⚙️ *Modelo:* iPhone ${modeloSeleccionado}\n` +
                  `💰 *Precio:* $${fundaReservando.venta}\n\n` +
                  `¿Me confirman si puedo pasar a retirar? ¡Muchas gracias!`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
  cerrarModalReservar();
}

function mostrarFormulario() {
  if (!esAdmin) return;
  idFundaEditando = null;
  fotoBase64 = ""; 
  document.getElementById("modalTitulo").innerText = "➕ Nueva Funda";
  document.getElementById("guardarFunda").innerText = "Guardar";
  document.getElementById("guardarFunda").disabled = false;
  
  document.getElementById("nombre").value = "";
  document.getElementById("stockPorModelo").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("fotoInput").value = "";
  
  const preview = document.getElementById("previewFoto");
  preview.src = "";
  preview.style.display = "none";
  
  document.getElementById("agregar").style.display = "flex";
}

function ocultarFormulario() {
  idFundaEditando = null;
  fotoBase64 = "";
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

  const btnGuardar = document.getElementById("guardarFunda");
  btnGuardar.disabled = true;
  btnGuardar.innerText = "⏳ Procesando foto...";

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
      btnGuardar.innerText = idFundaEditando ? "Actualizar Funda" : "Guardar";
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
    renderizarFundas(todasLasFundas);
  } catch (error) {
    console.error("Error al cargar fundas:", error);
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
  btnGuardar.innerText = "💾 Guardando...";

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
    foto: fotoBase64 
  };

  try {
    if (idFundaEditando) {
      if (!fotoBase64) {
        const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
        datosFunda.foto = vieja ? (vieja.foto || "") : "";
      }
      await updateDoc(doc(db, "fundas", idFundaEditando), datosFunda);
      alert("Funda actualizada con éxito 🎉");
    } else {
      await addDoc(collection(db, "fundas"), datosFunda);
      alert("Funda guardada con éxito 🎉");
    }

    ocultarFormulario();
    cargarFundas();
  } catch (error) {
    console.error("Error al guardar:", error);
  } finally {
    btnGuardar.disabled = false;
  }
}

async function eliminarFunda(id) {
  if (!esAdmin) return;
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
  if (!esAdmin) return;
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  idFundaEditando = id;
  document.getElementById("modalTitulo").innerText = "✏️ Editar Funda";
  document.getElementById("guardarFunda").disabled = false;

  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;
  document.getElementById("fotoInput").value = "";

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
    preview.src = "";
    preview.style.display = "none";
  }

  document.getElementById("guardarFunda").innerText = "Actualizar Funda";
  document.getElementById("agregar").style.display = "flex";
}

async function procesarVentaAsistente() {
  if (!esAdmin) return;
  const prodBuscado = document.getElementById("asistenteProducto").value.trim().toLowerCase();
  const modeloBuscado = document.getElementById("asistenteModelo").value.trim().toLowerCase();
  const unidadesAVender = Number(document.getElementById("asistenteUnidades").value);

  if (!prodBuscado || !modeloBuscado || unidadesAVender <= 0) {
    alert("Por favor, rellene todos los campos con valores válidos.");
    return;
  }

  const fundaEncontrada = todasLasFundas.find(f => f.nombre && f.nombre.toLowerCase() === prodBuscado);

  if (!fundaEncontrada) {
    alert("No se encontró ningún producto con ese nombre exacto.");
    return;
  }

  if (Array.isArray(fundaEncontrada.stockPorModelo)) {
    const modeloStock = fundaEncontrada.stockPorModelo.find(m => m.modelo.toLowerCase().trim() === modeloBuscado);
    
    if (!modeloStock) {
      alert(`No hay registrado stock para iPhone "${modeloBuscado}".`);
      return;
    }

    if (modeloStock.stock < unidadesAVender) {
      alert(`¡Stock insuficiente! Quedan ${modeloStock.stock} unidades.`);
      return;
    }

    modeloStock.stock -= unidadesAVender;

    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), {
        stockPorModelo: fundaEncontrada.stockPorModelo
      });
      alert(`¡Venta registrada con éxito!`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) {
      console.error(error);
    }
  }
}

// Inyección de variables en scope global de eventos HTML
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
        .map(m => `• iPhone ${m.modelo}: <b>${m.stock} u.</b>`)
        .join("<br>");
    } else {
      totalStock = f.stock ?? 0;
      const comps = Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : String(f.compatibles || "");
      listaModelosHTML = `• Compatibles: ${comps}`;
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-4.846c1.66.986 3.296 1.489 5.273 1.49 5.373 0 9.744-4.373 9.747-9.747.002-2.585-1.004-5.014-2.835-6.845-1.83-1.83-4.26-2.834-6.845-2.834-5.383 0-9.754 4.373-9.758 9.749-.001 1.981.504 3.626 1.503 5.29L2.525 21.45l4.122-1.296zm12.393-5.593c-.33-.165-1.951-.963-2.251-1.073-.3-.109-.518-.165-.736.165-.218.329-.846 1.073-1.037 1.292-.19.218-.382.245-.712.08-1.121-.56-2.125-1.28-3.04-2.133-.746-.692-1.348-1.523-1.742-2.452-.19-.329-.02-.507.145-.671.149-.147.33-.384.495-.577.165-.191.22-.329.33-.548.11-.219.055-.411-.028-.577-.082-.165-.736-1.774-1.009-2.433-.266-.643-.538-.553-.736-.563-.19-.01-.409-.01-.628-.01-.218 0-.573.082-.873.411-.3.33-1.146 1.122-1.146 2.738 0 1.617 1.175 3.178 1.339 3.397.165.22 2.313 3.532 5.6 4.951.783.339 1.396.541 1.873.693.787.251 1.5.216 2.065.132.63-.094 1.951-.797 2.224-1.527.273-.731.273-1.356.191-1.488-.081-.13-.297-.213-.627-.378z"/>
            </svg>
            Reservar
          </button>
        </div>
      `;
    }

    html += `
    <div class="card">
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
    }
    return nombreCoincide || compatibleCoincide;
  });
  renderizarFundas(fundasFiltradas);
}
