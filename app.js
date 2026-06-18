import { auth, db }

from "./firebase.js";


import {

signInWithEmailAndPassword

}

from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


import {

collection,

getDocs

}

from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";




document
.getElementById("btnLogin")

.onclick = async ()=>{


const email =

document
.getElementById("email")
.value;



const password =

document
.getElementById("password")
.value;



const email = document.getElementById("email").value.trim();
const password = document.getElementById("password").value;

console.log("EMAIL:", email);
console.log("PASSWORD:", password);

await signInWithEmailAndPassword(auth, email, password);


document
.getElementById("login")

.style.display="none";



document
.getElementById("app")

.style.display="block";



cargarFundas();


};



async function cargarFundas(){


const querySnapshot =

await getDocs(

collection(db,"fundas")

);


let html="";


querySnapshot.forEach(doc=>{


const f = doc.data();



html+=`

<div class="card">

<h2>${f.nombre}</h2>

<p>

📦 Stock:
${f.stock}

</p>


<p>

📱 Compatibles:

${f.compatibles.join(", ")}

</p>


<p>

💰 Venta:

$${f.venta}

</p>

</div>

`;



});


document
.getElementById("fundas")

.innerHTML=html;



}
