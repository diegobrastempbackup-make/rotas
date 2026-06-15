const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

// VALIDAÇÃO DA STRING DE CONEXÃO DO MONGO
if (!process.env.MONGO_URI) {
  console.error("❌ ERRO CRÍTICO: A variável ambiente MONGO_URI não foi configurada!");
  process.exit(1);
}
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db = null;

// MIDDLEWARES DE CONFIGURAÇÃO
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// MIDDLEWARE DE AUTENTICAÇÃO (Apenas uma declaração limpa)
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
  }

  try {
    const verificado = jwt.verify(token, JWT_SECRET);
    req.usuario = verificado;
    next();
  } catch (err) {
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
};

// Definição exata do caminho da pasta public
const publicPath = path.resolve(__dirname, "public");

// ==========================================
// --- ROTAS DE PÁGINAS (FRONT-END) ---
// ==========================================

// HOME (Tela de login)
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

// BLINDAGEM dados.html contra acessos sem token na URL
app.get("/dados.html", (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(path.join(publicPath, "dados.html"));
  } catch (err) {
    res.redirect("/login.html");
  }
});

// BLINDAGEM estoque.html contra acessos sem token na URL
app.get("/estoque.html", (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(path.join(publicPath, "estoque.html"));
  } catch (err) {
    res.redirect("/login.html");
  }
});

app.get("/login.html", (req, res) => res.sendFile(path.join(publicPath, "login.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(publicPath, "index.html")));


// ==========================================
// --- API: ROTAS DO SISTEMA (BACK-END) ---
// ==========================================

// LOGIN
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
      { 
        id: usuarioBanco._id.toString(),
        nome: usuarioBanco.nome,
        usuario: usuarioBanco.usuario,
        tipo: usuarioBanco.tipo 
      },
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

// CADASTRO DE USUÁRIOS
app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master" && req.usuario?.tipo !== "admin") {
      return res.status(403).json({ erro: "Sem permissão para cadastrar usuários." });
    }

    const { nome, usuario, senha, tipo } = req.body;
    if (!nome || !usuario || !senha || !tipo) {
      return res.status(400).json({ erro: "Preencha todos os campos obrigatórios" });
    }

    const usuariosColl = db.collection("usuarios");
    const existe = await usuariosColl.findOne({ usuario: usuario.toLowerCase().trim() });

    if (existe) {
      return res.status(400).json({ erro: "Este nome de usuário já está cadastrado" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    await usuariosColl.insertOne({
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

// LISTAR USUÁRIOS
const listarUsuariosHandler = async (req, res) => {
  try {
    const lista = await db.collection("usuarios").find().project({ senha: 0 }).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao listar usuários" });
  }
};
app.get("/api/usuarios", autenticarToken, listarUsuariosHandler);
app.get("/usuarios", autenticarToken, listarUsuariosHandler);

// ATUALIZAR USUÁRIO
app.put("/usuario/:id", autenticarToken, async (req, res) => {
  try {
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

// ROTAS DE ESTOQUE
app.get("/api/estoque", autenticarToken, async (req, res) => {
  try {
    const estoque = await db.collection("estoque").find().toArray();
    res.json(estoque);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar estoque" });
  }
});

app.get("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {
    const historico = await db.collection("historico_estoque").find().toArray();
    res.json(historico);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar histórico do estoque" });
  }
});

// LISTAR REGISTROS DE ROTAS/KM
app.get("/registros", autenticarToken, async (req, res) => {
  try {
    const dados = await db.collection("registros").find().sort({ data: 1 }).toArray();
    res.json(dados);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar registros" });
  }
});

// SALVAR/ATUALIZAR REGISTROS
app.post("/registro", autenticarToken, async (req, res) => {
  try {
    let dados = req.body.dados || [];
    if (dados.length === 0) return res.status(400).json({ erro: "Nenhum dado informado" });

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
          filter: { tecnico: item.tecnico, data: dataLimpa },
          update: { $set: item }, 
          upsert: true 
        }
      };
    });

    await db.collection("registros").bulkWrite(operacoes);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao salvar dados" });
  }
});

// DELETAR REGISTRO
app.delete("/registro/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.collection("registros").deleteOne({ _id: new ObjectId(id) });
    if (resultado.deletedCount === 1) {
      res.json({ ok: true, message: "Registro apagado com sucesso!" });
    } else {
      res.status(404).json({ erro: "Registro não encontrado" });
    }
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar registro" });
  }
});

// CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS
app.use(express.static(publicPath, { index: false }));

// SUBIDA SINCRONIZADA: Conecta primeiro ao banco, e só depois abre a porta do servidor
async function iniciarServidor() {
  try {
    console.log("🔄 Conectando ao MongoDB Atlas...");
    await client.connect();
    db = client.db("rotas");
    console.log("✅ Mongo conectado com sucesso!");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor NERI rodando perfeitamente na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro fatal ao iniciar o sistema:", err);
    process.exit(1);
  }
}

iniciarServidor();