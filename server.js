const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 10000;

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri);
let db;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 🔥 CONECTA
async function conectar(){
  await client.connect();
  db = client.db("rotas");
  console.log("✅ Mongo conectado");
}
conectar();

// 🔥 SALVAR (SEM APAGAR)
app.post("/registro", async (req, res)=>{
  try{
    const collection = db.collection("registros");

    if(!req.body.dados || req.body.dados.length === 0){
      return res.status(400).json({erro:"Sem dados"});
    }

    await collection.insertMany(req.body.dados);

    res.json({ok:true});
  }catch(err){
    console.log(err);
    res.status(500).json({erro:"Erro ao salvar"});
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res)=>{
  const lista = await db.collection("registros").find().toArray();
  res.json(lista);
});

// 🔥 START
app.listen(PORT, "0.0.0.0", ()=>{
  console.log("🚀 Rodando porta " + PORT);
});