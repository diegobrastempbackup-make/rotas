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

// 🔥 Rota principal
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
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
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// 🔥 LISTAR
app.get("/registros", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const dados = await db.collection("registros").find().toArray();
    res.json(dados);

  } catch (err) {
    console.error("Erro ao buscar:", err);
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

// 🔥 CONECTAR MONGO (SEM DERRUBAR O APP)
async function conectarMongo() {
  try {
    await client.connect();
    db = client.db("rotas"); // 🔴 IMPORTANTE: use o mesmo nome da sua string

    console.log("✅ Conectado ao MongoDB");

  } catch (err) {
    console.error("❌ Erro ao conectar no MongoDB:", err.message);
  }
}

// 🔥 INICIA SERVIDOR SEMPRE
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// conecta em paralelo
conectarMongo();