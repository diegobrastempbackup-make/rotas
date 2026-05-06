const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

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
app.use(express.static("public"));

// HOME
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// 🔥 SALVAR (SUBSTITUI TUDO)
app.post("/registro", async (req, res) => {
  try {
    const collection = db.collection("registros");

    // LIMPA e salva novo (EVITA DUPLICAÇÃO)
    await collection.deleteMany({});
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

// START
async function start() {
  await client.connect();
  db = client.db("rotas");

  app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Rodando na porta", PORT);
  });
}

start();