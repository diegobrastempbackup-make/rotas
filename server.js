const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

// MONGO
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db = null;

// MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// MIDDLEWARE DE AUTENTICAÇÃO
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });

  try {
    const verificado = jwt.verify(token, JWT_SECRET);
    req.usuario = verificado; 
    next();
  } catch (err) {
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
};

// 🛡️ FUNÇÃO CENTRAL DO SAAS: FILTRO DE ISOLAMENTO
// Se for superadmin, devolve {} (vê tudo). Se for utilizador normal, devolve o ID da empresa.
const getFiltroSaaS = (req) => {
  if (req.usuario.tipo === "superadmin") return {}; 
  return { cliente_id: req.usuario.cliente_id };
};

// ROTAS DE PÁGINAS (FRONT-END)
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/dados.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/dados.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/estoque.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/estoque.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/public/index.html"));


// --- API: SAAS & AUTENTICAÇÃO ---

app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });

    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });

    const token = jwt.sign(
      { id: usuarioBanco._id, tipo: usuarioBanco.tipo, cliente_id: usuarioBanco.cliente_id },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    // TRUQUE DE MESTRE: Se for superadmin, enviamos 'master' para o Front-end liberar todos os menus.
    const tipoFront = usuarioBanco.tipo === "superadmin" ? "master" : usuarioBanco.tipo;

    res.json({ ok: true, token, nome: usuarioBanco.nome, tipo: tipoFront });
  } catch (err) { res.status(500).json({ erro: "Erro ao realizar login" }); }
});

app.post("/nova-empresa", async (req, res) => {
  try {
    const { empresa, nome, usuario, senha } = req.body;
    if (!empresa || !nome || !usuario || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });

    const usuariosColl = db.collection("usuarios");
    const existe = await usuariosColl.findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Este login já está em uso por outro utilizador." });

    const novoClienteId = new ObjectId().toString(); 
    const senhaHash = await bcrypt.hash(senha, 10);

    await usuariosColl.insertOne({
      cliente_id: novoClienteId,
      empresaNome: empresa.trim(),
      nome,
      usuario: usuario.toLowerCase().trim(),
      senha: senhaHash,
      tipo: "master",
      ativo: true,
      criadoEm: new Date()
    });

    res.json({ ok: true, mensagem: "Empresa registada com sucesso!" });
  } catch (err) { res.status(500).json({ erro: "Erro ao registar empresa" }); }
});

app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master" && req.usuario?.tipo !== "superadmin") {
        return res.status(403).json({ erro: "Permissão negada." });
    }

    const { nome, usuario, senha, tipo } = req.body;
    const usuariosColl = db.collection("usuarios");
    const existe = await usuariosColl.findOne({ usuario: usuario.toLowerCase().trim() });

    if (existe) return res.status(400).json({ erro: "Este login já está em uso" });

    const senhaHash = await bcrypt.hash(senha, 10);
    await usuariosColl.insertOne({
      cliente_id: req.usuario.cliente_id, 
      nome,
      usuario: usuario.toLowerCase().trim(),
      senha: senhaHash,
      tipo, 
      ativo: true,
      criadoEm: new Date()
    });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao registar utilizador" }); }
});


// --- UTILIZADORES ---

const listarUsuariosHandler = async (req, res) => {
  try {
    // Modo Deus: Vê utilizadores de todas as empresas
    const lista = await db.collection("usuarios").find(getFiltroSaaS(req)).project({ senha: 0 }).toArray();
    res.json(lista);
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
};
app.get("/api/usuarios", autenticarToken, listarUsuariosHandler);
app.get("/usuarios", autenticarToken, listarUsuariosHandler);

app.delete("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Permissão negada" });
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Permissão negada" });
    const { nome, tipo, senha } = req.body;
    const atualizacao = { nome, tipo };
    if (senha && senha.trim() !== "") atualizacao.senha = await bcrypt.hash(senha, 10);
    
    await db.collection("usuarios").updateOne(
      { _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) },
      { $set: atualizacao }
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});


// --- TÉCNICOS DA FROTA ---

