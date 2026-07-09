const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https"); // <-- Novo módulo nativo para o Ping

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

// =====================================================================
// ⚠️ COLOQUE AQUI O LINK REAL DO SEU SISTEMA NO RENDER
// Exemplo: "https://neri-frota-app.onrender.com"
const URL_DO_SEU_SISTEMA = "https://rotas-2.onrender.com/login.html"; 
// =====================================================================

// MONGO
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db = null;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// MIDDLEWARE DE AUTENTICAÇÃO
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: "Acesso negado." });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET); 
    next();
  } catch (err) { return res.status(403).json({ erro: "Token inválido." }); }
};

// FILTRO SAAS 
const getFiltroSaaS = (req) => {
  if (req.usuario.tipo === "superadmin") return {}; 
  return { cliente_id: req.usuario.cliente_id };
};

// ROTAS DE PÁGINAS FRONT-END
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/dados.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/dados.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/estoque.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/estoque.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/public/index.html"));

// ROTA ANTI-HIBERNAÇÃO
app.get("/ping", (req, res) => {
  res.status(200).send("Servidor acordado!");
});

// --- LOGIN (Com trava de conta suspensa) ---
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    
    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });
    
    if (usuarioBanco.ativo === false) return res.status(403).json({ erro: "Acesso suspenso. Contacte a administração." });

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });

    const token = jwt.sign(
      { id: usuarioBanco._id, tipo: usuarioBanco.tipo, cliente_id: usuarioBanco.cliente_id },
      JWT_SECRET, { expiresIn: "12h" }
    );

    const tipoFront = usuarioBanco.tipo === "superadmin" ? "master" : usuarioBanco.tipo;
    res.json({ ok: true, token, nome: usuarioBanco.nome, tipo: tipoFront });
  } catch (err) { res.status(500).json({ erro: "Erro ao realizar login" }); }
});

// --- ROTA PROTEGIDA: CRIAR NOVA EMPRESA ---
app.post("/nova-empresa", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado." });

    const { empresa, nome, usuario, senha } = req.body;
    if (!empresa || !nome || !usuario || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });

    const existe = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Login já em uso." });

    const novoClienteId = new ObjectId().toString(); 
    const senhaHash = await bcrypt.hash(senha, 10);

    await db.collection("usuarios").insertOne({
      cliente_id: novoClienteId,
      empresaNome: empresa.trim(),
      nome,
      usuario: usuario.toLowerCase().trim(),
      senha: senhaHash,
      tipo: "master",
      ativo: true,
      criadoEm: new Date()
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao criar empresa" }); }
});

// --- GESTÃO DE EMPRESAS: LISTAR, BLOQUEAR E EXCLUIR (SÓ SUPER ADMIN) ---
app.get("/api/empresas", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado" });
    const empresas = await db.collection("usuarios").find({ tipo: "master" }).project({ senha: 0 }).toArray();
    res.json(empresas);
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/empresas/:id/status", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado" });
    const { ativo } = req.body;
    
    const empresaMaster = await db.collection("usuarios").findOne({ _id: new ObjectId(req.params.id) });
    
    if(empresaMaster) {
        await db.collection("usuarios").updateMany(
            { cliente_id: empresaMaster.cliente_id },
            { $set: { ativo: ativo } }
        );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.delete("/api/empresas/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado" });
    
    const empresaMaster = await db.collection("usuarios").findOne({ _id: new ObjectId(req.params.id) });
    
    if(empresaMaster && empresaMaster.cliente_id) {
        const cid = empresaMaster.cliente_id;
        await db.collection("usuarios").deleteMany({ cliente_id: cid });
        await db.collection("tecnicos_dashboard").deleteMany({ cliente_id: cid });
        await db.collection("tecnicos").deleteMany({ cliente_id: cid });
        await db.collection("estoque").deleteMany({ cliente_id: cid });
        await db.collection("historico_estoque").deleteMany({ cliente_id: cid });
        await db.collection("registros").deleteMany({ cliente_id: cid });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

// --- UTILIZADORES GERAIS ---
app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master" && req.usuario?.tipo !== "superadmin") return res.status(403).json({ erro: "Permissão negada." });
    const { nome, usuario, senha, tipo } = req.body;
    const existe = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Login já em uso" });

    const senhaHash = await bcrypt.hash(senha, 10);
    await db.collection("usuarios").insertOne({
      cliente_id: req.usuario.cliente_id, nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo, ativo: true, criadoEm: new Date()
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

const listarUsuariosHandler = async (req, res) => {
  try { res.json(await db.collection("usuarios").find(getFiltroSaaS(req)).project({ senha: 0 }).toArray()); } 
  catch (err) { res.status(500).json({ erro: "Erro" }); }
};
app.get("/api/usuarios", autenticarToken, listarUsuariosHandler);

app.delete("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Negado" });
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Negado" });
    const { nome, tipo, senha } = req.body;
    const atualizacao = { nome, tipo };
    if (senha && senha.trim() !== "") atualizacao.senha = await bcrypt.hash(senha, 10);
    await db.collection("usuarios").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: atualizacao });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

