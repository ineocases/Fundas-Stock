import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
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

// Variables globales
let todasLasFundas = [];
let idFundaEditando = null;
let fotoBase64 = ""; // Variable global para almacenar el texto comprimido de la imagen

// Asignación de eventos de la interfaz
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;
document.getElementById("buscar").addEventListener("input", filtrarFundas);
document.getElementById("btnAsistente").onclick = mostrarAsistente;
document.getElementById("btnRegistrarVenta").onclick = procesarVentaAsistente;

// NUEVO: Capturar y procesar imagen a 1000x1000 automáticamente
document.getElementById("fotoInput").onchange = procesarImagen;

// OBSERVADOR DE SESIÓN
onAuthStateChanged(auth, (user) => {
  document.getElementById("cargando").style.display = "none";
  if (user) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    cargarFundas(); 
  } else {
    document.getElementById("login").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Error al ingresar: Verifique su email y contraseña.");
    console.error(error);
  }
}

function mostrarFormulario() {
  idFundaEditando = null;
  fotoBase64 = ""; // Limpiar foto
  document.getElementById("modalTitulo").innerText = "➕ Nueva Funda";
  document.getElementById("guardarFunda").innerText = "Guardar";
  
  document.getElementById("nombre").value = "";
  document.getElementById("stockPorModelo").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("venta").value = "";
  document.getElementById("fotoInput").value = "";
  
  // Ocultar preview
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
  document.getElementById("asistenteProducto").value = "";
  document.getElementById("asistenteModelo").value = "";
  document.getElementById("asistenteUnidades").value = "1";
  document.getElementById("modalAsistente").style.display = "flex";
}

function ocultarAsistente() {
  document.getElementById("modalAsistente").style.display = "none";
}

// NUEVA FUNCIÓN: Redimensiona y recorta fotos a 1000x1000 sin perder calidad en Base64
function procesarImagen(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");

      // Calcular recorte estilo 'object-fit: cover' para que quede cuadrado perfecto
      const ladoMenor = Math.min(img.width, img.height);
      const sx = (img.width - ladoMenor) / 2;
      const sy = (img.height - ladoMenor) / 2;

      // Dibujar en el canvas forzando las dimensiones 1000x1000
      ctx.drawImage(img, sx, sy, ladoMenor, ladoMenor, 0, 0, 1000, 1000);

      // Convertir a texto comprimido JPEG al 70% de calidad (Excelente peso/estética)
      fotoBase64 = canvas.toDataURL("image/jpeg", 0.7);

      // Mostrar vista previa en el modal
      const preview = document.getElementById("previewFoto");
      preview.src = fotoBase64;
      preview.style.display = "block";
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
  const nombresUnicos = [...new Set(todasLasFundas.map(f => f.nombre).filter(Boolean))];
  datalist.innerHTML = nombresUnicos.map(nombre => `<option value="${nombre}"></option>`).join("");
}

async function guardarFunda() {
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
    foto: fotoBase64 // Guardamos la foto procesada
  };

  try {
    if (idFundaEditando) {
      // Si estamos editando y no se subió una foto nueva, mantenemos la que ya tenía
      if (!fotoBase64) {
        const vieja = todasLasFundas.find(f => f.id === idFundaEditando);
        datosFunda.foto = vieja ? (vieja.foto || "") : "";
      }
      await updateDoc(doc(db, "fundas", idFundaEditando), datosFunda);
      alert("Funda actualizada con éxito");
    } else {
      await addDoc(collection(db, "fundas"), datosFunda);
      alert("Funda guardada con éxito");
    }

    ocultarFormulario();
    cargarFundas();
  } catch (error) {
    console.error("Error al guardar:", error);
  }
}

async function eliminarFunda(id) {
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
  const funda = todasLasFundas.find(f => f.id === id);
  if (!funda) return;

  idFundaEditando = id;
  document.getElementById("modalTitulo").innerText = "✏️ Editar Funda";

  document.getElementById("nombre").value = funda.nombre || "";
  document.getElementById("costo").value = funda.costo ?? 0;
  document.getElementById("venta").value = funda.venta ?? 0;
  document.getElementById("fotoInput").value = "";

  if (Array.isArray(funda.stockPorModelo)) {
    document.getElementById("stockPorModelo").value = funda.stockPorModelo
      .map(m => `${m.modelo}:${m.stock}`)
      .join(", ");
  } else {
    const comps = Array.isArray(funda.compatibles) ? funda.compatibles.join(", ") : (funda.compatibles || "");
    document.getElementById("stockPorModelo").value = comps;
  }

  // Cargar foto si ya existe una asignada
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
  } else {
    // Modo compatible viejo
    const stockActualViejo = fundaEncontrada.stock ?? 0;
    if (stockActualViejo < unidadesAVender) {
      alert(`¡Stock insuficiente!`);
      return;
    }
    try {
      await updateDoc(doc(db, "fundas", fundaEncontrada.id), {
        stock: stockActualViejo - unidadesAVender
      });
      alert(`¡Venta registrada!`);
      ocultarAsistente();
      cargarFundas();
    } catch (error) {
      console.error(error);
    }
  }
}

// Vinculaciones globales
window.eliminarFunda = eliminarFunda;
window.abrirEditarFunda = abrirEditarFunda;
window.ocultarFormulario = ocultarFormulario;
window.ocultarAsistente = ocultarAsistente;

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

    // Si el producto no tiene foto, usamos una por defecto limpia y minimalista
    const imagenUrl = f.foto || "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60";

    html += `
    <div class="card">
      <img src="${imagenUrl}" alt="${f.nombre}" class="card-img">
      <div class="card-body">
        <h2>${f.nombre || "Sin nombre"}</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">📦 <b>Stock Total: ${totalStock} u.</b></p>
        
        <div style="margin: 10px 0 15px 5px; font-size: 14px; color: #515154; line-height: 1.5;">
          ${listaModelosHTML}
        </div>

        <p>💵 Costo: $${f.costo ?? 0}</p>
        <p>💰 Venta: $${f.venta ?? 0}</p>
        <div style="margin-top: 15px;">
          <button onclick="abrirEditarFunda('${f.id}')">✏️ Editar</button>
          <button onclick="eliminarFunda('${f.id}')" style="background:#ff3b30">🗑️ Eliminar</button>
        </div>
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
    } else if (Array.isArray(f.compatibles)) {
      compatibleCoincide = f.compatibles.some((modelo) => 
        String(modelo).toLowerCase().trim().includes(textoBuscado)
      );
    } else if (typeof f.compatibles === "string") {
      compatibleCoincide = f.compatibles.toLowerCase().includes(textoBuscado);
    }
    return nombreCoincide || compatibleCoincide;
  });
  renderizarFundas(fundasFiltradas);
}
