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

// 🔥 Rota principal
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

// 🔥 SALVAR (aceita 1 ou vários)
app.post("/registro", async (req, res) => {
  try {
    const collection = db.collection("registros");

    if (req.body.dados && Array.isArray(req.body.dados)) {
      await collection.insertMany(req.body.dados);
    } else {
      await collection.insertOne({
        km: Number(req.body.km),
        valor: Number(req.body.valor),
        data: new Date()
      });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error("Erro ao salvar:", err);
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res) => {
  try {
    const dados = await db.collection("registros").find().toArray();
    res.json(dados);

  } catch (err) {
    console.error("Erro ao buscar:", err);
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

// 🔥 INICIAR SERVIDOR SÓ DEPOIS DE CONECTAR
async function iniciarServidor() {
  try {
    await client.connect();
    db = client.db("dashboard");

    console.log("🔥 Conectado ao MongoDB");

    app.listen(PORT, () => {
      console.log(`🚀 Rodando na porta ${PORT}`);
    });

  } catch (err) {
    console.error("Erro ao conectar:", err);
  }
}

iniciarServidor();