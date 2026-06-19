import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let todasLasFundas = [];

// Eventos básicos
document.getElementById("btnLogin").onclick = login;
document.getElementById("btnNuevaFunda").onclick = mostrarFormulario;
document.getElementById("guardarFunda").onclick = guardarFunda;

// EVENTO DELEGADO (EL QUE ELIMINA)
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-eliminar")) {
        const id = e.target.getAttribute("data-id");
        console.log("Intentando eliminar ID:", id); // DEBERÍA SALIR ESTO EN CONSOLA
        eliminarFunda(id);
    }
});

// ... (El resto de tus funciones como login, cargarFundas, etc, son iguales a la versión anterior)

async function eliminarFunda(id) {
    if (!id) return;
    if (confirm("¿Seguro que quieres borrar?")) {
        try {
            await deleteDoc(doc(db, "fundas", id));
            alert("Eliminado");
            cargarFundas(); // Recargamos la lista completa desde Firebase
        } catch (error) {
            alert("Error al borrar: " + error.message);
        }
    }
}

// ... (renderizarFundas igual, asegurándote que el botón tenga class="btn-eliminar" y data-id="${f.id}")
