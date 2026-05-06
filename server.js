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

// 🔥 SALVAR (SUBSTITUI TUDO)
app.post("/registro", async (req, res) => {
  try {
    const collection = db.collection("registros");

    // 🔥 LIMPA E SALVA NOVO (CONSISTÊNCIA TOTAL)
    await collection.deleteMany({});
    await collection.insertMany(req.body.dados);

    res.json({ ok:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro:"Erro ao salvar" });
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res) => {
  const dados = await db.collection("registros").find().toArray();
  res.json(dados);
});

// 🔥 START
app.listen(PORT, "0.0.0.0", ()=>{
  console.log("🚀 Rodando na porta", PORT);
});