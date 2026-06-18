const fundas=[

{
nombre:"Funda Gatito",
stock:5,
compatibles:["11","12","13","15"],
costo:2500,
venta:8000,
foto:"https://via.placeholder.com/80"
},

{
nombre:"Funda Tralalero",
stock:2,
compatibles:["11","12"],
costo:2500,
venta:8000,
foto:"https://via.placeholder.com/80"
}

];

function buscarFundas(){

let modelo=document.getElementById("buscar").value;

let html="";

fundas.forEach(f=>{

if(f.compatibles.includes(modelo)){

html+=`

<div class="card">

<img src="${f.foto}">

<h3>${f.nombre}</h3>

<p>📦 Stock: ${f.stock}</p>

<p>💰 Venta: $${f.venta}</p>

</div>

`;

}

});

document.getElementById("resultados").innerHTML=html;

}
