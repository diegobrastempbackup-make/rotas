const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("❌ MONGO_URI não definida!");
  process.exit(1);
}

const client = new MongoClient(uri);
let db;

app.use(cors());
app.use(express.json());

// 🔥 SERVIR FRONTEND
app.use(express.static(path.join(__dirname, "public")));

// 🔥 TESTE
app.get("/api", (req, res) => {
  res.send("API ONLINE 🚀");
});

// 🔥 SALVAR (DEFINITIVO)
app.post("/registro", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ erro: "Banco não conectado" });

    const collection = db.collection("registros");

    // 🔥 LIMPA TUDO (resolve duplicação e troca de técnico)
    await collection.deleteMany({});

    // 🔥 INSERE NOVO
    await collection.insertMany(req.body.dados);

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res) => {
  try {
    const dados = await db.collection("registros").find().toArray();
    res.json(dados);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

// 🔥 CONECTAR
async function iniciar() {
  await client.connect();
  db = client.db("rotas");
  console.log("✅ Mongo conectado");

  app.listen(PORT, () => {
    console.log("🚀 Rodando na porta " + PORT);
  });
}

iniciar();