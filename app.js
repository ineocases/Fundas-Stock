import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB:", db);

// 1. Variable global para guardar las fundas en memoria y optimizar búsquedas
let todasLasFundas = [];

// Asignamos los eventos a los botones
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

// 2. Evento para el buscador en tiempo real
document.getElementById("buscar").addEventListener("input", (e) => {
  const textoBuscado = e.target.value.toLowerCase();
  
  // Filtramos la lista guardada en memoria
  const fundasFiltradas = todasLasFundas.filter((funda) => {
    const nombreFunda = funda.nombre.toLowerCase();
    
    // Convertimos los compatibles a texto
    const modelosCompatibles = Array.isArray(funda.compatibles) 
      ? funda.compatibles.join(" ").toLowerCase() 
      : "";
    
    // Si coincide con el nombre o algún modelo compatible
    return nombreFunda.includes(textoBuscado) || modelosCompatibles.includes(textoBuscado);
  });

  // Renderizamos solo las que cumplen la condición
  renderizarFundas(fundasFiltradas);
});

// 3. Función de Login
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    cargarFundas();
  } catch (error) {
    alert("Error al iniciar sesión. Revisa tus datos.");
    console.error(error);
  }
}

// 4. Mostrar/Ocultar el formulario
function mostrarFormulario() {
  const formAgregar = document.getElementById("agregar");
  if (formAgregar.style.display === "none") {
    formAgregar.style.display = "block";
  } else {
    formAgregar.style.display = "none";
  }
}

// 5. Cargar fundas desde Firebase
async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  todasLasFundas = []; // Vaciamos la lista por si estamos recargando

  snapshot.forEach((doc) => {
    // Agregamos el ID del documento y sus datos al array
    todasLasFundas.push({ id: doc.id, ...doc.data() });
  });

  // Mandamos a dibujar las tarjetas a la pantalla
  renderizarFundas(todasLasFundas);
}

// 6. Generar el HTML de las tarjetas
function renderizarFundas(arregloDeFundas) {
  let html = "";

  arregloDeFundas.forEach((f) => {
    const compatiblesStr = Array.isArray(f.compatibles) ? f.compatibles.join(" • ") : f.compatibles;

    html += `
      <div class="card">
        <h3>${f.nombre}</h3>
        
        <div class="card-details">
          <p>📦 Stock: <strong>${f.stock}</strong></p>
          <p>📱 ${compatiblesStr}</p>
          <p>💵 Costo: $${f.costo}</p>
          <p>💰 Venta: $${f.venta}</p>
        </div>

        <div class="card-actions">
          <button class="btn-action">🛒 Vender</button>
          <button class="btn-action">✏️ Editar</button>
          <button class="btn-action">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  });

  document.getElementById("fundas").innerHTML = html;
}

// 7. Guardar una nueva funda en Firebase
async function guardarFunda() {
  try {
    await addDoc(collection(db, "fundas"), {
      nombre: document.getElementById("nombre").value,
      stock: Number(document.getElementById("stock").value),
      // Separa por comas y quita espacios en blanco extra
      compatibles: document.getElementById("compatibles").value.split(",").map(item => item.trim()),
      costo: Number(document.getElementById("costo").value),
      venta: Number(document.getElementById("venta").value),
      foto: ""
    });

    alert("¡Funda guardada exitosamente!");
    
    // Limpiamos los inputs
    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("compatibles").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("venta").value = "";

    // Ocultamos el formulario y recargamos la lista
    document.getElementById("agregar").style.display = "none";
    cargarFundas();

  } catch (error) {
    alert("Hubo un error al guardar.");
    console.error(error);
  }
}
