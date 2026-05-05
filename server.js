const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 usar variável de ambiente (OBRIGATÓRIO em produção)
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri);
let db;

app.use(cors());
app.use(express.json());

async function conectar() {
  try {
    await client.connect();
    db = client.db("dashboard");
    console.log("🔥 Conectado ao MongoDB");
  } catch (err) {
    console.error("Erro ao conectar:", err);
  }
}

conectar();

app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

app.post("/registro", async (req, res) => {
  const { km, valor } = req.body;

  await db.collection("registros").insertOne({
    km: Number(km),
    valor: Number(valor),
    data: new Date()
  });

  res.json({ ok: true });
});

app.get("/registros", async (req, res) => {
  const dados = await db.collection("registros").find().toArray();
  res.json(dados);
});

app.listen(PORT, () => {
  console.log(`Rodando na porta ${PORT}`);
});