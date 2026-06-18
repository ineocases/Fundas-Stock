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

  }

  catch (error) {

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

  querySnapshot.forEach(doc => {

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

    await addDoc(

      collection(db, "fundas"),

      {

        nombre:

          document.getElementById("nombre").value,



        stock:

          Number(
            document.getElementById("stock").value
          ),



        compatibles:

          document
            .getElementById("compatibles")
            .value
            .split(","),



        costo:

          Number(
            document.getElementById("costo").value
          ),



        venta:

          Number(
            document.getElementById("venta").value
          ),


        foto: ""

      }

    );


    alert("Funda guardada");


    document.getElementById("agregar").style.display = "none";


    cargarFundas();


  }

  catch (error) {

    alert(error.message);

    console.log(error);

  }

};
