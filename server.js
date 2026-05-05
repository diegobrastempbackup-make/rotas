const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

app.use(cors());
app.use(express.json());

// 🔥 Conectar ao Mongo
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

// 🔥 Rota principal
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

// 🔥 SALVAR (aceita 1 ou vários)
app.post("/registro", async (req, res) => {
  try {
    const collection = db.collection("registros");

    // 👉 se vier lista
    if (req.body.dados && Array.isArray(req.body.dados)) {
      await collection.insertMany(req.body.dados);
    } 
    // 👉 se vier individual
    else {
      await collection.insertOne({
        km: Number(req.body.km),
        valor: Number(req.body.valor),
        data: new Date()
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado ainda" });
    }

    const dados = await db.collection("registros").find().toArray();
    res.json(dados);

  } catch (err) {
    console.error("ERRO REAL:", err);
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

app.listen(PORT, () => {
  console.log(`Rodando na porta ${PORT}`);
});