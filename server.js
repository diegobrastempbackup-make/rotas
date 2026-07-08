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

// ROTAS DE PÁGINAS (FRONT-END)
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/public/index.html"));

app.get("/dados.html", (req, res) => {
  if (!req.query.token) return res.redirect("/login.html");
  try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/dados.html"); } 
  catch (err) { res.redirect("/login.html"); }
});

app.get("/estoque.html", (req, res) => {
  if (!req.query.token) return res.redirect("/login.html");
  try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/estoque.html"); } 
  catch (err) { res.redirect("/login.html"); }
});

app.get("/tecnicos.html", (req, res) => {
  if (!req.query.token) return res.redirect("/login.html");
  try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/tecnicos.html"); } 
  catch (err) { res.redirect("/login.html"); }
});


// LOGIN & USUÁRIOS
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (!usuarioBanco) return res.status(401).json({ erro: "Usuário não encontrado" });

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });

    const token = jwt.sign({ id: usuarioBanco._id, tipo: usuarioBanco.tipo }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ ok: true, token, nome: usuarioBanco.nome, tipo: usuarioBanco.tipo });
  } catch (err) { res.status(500).json({ erro: "Erro ao realizar login" }); }
});

app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master") return res.status(403).json({ erro: "Você não tem permissão." });
    const { nome, usuario, senha, tipo } = req.body;
    const usuariosColl = db.collection("usuarios");
    const existe = await usuariosColl.findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Este nome de usuário já está cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);
    await usuariosColl.insertOne({ nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo, ativo: true, criadoEm: new Date() });
    res.json({ ok: true, mensagem: "Usuário criado com sucesso!" });
  } catch (err) { res.status(500).json({ erro: "Erro ao cadastrar usuário" }); }
});

const listarUsuariosHandler = async (req, res) => {
  try {
    const lista = await db.collection("usuarios").find().project({ senha: 0 }).toArray();
    res.json(lista);
  } catch (err) { res.status(500).json({ erro: "Erro ao listar usuários" }); }
};
app.get("/api/usuarios", autenticarToken, listarUsuariosHandler);

app.delete("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master") return res.status(403).json({ erro: "Somente Master pode excluir usuários" });
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao excluir usuário" }); }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master") return res.status(403).json({ erro: "Você não tem permissão!" });
    const { nome, tipo, senha } = req.body;
    const atualizacao = { nome, tipo };
    if (senha && senha.trim() !== "") atualizacao.senha = await bcrypt.hash(senha, 10);
    await db.collection("usuarios").updateOne({ _id: new ObjectId(req.params.id) }, { $set: atualizacao });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao editar usuário" }); }
});


// =========================================================
// TÉCNICOS DO ESTOQUE (INDEPENDENTES - NADA MUDOU AQUI)
// =========================================================
app.get("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const tecnicos = await db.collection("tecnicos").find().sort({ nome: 1 }).toArray();
    res.json(tecnicos);
  } catch (erro) { res.status(500).json({ erro: "Erro ao listar técnicos" }); }
});
app.post("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const nome = (req.body.nome || "").trim();
    const existe = await db.collection("tecnicos").findOne({ nome });
    if (existe) return res.status(400).json({ erro: "Técnico já cadastrado" });
    const resultado = await db.collection("tecnicos").insertOne({ nome, criadoEm: new Date() });
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) { res.status(500).json({ erro: "Erro ao cadastrar técnico" }); }
});
app.delete("/api/tecnicos/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("tecnicos").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro ao excluir técnico" }); }
});


// =========================================================
// NOVA COLEÇÃO: TÉCNICOS DO DASHBOARD / FROTA
// =========================================================
app.get("/api/tecnicos-dashboard", autenticarToken, async (req, res) => {
  try {
    const tecnicos = await db.collection("tecnicos_dashboard").find().sort({ nome: 1 }).toArray();
    res.json(tecnicos);
  } catch (erro) { res.status(500).json({ erro: "Erro ao listar técnicos" }); }
});

app.post("/api/tecnicos-dashboard", autenticarToken, async (req, res) => {
  try {
    const { nome, status, telefone, email, veiculo, placa } = req.body;
    if (!nome) return res.status(400).json({ erro: "Nome obrigatório" });
    const existe = await db.collection("tecnicos_dashboard").findOne({ nome: nome.trim() });
    if (existe) return res.status(400).json({ erro: "Técnico já cadastrado" });

    const resultado = await db.collection("tecnicos_dashboard").insertOne({
      nome: nome.trim(), status: status || "Ativo", telefone, email, veiculo, placa, criadoEm: new Date()
    });
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) { res.status(500).json({ erro: "Erro ao cadastrar técnico" }); }
});

