import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("DB:", db);

document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

async function login() {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  await signInWithEmailAndPassword(auth, email, password);

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";

  cargarFundas();
}


function mostrarFormulario() {

  document.getElementById("agregar").style.display = "block";

}


async function cargarFundas() {

  const snapshot = await getDocs(collection(db, "fundas"));

  let html = "";

  snapshot.forEach((doc) => {

    const f = doc.data();

html += `

<div class="card">

<h2>${f.nombre}</h2>

<p>📦 Stock: ${f.stock}</p>

<p>📱 Compatibles: ${f.compatibles.join(" • ")}</p>

<p>💵 Costo: $${f.costo}</p>

<p>💰 Venta: $${f.venta}</p>

<button>🛒 Vender</button>

<button>✏️ Editar</button>

<button>🗑️ Eliminar</button>

</div>

`;

  });

  document.getElementById("fundas").innerHTML = html;

}


async function guardarFunda() {

  console.log("DB antes de guardar:", db);

  await addDoc(

    collection(db, "fundas"),

    {

      nombre: document.getElementById("nombre").value,

      stock: Number(document.getElementById("stock").value),

      compatibles:
      document.getElementById("compatibles")
      .value
      .split(","),

      costo: Number(document.getElementById("costo").value),

      venta: Number(document.getElementById("venta").value),

      foto: ""

    }

  );

  alert("Guardada");

}