app.get("/api/tecnicos-dashboard", autenticarToken, async (req, res) => {
  try {
    const tecnicos = await db.collection("tecnicos_dashboard").find(getFiltroSaaS(req)).sort({ nome: 1 }).toArray();
    res.json(tecnicos);
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.post("/api/tecnicos-dashboard", autenticarToken, async (req, res) => {
  try {
    const { nome, status, telefone, email, veiculo, placa } = req.body;
    if (!nome) return res.status(400).json({ erro: "Nome obrigatório" });
    
    const existe = await db.collection("tecnicos_dashboard").findOne({ nome: nome.trim(), cliente_id: req.usuario.cliente_id });
    if (existe) return res.status(400).json({ erro: "Técnico já registado na sua empresa" });

    const resultado = await db.collection("tecnicos_dashboard").insertOne({
      cliente_id: req.usuario.cliente_id,
      nome: nome.trim(), status: status || "Ativo", telefone, email, veiculo, placa, criadoEm: new Date()
    });
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => {
  try {
    const { nome, status, telefone, email, veiculo, placa } = req.body;
    await db.collection("tecnicos_dashboard").updateOne(
      { _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) },
      { $set: { nome: nome.trim(), status, telefone, email, veiculo, placa } }
    );
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.delete("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("tecnicos_dashboard").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) });
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

// TÉCNICOS (Antigos - Almoxarifado)
app.get("/api/tecnicos", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("tecnicos").find(getFiltroSaaS(req)).sort({ nome: 1 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.post("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const nome = (req.body.nome || "").trim();
    const existe = await db.collection("tecnicos").findOne({ nome, cliente_id: req.usuario.cliente_id });
    if (existe) return res.status(400).json({ erro: "Técnico já registado" });
    const resultado = await db.collection("tecnicos").insertOne({ cliente_id: req.usuario.cliente_id, nome, criadoEm: new Date() });
    res.json({ ok: true, id: resultado.insertedId });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.delete("/api/tecnicos/:id", autenticarToken, async (req, res) => {
  try { await db.collection("tecnicos").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});


// --- ESTOQUE E CAUTELA ---

app.get("/api/estoque", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("estoque").find(getFiltroSaaS(req)).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.post("/api/estoque", autenticarToken, async (req, res) => {
  try {
    const novoItem = { ...req.body, cliente_id: req.usuario.cliente_id, preco: Number(req.body.preco) || 0, qtd: Number(req.body.qtd) || 0, criadoEm: new Date() };
    const resultado = await db.collection("estoque").insertOne(novoItem);
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/estoque/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("estoque").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: { ...req.body, preco: Number(req.body.preco) || 0, qtd: Number(req.body.qtd) || 0 } });
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.delete("/api/estoque/:id", autenticarToken, async (req, res) => {
  try { await db.collection("estoque").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/estoque/historico", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("historico_estoque").find(getFiltroSaaS(req)).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/estoque/historico/:nome", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("historico_estoque").find({ tecnico: req.params.nome, ...getFiltroSaaS(req) }).sort({ data: -1 }).toArray()); } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.post("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {
    const { ferramentaId, quantidade, tipoAcao } = req.body;
    if (ferramentaId && (tipoAcao === "Entrega" || tipoAcao === "Troca")) {
      const item = await db.collection("estoque").findOne({ _id: new ObjectId(ferramentaId), cliente_id: req.usuario.cliente_id });
      if (!item || Number(quantidade) > Number(item.qtd)) return res.status(400).json({ erro: "Estoque insuficiente." });
    }
    
    await db.collection("historico_estoque").insertOne({ ...req.body, cliente_id: req.usuario.cliente_id });
    
    if (ferramentaId) {
      let ajuste = 0;
      if (tipoAcao === "Entrega" || tipoAcao === "Troca") ajuste = -Number(quantidade);
      if (tipoAcao.includes("Devolu")) ajuste = Number(quantidade);
      await db.collection("estoque").updateOne({ _id: new ObjectId(ferramentaId), cliente_id: req.usuario.cliente_id }, { $inc: { qtd: ajuste } });
    }
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});


// --- REGISTOS DO DASHBOARD ---

app.get("/api/registros", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("registros").find(getFiltroSaaS(req)).sort({ data: 1 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.post("/registro", autenticarToken, async (req, res) => {
  try {
    let dados = req.body.dados || [];
    if (dados.length === 0) return res.status(400).json({ erro: "Nenhum dado informado" });

    const mapa = new Set();
    dados = dados.filter(item => {
      const chave = `${item.tecnico}_${String(item.data).split('T')[0]}`;
      if (mapa.has(chave)) return false;
      mapa.add(chave); return true;
    });

    const operacoes = dados.map(item => {
      const dataLimpa = item.data ? String(item.data).split('T')[0] : '';
      if (item._id) delete item._id;
      item.cliente_id = req.usuario.cliente_id;
      return { updateOne: { filter: { tecnico: item.tecnico, data: dataLimpa, cliente_id: req.usuario.cliente_id }, update: { $set: item }, upsert: true } };
    });

    await db.collection("registros").bulkWrite(operacoes);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.delete("/registro/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("registros").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

// Arquivos estáticos
app.use(express.static(__dirname + "/public", { index: false }));

// INICIALIZAÇÃO E GERAÇÃO DO SUPER ADMIN
async function iniciarSistema() {
  try {
    console.log("🔄 A ligar à base de dados MongoDB Atlas...");
    await client.connect();
    db = client.db("rotas");
    console.log("✅ Conexão estabelecida!");

    // MIGRAÇÃO SAAS BÁSICA
    const defaultClienteId = "neri_matriz_01";
    const colecoes = ["usuarios", "tecnicos", "tecnicos_dashboard", "estoque", "historico_estoque", "registros"];
    for (let col of colecoes) {
      await db.collection(col).updateMany(
        { cliente_id: { $exists: false } },
        { $set: { cliente_id: defaultClienteId } }
      );
    }

    // 🌟 CRIAÇÃO AUTOMÁTICA DO SUPER UTILIZADOR (MODO DEUS)
    const superAdmin = await db.collection("usuarios").findOne({ tipo: "superadmin" });
    if (!superAdmin) {
      const senhaHash = await bcrypt.hash("neri2026", 10);
      await db.collection("usuarios").insertOne({
        cliente_id: "GLOBAL_SYSTEM", // ID especial
        empresaNome: "NERI PLATAFORMA",
        nome: "Diego Neri (Super Admin)",
        usuario: "neri.admin",
        senha: senhaHash,
        tipo: "superadmin", // O perfil mágico que fura as paredes
        ativo: true,
        criadoEm: new Date()
      });
      console.log("👑 Conta Super Admin criada com sucesso!");
      console.log("➡️ Login: neri.admin");
      console.log("➡️ Senha: neri2026");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Motor SaaS NERI 2.0 a correr na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro crítico:", err);
    process.exit(1);
  }
}

iniciarSistema();