app.put("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => {
  try {
    const { nome, status, telefone, email, veiculo, placa } = req.body;
    await db.collection("tecnicos_dashboard").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { nome: nome.trim(), status, telefone, email, veiculo, placa } }
    );
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro ao editar técnico" }); }
});

app.delete("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("tecnicos_dashboard").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro ao excluir técnico" }); }
});


// ESTOQUE - ITENS E HISTÓRICO
app.get("/api/estoque", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("estoque").find().toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.post("/api/estoque", autenticarToken, async (req, res) => {
  try {
    const novoItem = { ...req.body, preco: Number(req.body.preco) || 0, qtd: Number(req.body.qtd) || 0, criadoEm: new Date() };
    const resultado = await db.collection("estoque").insertOne(novoItem);
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});
app.put("/api/estoque/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("estoque").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, preco: Number(req.body.preco) || 0, qtd: Number(req.body.qtd) || 0 } });
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});
app.delete("/api/estoque/:id", autenticarToken, async (req, res) => {
  try { await db.collection("estoque").deleteOne({ _id: new ObjectId(req.params.id) }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/estoque/historico", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("historico_estoque").find().toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.get("/api/estoque/historico/:nome", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("historico_estoque").find({ tecnico: req.params.nome }).sort({ data: -1 }).toArray()); } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});
app.post("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {
    const { ferramentaId, quantidade, tipoAcao } = req.body;
    if (ferramentaId && (tipoAcao === "Entrega" || tipoAcao === "Troca")) {
      const item = await db.collection("estoque").findOne({ _id: new ObjectId(ferramentaId) });
      if (!item || Number(quantidade) > Number(item.qtd)) return res.status(400).json({ erro: "Estoque insuficiente." });
    }
    await db.collection("historico_estoque").insertOne(req.body);
    if (ferramentaId) {
      let ajuste = 0;
      if (tipoAcao === "Entrega" || tipoAcao === "Troca") ajuste = -Number(quantidade);
      if (tipoAcao.includes("Devolu")) ajuste = Number(quantidade);
      await db.collection("estoque").updateOne({ _id: new ObjectId(ferramentaId) }, { $inc: { qtd: ajuste } });
    }
    res.json({ ok: true });
  } catch (erro) { res.status(500).json({ erro: "Erro" }); }
});


// REGISTROS (DASHBOARD)
app.get("/api/registros", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("registros").find().sort({ data: 1 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.post("/registro", autenticarToken, async (req, res) => {
  try {
    let dados = req.body.dados || [];
    const operacoes = dados.map(item => {
      const dataLimpa = item.data ? String(item.data).split('T')[0] : '';
      if (item._id) delete item._id;
      return { updateOne: { filter: { tecnico: item.tecnico, data: dataLimpa }, update: { $set: item }, upsert: true } };
    });
    if (operacoes.length > 0) await db.collection("registros").bulkWrite(operacoes);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});
app.delete("/registro/:id", autenticarToken, async (req, res) => {
  try { await db.collection("registros").deleteOne({ _id: new ObjectId(req.params.id) }); res.json({ ok: true }); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.use(express.static(__dirname + "/public", { index: false }));

async function iniciarSistema() {
  try {
    console.log("🔄 Conectando ao MongoDB...");
    await client.connect();
    db = client.db("rotas");
    console.log("✅ Mongo conectado!");

    // AUTO-SEED: Cadastra a lista fixa antiga no banco de dados novo se estiver vazio
    const frotaAntiga = ["Sibele", "Empresa", "Danilo", "José Cicero", "Alex", "Danilo BH", "Thiago BH"];
    const count = await db.collection("tecnicos_dashboard").countDocuments();
    if (count === 0) {
       console.log("Populando técnicos iniciais da frota no banco...");
       const seedData = frotaAntiga.map(nome => ({ nome, status: "Ativo", telefone: "", email: "", veiculo: "", placa: "", criadoEm: new Date() }));
       await db.collection("tecnicos_dashboard").insertMany(seedData);
    }

    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  }
}

iniciarSistema();