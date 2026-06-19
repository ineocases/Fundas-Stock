import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB:", db);

document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

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

function mostrarFormulario() {
  const formAgregar = document.getElementById("agregar");
  // Alterna entre mostrar y ocultar el formulario
  if (formAgregar.style.display === "none") {
    formAgregar.style.display = "block";
  } else {
    formAgregar.style.display = "none";
  }
}

async function cargarFundas() {
  const snapshot = await getDocs(collection(db, "fundas"));
  let html = "";

  snapshot.forEach((doc) => {
    const f = doc.data();
    
    // Nos aseguramos de que compatibles se una con el punto
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

async function guardarFunda() {
  console.log("DB antes de guardar:", db);

  try {
    await addDoc(collection(db, "fundas"), {
      nombre: document.getElementById("nombre").value,
      stock: Number(document.getElementById("stock").value),
      // El map(item => item.trim()) quita los espacios extra si escribes "11, 12, 13"
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
