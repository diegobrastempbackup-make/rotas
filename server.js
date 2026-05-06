const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 10000;

// 🔐 URI do Mongo
const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("❌ MONGO_URI não definida!");
}

const client = new MongoClient(uri);

let db = null;

app.use(cors());
app.use(express.json());

// 🔥 SERVIR FRONTEND (IMPORTANTE)
app.use(express.static("public"));

// 🔥 Rota principal (opcional - pode remover se quiser abrir só o HTML)
app.get("/api", (req, res) => {
  res.send("API online 🚀");
});

// 🔥 SALVAR
app.post("/registro", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

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
    res.status(500).json({ erro: err.message });
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const dados = await db.collection("registros")
      .find()
      .sort({ data: -1 })
      .toArray();

    res.json(dados);

  } catch (err) {
    console.error("Erro ao buscar:", err);
    res.status(500).json({ erro: err.message });
  }
});

// 🔥 CONECTAR MONGO
async function conectarMongo() {
  try {
    await client.connect();
    db = client.db("rotas");

    console.log("✅ Conectado ao MongoDB");

  } catch (err) {
    console.error("❌ Erro ao conectar no MongoDB:", err.message);
  }
}

// 🔥 INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// conecta em paralelo
conectarMongo();