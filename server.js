const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
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

// 🔥 HOME (Interpõe a rota raiz para entregar sempre a tela de login)
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

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

// ========================================================
// 🛠 ROTAS DO SISTEMA
// ========================================================

// 🔥 LISTAR REGISTROS
app.get("/registros", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const dados = await db
      .collection("registros")
      .find()
      .sort({ data: 1 }) // Ordena por data
      .toArray();

    res.json(dados);
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

// 🔥 SALVAR REGISTROS
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

    // Remove duplicados apenas do corpo da requisição atual
    const mapa = new Set();
    dados = dados.filter(item => {
      const chave = JSON.stringify(item);
      if (mapa.has(chave)) return false;
      mapa.add(chave);
      return true;
    });

    // Insere os novos dados sem deletar os antigos
    await collection.insertMany(dados);

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// 🔥 CRIAR ADMIN INICIAL (Usa "diego")
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

// 🔥 NOVA ROTA: CADASTRO DE NOVOS USUÁRIOS (GERENCIADO PELO ADMIN)
app.post("/cadastro", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const { nome, usuario, senha, tipo } = req.body;

    if (!nome || !usuario || !senha || !tipo) {
      return res.status(400).json({ erro: "Preencha todos os campos obrigatórios" });
    }

    const usuarios = db.collection("usuarios");
    
    // Evita duplicidade convertendo para minúsculas e limpando espaços em branco
    const existe = await usuarios.findOne({ usuario: usuario.toLowerCase().trim() });

    if (existe) {
      return res.status(400).json({ erro: "Este nome de usuário já está cadastrado" });
    }

    // Criptografa a nova senha usando o bcryptjs
    const senhaHash = await bcrypt.hash(senha, 10);

    await usuarios.insertOne({
      nome,
      usuario: usuario.toLowerCase().trim(),
      senha: senhaHash,
      tipo, // "admin" ou "usuario"
      ativo: true,
      criadoEm: new Date()
    });

    res.json({ ok: true, mensagem: "Usuário criado com sucesso!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao cadastrar usuário" });
  }
});

// 🔥 LOGIN
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    
    // Busca ignorando diferenças de caixa alta/baixa se o input vier bagunçado
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });

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

// ========================================================
// ⚡ SERVIR ARQUIVOS ESTÁTICOS (DEVE FICAR SEMPRE ABAIXO DAS ROTAS)
// ========================================================
app.use(express.static("public"));

// 🔥 START DO SERVIDOR
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando porta ${PORT}`);
});