const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

//  MONGO
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db = null;

// MIDDLEWARES
app.use(cors());
app.use(express.json({
  limit: "10mb"
}));

//  HOME (Entrega a tela de login)
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// BLINDAGEM NO SERVIDOR: Protege o arquivo dados.html de acessos diretos pela URL
app.get("/dados.html", (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.redirect("/login.html");
  }

  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(__dirname + "/public/dados.html");
  } catch (err) {
    res.redirect("/login.html");
  }
});

// CONECTAR COM O MONGO
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

//  ROTAS DO SISTEMA

//  LISTAR REGISTROS
app.get("/registros", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ erro: "Banco não conectado" });
    }

    const dados = await db
      .collection("registros")
      .find()
      .sort({ data: 1 }) 
      .toArray();

    res.json(dados);
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao buscar" });
  }
});

// SALVAR REGISTROS (COM UPSERT INTELIGENTE - TRAVA ANTI-DUPLICADAS)
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

    const mapa = new Set();
    dados = dados.filter(item => {
      const chave = `${item.tecnico}_${String(item.data).split('T')[0]}`;
      if (mapa.has(chave)) return false;
      mapa.add(chave);
      return true;
    });

    const operacoes = dados.map(item => {
      const dataLimpa = item.data ? String(item.data).split('T')[0] : '';
      
      if (item._id) delete item._id;

      return {
        updateOne: {
          filter: { 
            tecnico: item.tecnico, 
            data: dataLimpa 
          },
          update: { $set: item }, 
          upsert: true 
        }
      };
    });

    await collection.bulkWrite(operacoes);

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao salvar" });
  }
});

// ROTA DA LIXEIRA: DELETAR REGISTRO DEFINITIVAMENTE DO BANCO DO ATLAS (FUNÇÃO DA LIXEIRA NO DADOS.HTML)
app.delete("/registro/:id", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ erro: "Banco não conectado" });

    const { id } = req.params;

    const resultado = await db.collection("registros").deleteOne({ _id: new ObjectId(id) });

    if (resultado.deletedCount === 1) {
      res.json({ ok: true, mensagem: "Rota apagada com sucesso!" });
    } else {
      res.status(404).json({ erro: "Registro não encontrado no banco" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao deletar registro" });
  }
});

// CRIAR ADMIN INICIAL (Usa "diego" SENHA MASTER)
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

// CADASTRO DE NOVOS USUÁRIOS (GERENCIADO PELO ADMIN)
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
    const existe = await usuarios.findOne({ usuario: usuario.toLowerCase().trim() });

    if (existe) {
      return res.status(400).json({ erro: "Este nome de usuário já está cadastrado" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await usuarios.insertOne({
      nome,
      usuario: usuario.toLowerCase().trim(),
      senha: senhaHash,
      tipo, 
      ativo: true,
      criadoEm: new Date()
    });

    res.json({ ok: true, mensagem: "Usuário criado com sucesso!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao cadastrar usuário" });
  }
});

// LISTAR TODOS OS USUÁRIOS
app.get("/usuarios", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ erro: "Banco não conectado" });

    const lista = await db.collection("usuarios")
      .find()
      .project({ senha: 0 })
      .toArray();

    res.json(lista);
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao listar usuários" });
  }
});

// ATUALIZAR USUÁRIO
app.put("/usuario/:id", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ erro: "Banco não conectado" });

    const { id } = req.params;
    const { nome, tipo, novaSenha } = req.body;

    let dadosAtualizados = { nome, tipo };

    if (novaSenha && novaSenha.trim() !== "") {
      const senhaHash = await bcrypt.hash(novaSenha, 10);
      dadosAtualizados.senha = senhaHash;
    }

    await db.collection("usuarios").updateOne(
      { _id: new ObjectId(id) },
      { $set: dadosAtualizados }
    );

    res.json({ ok: true, message: "Usuário atualizado com sucesso!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao atualizar usuário" });
  }
});

//  LOGIN
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
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

// SERVIR ARQUIVOS ESTÁTICOS
app.use(express.static("public"));

// START DO SERVIDOR
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando porta ${PORT}`);
});