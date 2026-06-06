const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
// adicionado para cadastro
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
// adicionado para cadastro
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

// 🔥 MONGO
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri);

let db = null;

// 🔥 MIDDLEWARES
app.use(cors());

app.use(express.json({
  limit: "10mb"
}));

// 🔥 HOME
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.use(express.static("public"));

// 🔥 CONECTAR MONGO
async function conectarMongo() {
  try {
    await client.connect();
    db = client.db("rotas");
    console.log("✅ Mongo conectado");
  } catch (err) {
    console.log(err);
  }
}

conectarMongo();

// 🔥 HOME
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// 🔥 LISTAR REGISTROS
app.get("/registros", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const dados = await db
      .collection("registros")
      .find()
      .sort({ data: 1 }) // 🔥 ORDENA POR DATA
      .toArray();

    res.json(dados);
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

// 🔥 SALVAR REGISTROS (CORRIGIDO: NÃO APAGA MAIS NADA)
app.post("/registro", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const collection = db.collection("registros");
    let dados = req.body.dados || [];

    if (dados.length === 0) {
      return res.status(400).json({ erro: "Nenhum dado" });
    }

    // 🔥 REMOVE DUPLICADOS APENAS DO CORPO DA REQUISIÇÃO ATUAL
    const mapa = new Set();
    dados = dados.filter(item => {
      const chave = JSON.stringify(item);
      if (mapa.has(chave)) return false;
      mapa.add(chave);
      return true;
    });

    // 🔥 INSERE OS NOVOS DADOS SEM DELETAR OS ANTIGOS
    await collection.insertMany(dados);

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// 🔥 CRIAR ADMIN
app.get("/criar-admin", async (req, res) => {
  try {
    const usuarios = db.collection("usuarios");
    const existe = await usuarios.findOne({ usuario: "diego" });

    if (existe) {
      return res.json({ mensagem: "Admin já existe" });
    }

    const senhaHash = await bcrypt.hash("123456", 10);

    await usuarios.insertOne({
      nome: "Diego Silva",
      usuario: "diego",
      senha: senhaHash,
      tipo: "admin",
      ativo: true,
      criadoEm: new Date()
    });

    res.json({ mensagem: "Admin criado com sucesso" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao criar admin" });
  }
});

// 🔥 LOGIN
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario });

    if (!usuarioBanco) {
      return res.status(401).json({ erro: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: usuarioBanco._id, tipo: usuarioBanco.tipo },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      ok: true,
      token,
      nome: usuarioBanco.nome,
      tipo: usuarioBanco.tipo
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao realizar login" });
  }
});

// 🔥 SERVIDOR
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando porta ${PORT}`);
});