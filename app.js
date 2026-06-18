import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";



// LOGIN
document.getElementById("btnLogin").onclick = async () => {

  try {

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    await signInWithEmailAndPassword(auth, email, password);

    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    cargarFundas();

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

};




// CARGAR FUNDAS
async function cargarFundas() {

  const querySnapshot = await getDocs(
    collection(db, "fundas")
  );

  let html = "";

  querySnapshot.forEach((doc) => {

    const f = doc.data();

    html += `

      <div class="card">

        <h2>${f.nombre}</h2>

        <p>📦 Stock: ${f.stock}</p>

        <p>📱 Compatibles:
        ${f.compatibles.join(", ")}</p>

        <p>💵 Costo:
        $${f.costo}</p>

        <p>💰 Venta:
        $${f.venta}</p>

      </div>

    `;

  });

  document.getElementById("fundas").innerHTML = html;

}




// MOSTRAR FORMULARIO
document.getElementById("btnNuevaFunda").onclick = () => {

  document.getElementById("agregar").style.display = "block";

};




// GUARDAR FUNDA
document.getElementById("guardarFunda").onclick = async () => {

  try {

    const nombre = document.getElementById("nombre").value;

    const stock = Number(
      document.getElementById("stock").value
    );

    const compatibles =
      document.getElementById("compatibles")
      .value
      .split(",")
      .map(x => x.trim());

    const costo = Number(
      document.getElementById("costo").value
    );

    const venta = Number(
      document.getElementById("venta").value
    );


    await addDoc(

      collection(db, "fundas"),

      {

        nombre: nombre,

        stock: stock,

        compatibles: compatibles,

        costo: costo,

        venta: venta,

        foto: ""

      }

    );


    alert("Funda guardada");


    document.getElementById("agregar").style.display = "none";


    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("compatibles").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("venta").value = "";


    cargarFundas();


  }

  catch (error) {

    alert(error.message);

    console.log(error);

  }

};