// --- RESTANTES ENDPOINTS (COM FILTRO SAAS APLICADO) ---
app.get("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { res.json(await db.collection("tecnicos_dashboard").find(getFiltroSaaS(req)).sort({ nome: 1 }).toArray()); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.post("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { const { nome, status, telefone, email, veiculo, placa } = req.body; const existe = await db.collection("tecnicos_dashboard").findOne({ nome: nome.trim(), cliente_id: req.usuario.cliente_id }); if (existe) return res.status(400).json({ erro: "Técnico já registado" }); await db.collection("tecnicos_dashboard").insertOne({ cliente_id: req.usuario.cliente_id, nome: nome.trim(), status: status || "Ativo", telefone, email, veiculo, placa, criadoEm: new Date() }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.put("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos_dashboard").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: { nome: req.body.nome.trim(), status: req.body.status, telefone: req.body.telefone, email: req.body.email, veiculo: req.body.veiculo, placa: req.body.placa } }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.delete("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos_dashboard").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });

app.get("/api/tecnicos", autenticarToken, async (req, res) => { try { res.json(await db.collection("tecnicos").find(getFiltroSaaS(req)).sort({ nome: 1 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); } });
app.post("/api/tecnicos", autenticarToken, async (req, res) => { try { const nome = (req.body.nome || "").trim(); const existe = await db.collection("tecnicos").findOne({ nome, cliente_id: req.usuario.cliente_id }); if (existe) return res.status(400).json({ erro: "Já registado" }); await db.collection("tecnicos").insertOne({ cliente_id: req.usuario.cliente_id, nome, criadoEm: new Date() }); res.json({ ok: true }); } catch (err) { res.status(500).json({ erro: "Erro" }); } });
app.delete("/api/tecnicos/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (err) { res.status(500).json({ erro: "Erro" }); } });

app.get("/api/estoque", autenticarToken, async (req, res) => { try { res.json(await db.collection("estoque").find(getFiltroSaaS(req)).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); } });
app.post("/api/estoque", autenticarToken, async (req, res) => { try { await db.collection("estoque").insertOne({ ...req.body, cliente_id: req.usuario.cliente_id, preco: Number(req.body.preco) || 0, qtd: Number(req.body.qtd) || 0, criadoEm: new Date() }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.put("/api/estoque/:id", autenticarToken, async (req, res) => { try { await db.collection("estoque").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: { ...req.body, preco: Number(req.body.preco) || 0, qtd: Number(req.body.qtd) || 0 } }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.delete("/api/estoque/:id", autenticarToken, async (req, res) => { try { await db.collection("estoque").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.get("/api/estoque/historico", autenticarToken, async (req, res) => { try { res.json(await db.collection("historico_estoque").find(getFiltroSaaS(req)).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); } });
app.get("/api/estoque/historico/:nome", autenticarToken, async (req, res) => { try { res.json(await db.collection("historico_estoque").find({ tecnico: req.params.nome, ...getFiltroSaaS(req) }).sort({ data: -1 }).toArray()); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.post("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {
    const { ferramentaId, quantidade, tipoAcao } = req.body;
    if (ferramentaId && (tipoAcao === "Entrega" || tipoAcao === "Troca")) {
      const item = await db.collection("estoque").findOne({ _id: new ObjectId(ferramentaId), cliente_id: req.usuario.cliente_id });
      if (!item || Number(quantidade) > Number(item.qtd)) return res.status(400).json({ erro: "Estoque insuficiente." });
    }
    await db.collection("historico_estoque").insertOne({ ...req.body, cliente_id: req.usuario.cliente_id });
    if (ferramentaId) {
      let ajuste = tipoAcao.includes("Devolu") ? Number(quantidade) : -Number(quantidade);
      await db.collection("estoque").updateOne({ _id: new ObjectId(ferramentaId), cliente_id: req.usuario.cliente_id }, { $inc: { qtd: ajuste } });
    }
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/registros", autenticarToken, async (req, res) => { try { res.json(await db.collection("registros").find(getFiltroSaaS(req)).sort({ data: 1 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); } });
app.post("/registro", autenticarToken, async (req, res) => {
  try {
    let dados = req.body.dados || [];
    if (dados.length === 0) return res.status(400).json({ erro: "Vazio" });
    const mapa = new Set();
    dados = dados.filter(item => { const chave = `${item.tecnico}_${String(item.data).split('T')[0]}`; if (mapa.has(chave)) return false; mapa.add(chave); return true; });
    const operacoes = dados.map(item => {
      const dataLimpa = item.data ? String(item.data).split('T')[0] : ''; if (item._id) delete item._id; item.cliente_id = req.usuario.cliente_id;
      return { updateOne: { filter: { tecnico: item.tecnico, data: dataLimpa, cliente_id: req.usuario.cliente_id }, update: { $set: item }, upsert: true } };
    });
    await db.collection("registros").bulkWrite(operacoes);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.delete("/registro/:id", autenticarToken, async (req, res) => { try { await db.collection("registros").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (err) { res.status(500).json({ erro: "Erro" }); } });

app.use(express.static(__dirname + "/public", { index: false }));

// INICIALIZAÇÃO
async function iniciarSistema() {
  try {
    console.log("🔄 A ligar à base de dados...");
    await client.connect(); db = client.db("rotas"); console.log("✅ Conexão estabelecida!");
    
    // Migração de Segurança para os seus dados não se perderem
    const defaultClienteId = "neri_matriz_01";
    for (let col of ["usuarios", "tecnicos", "tecnicos_dashboard", "estoque", "historico_estoque", "registros"]) {
      await db.collection(col).updateMany({ cliente_id: { $exists: false } }, { $set: { cliente_id: defaultClienteId } });
    }

    const superAdmin = await db.collection("usuarios").findOne({ tipo: "superadmin" });
    if (!superAdmin) {
      const senhaHash = await bcrypt.hash("neri2026", 10);
      await db.collection("usuarios").insertOne({
        cliente_id: "GLOBAL_SYSTEM", empresaNome: "NERI PLATAFORMA", nome: "Diego Neri (Super Admin)",
        usuario: "neri.admin", senha: senhaHash, tipo: "superadmin", ativo: true, criadoEm: new Date()
      });
      console.log("👑 Conta Super Admin Criada: neri.admin / neri2026");
    }

    // 🚀 O LOOP ANTI-HIBERNAÇÃO (Pinga a cada 14 minutos)
    setInterval(() => {
      https.get(`${URL_DO_SEU_SISTEMA}/ping`, (resp) => {
        console.log(`⏱️ [${new Date().toLocaleTimeString()}] Ping automático enviado. Render mantido acordado!`);
      }).on("error", (err) => {
        console.log("⚠️ Falha no ping automático:", err.message);
      });
    }, 14 * 60 * 1000); 

    app.listen(PORT, () => console.log(`🚀 Motor SaaS NERI 2.0 a correr na porta ${PORT}`));
  } catch (err) { console.error("❌ Erro:", err); process.exit(1); }
}
iniciarSistema();