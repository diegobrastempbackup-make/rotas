const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https"); 

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

// =====================================================================
// URL DO SEU SISTEMA NO RENDER (Para o Ping Anti-Hibernação)
const URL_DO_SEU_SISTEMA = "https://rotas-2.onrender.com/login.html"; 
// =====================================================================

// MONGO DB
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

// FILTRO SAAS (Separa os dados de cada empresa)
const getFiltroSaaS = (req) => {
  if (req.usuario.tipo === "superadmin") return {}; 
  return { cliente_id: req.usuario.cliente_id };
};

// =====================================================================
// ROTAS DE PÁGINAS FRONT-END
// =====================================================================
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/dados.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/dados.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/estoque.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/estoque.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/public/index.html"));
app.get("/roteirizador.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/roteirizador.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/diario.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/diario.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/fila.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/fila.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/totem.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/totem.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/tecnicos.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/tecnicos.html"); } catch (err) { res.redirect("/login.html"); }});

app.get("/ping", (req, res) => { res.status(200).send("Servidor acordado!"); });

// =====================================================================
// LOGIN E GESTÃO DE EMPRESAS
// =====================================================================
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });
    if (usuarioBanco.ativo === false) return res.status(403).json({ erro: "Acesso suspenso. Contacte a administração." });
    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });
    const token = jwt.sign({ id: usuarioBanco._id, tipo: usuarioBanco.tipo, cliente_id: usuarioBanco.cliente_id }, JWT_SECRET, { expiresIn: "12h" });
    const tipoFront = usuarioBanco.tipo === "superadmin" ? "master" : usuarioBanco.tipo;
    res.json({ ok: true, token, nome: usuarioBanco.nome, tipo: tipoFront });
  } catch (err) { res.status(500).json({ erro: "Erro ao realizar login" }); }
});

app.post("/nova-empresa", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado." });
    const { empresa, nome, usuario, senha } = req.body;
    if (!empresa || !nome || !usuario || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });
    const existe = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Login já em uso." });
    const novoClienteId = new ObjectId().toString(); 
    const senhaHash = await bcrypt.hash(senha, 10);
    await db.collection("usuarios").insertOne({ cliente_id: novoClienteId, empresaNome: empresa.trim(), nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo: "master", ativo: true, criadoEm: new Date() });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao criar empresa" }); }
});

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
    if(empresaMaster) await db.collection("usuarios").updateMany({ cliente_id: empresaMaster.cliente_id }, { $set: { ativo: ativo } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.delete("/api/empresas/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado" });
    const empresaMaster = await db.collection("usuarios").findOne({ _id: new ObjectId(req.params.id) });
    if(empresaMaster && empresaMaster.cliente_id) {
        const cid = empresaMaster.cliente_id;
        for(let col of ["usuarios", "tecnicos_dashboard", "tecnicos", "estoque", "historico_estoque", "registros", "planejamento_rotas"]) await db.collection(col).deleteMany({ cliente_id: cid });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

// =====================================================================
// USUÁRIOS (AGORA CONTÉM O SUPER CADASTRO DO TÉCNICO DE ROTA)
// =====================================================================
app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master" && req.usuario?.tipo !== "superadmin") return res.status(403).json({ erro: "Permissão negada." });
    
    const { nome, usuario, senha, tipo, status, tipoVeiculo, capacidadeOS, capacidadeCaixas, cep, bairro } = req.body;
    
    const existe = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Login já em uso" });
    const senhaHash = await bcrypt.hash(senha, 10);
    
    await db.collection("usuarios").insertOne({ 
        cliente_id: req.usuario.cliente_id, 
        nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo, 
        status: status || "Ativo", tipoVeiculo, 
        capacidadeOS: Number(capacidadeOS) || 0, 
        capacidadeCaixas: Number(capacidadeCaixas) || 0, 
        cep, bairro,
        ativo: true, criadoEm: new Date() 
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Negado" });
    
    const { nome, tipo, senha, status, tipoVeiculo, capacidadeOS, capacidadeCaixas, cep, bairro } = req.body;
    
    const atualizacao = { 
        nome, tipo, status: status || "Ativo", tipoVeiculo, 
        capacidadeOS: Number(capacidadeOS) || 0, 
        capacidadeCaixas: Number(capacidadeCaixas) || 0, 
        cep, bairro 
    };
    if (senha && senha.trim() !== "") atualizacao.senha = await bcrypt.hash(senha, 10);
    
    await db.collection("usuarios").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: atualizacao });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

// =====================================================================
// ROTEIRIZADOR INTELIGENTE (SEM ALTERAÇÕES)
// =====================================================================
app.post('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, tecnico, itinerario } = req.body;
      if (!data || !tecnico || !itinerario) { return res.status(400).json({ erro: "Dados incompletos" }); }
      const itinerarioFormatado = itinerario.map(item => ({ ...item, status: item.status || 'pendente' }));
      await db.collection("planejamento_rotas").updateOne({ data: data, tecnico: tecnico, cliente_id: req.usuario.cliente_id }, { $set: { itinerario: itinerarioFormatado, atualizadoEm: new Date() } }, { upsert: true });
      res.json({ mensagem: "Roteiro salvo com sucesso!" });
  } catch (err) { res.status(500).json({ erro: "Erro ao salvar roteiro." }); }
});

app.get('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, codigo } = req.query; let filtro = { cliente_id: req.usuario.cliente_id };
      if (data) filtro.data = data;
      if (codigo) filtro["itinerario.codigo"] = new RegExp(codigo, 'i');
      const rotas = await db.collection("planejamento_rotas").find(filtro).toArray();
      res.json(rotas);
  } catch (err) { res.status(500).json({ erro: "Erro ao buscar roteiros." }); }
});

app.delete('/api/rotas/:id', autenticarToken, async (req, res) => {
  try {
      const resultado = await db.collection("planejamento_rotas").deleteOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id });
      if (resultado.deletedCount === 1) res.json({ ok: true }); else res.status(404).json({ erro: "Não encontrada" });
  } catch (err) { res.status(500).json({ erro: "Erro ao excluir." }); }
});

app.put('/api/rotas/status', autenticarToken, async (req, res) => {
    try {
        const { data, tecnico, codigoOs, novoStatus, campoTempo, valorTempo } = req.body;
        let filterDoc = { data: data, tecnico: new RegExp(`^${tecnico}$`, 'i'), cliente_id: req.usuario.cliente_id, "itinerario.codigo": { $in: [codigoOs, String(codigoOs), Number(codigoOs)] } };
        let atualizacao = { "itinerario.$.status": novoStatus };
        if (campoTempo && valorTempo) atualizacao[`itinerario.$.${campoTempo}`] = valorTempo;
        const resultado = await db.collection("planejamento_rotas").updateOne(filterDoc, { $set: atualizacao });
        if (resultado.matchedCount > 0) res.json({ ok: true }); else res.status(400).json({ erro: "Paragem não encontrada" });
    } catch (err) { res.status(500).json({ erro: "Erro ao atualizar status." }); }
});

app.put('/api/rotas/endereco', autenticarToken, async (req, res) => {
    try {
        const { data, tecnico, codigoOs, novoEndereco, lat, lon } = req.body;
        let filterDoc = { data: data, tecnico: new RegExp(`^${tecnico}$`, 'i'), cliente_id: req.usuario.cliente_id, "itinerario.codigo": { $in: [codigoOs, String(codigoOs), Number(codigoOs)] } };
        let atualizacao = { "itinerario.$.rua": novoEndereco, "itinerario.$.lat": lat, "itinerario.$.lon": lon, "itinerario.$.precisaCorrecao": false };
        const resultado = await db.collection("planejamento_rotas").updateOne(filterDoc, { $set: atualizacao });
        if (resultado.matchedCount > 0) res.json({ ok: true }); else res.status(400).json({ erro: "Paragem não encontrada." });
    } catch (err) { res.status(500).json({ erro: "Erro ao salvar novo endereço." }); }
});

// =====================================================================
// TÉCNICOS DASHBOARD (REVERTIDO PARA O BÁSICO DE CONTROLE DE FROTA)
// =====================================================================
app.get("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { res.json(await db.collection("tecnicos_dashboard").find(getFiltroSaaS(req)).sort({ nome: 1 }).toArray()); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.post("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { const { nome, status, telefone, email, veiculo, placa } = req.body; const existe = await db.collection("tecnicos_dashboard").findOne({ nome: nome.trim(), cliente_id: req.usuario.cliente_id }); if (existe) return res.status(400).json({ erro: "Técnico já registado" }); await db.collection("tecnicos_dashboard").insertOne({ cliente_id: req.usuario.cliente_id, nome: nome.trim(), status: status || "Ativo", telefone, email, veiculo, placa, criadoEm: new Date() }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.put("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos_dashboard").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: { nome: req.body.nome.trim(), status: req.body.status, telefone: req.body.telefone, email: req.body.email, veiculo: req.body.veiculo, placa: req.body.placa } }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.delete("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos_dashboard").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });

// =====================================================================
// ESTOQUE E REGISTROS
// =====================================================================
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
    
    const defaultClienteId = "neri_matriz_01";
    for (let col of ["usuarios", "tecnicos", "tecnicos_dashboard", "estoque", "historico_estoque", "registros", "planejamento_rotas"]) {
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

// ==========================================
// FILA E TOTEM
// ==========================================
app.get('/api/equipe-totem', autenticarToken, async (req, res) => {
    try { const equipe = await db.collection("equipe_totem").find({ cliente_id: req.usuario.cliente_id }).toArray(); res.json(equipe); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/equipe-totem', autenticarToken, async (req, res) => {
    try { const { nome, funcao } = req.body; await db.collection("equipe_totem").insertOne({ cliente_id: req.usuario.cliente_id, nome, funcao }); res.json({ok: true}); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/equipe-totem/:id', autenticarToken, async (req, res) => {
    try { const { nome, funcao } = req.body; await db.collection("equipe_totem").updateOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, { $set: { nome, funcao } }); res.json({ok: true}); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.delete('/api/equipe-totem/:id', autenticarToken, async (req, res) => {
    try { await db.collection("equipe_totem").deleteOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }); res.json({ok: true}); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.get('/api/config-base', autenticarToken, async (req, res) => {
    try { let config = await db.collection("configuracoes").findOne({ cliente_id: req.usuario.cliente_id }); if (!config) config = { limiteAtraso: "08:00" }; res.json(config); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/config-base', autenticarToken, async (req, res) => {
    try { const { limiteAtraso } = req.body; await db.collection("configuracoes").updateOne({ cliente_id: req.usuario.cliente_id }, { $set: { limiteAtraso } }, { upsert: true }); res.json({ ok: true }); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/fila/bipar', autenticarToken, async (req, res) => {
    try {
        const { codigoBarras, horaBatida, dataBatida } = req.body;
        const pessoa = await db.collection("equipe_totem").findOne({ nome: new RegExp(`^${codigoBarras}$`, 'i'), cliente_id: req.usuario.cliente_id });
        if (!pessoa) return res.status(404).json({ erro: "Crachá não reconhecido na Base!" });

        let config = await db.collection("configuracoes").findOne({ cliente_id: req.usuario.cliente_id });
        const limite = config && config.limiteAtraso ? config.limiteAtraso : "08:00";
        let atrasado = horaBatida > limite;
        
        await db.collection("fila_ponto").insertOne({ cliente_id: req.usuario.cliente_id, tecnico: pessoa.nome, data: dataBatida, horaChegada: horaBatida, status: "Aguardando", atrasado: atrasado, timestamp: new Date() });
        res.json({ ok: true, tecnico: pessoa.nome, atrasado });
    } catch(e) { res.status(500).json({erro: "Erro no servidor."}); }
});

app.get('/api/fila/hoje', autenticarToken, async (req, res) => {
    try { const dataHoje = req.query.data; const fila = await db.collection("fila_ponto").find({ cliente_id: req.usuario.cliente_id, data: dataHoje, status: { $ne: "Finalizado" } }).sort({ timestamp: 1 }).toArray(); res.json(fila); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.get('/api/fila/relatorio', autenticarToken, async (req, res) => {
    try { const { mesAno, tecnico } = req.query; let filtro = { cliente_id: req.usuario.cliente_id, data: new RegExp(`/${mesAno}$`) }; if (tecnico && tecnico !== "TODOS") filtro.tecnico = tecnico; const historico = await db.collection("fila_ponto").find(filtro).sort({ timestamp: 1 }).toArray(); res.json(historico); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/fila/:id/status', autenticarToken, async (req, res) => {
    try { const { status } = req.body; await db.collection("fila_ponto").updateOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, { $set: { status } }); res.json({ok: true}); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/fila/:id/chamar-totem', autenticarToken, async (req, res) => {
    try { await db.collection("fila_ponto").updateOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, { $set: { chamando_totem: true, status: "Atendido" } }); res.json({ok: true}); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.get('/api/totem/chamadas', autenticarToken, async (req, res) => {
    try { const chamadas = await db.collection("fila_ponto").find({ cliente_id: req.usuario.cliente_id, chamando_totem: true }).toArray(); res.json(chamadas); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/fila/:id/chamada-concluida', autenticarToken, async (req, res) => {
    try { await db.collection("fila_ponto").updateOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, { $set: { chamando_totem: false } }); res.json({ok: true}); } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/acessar-empresa/:id', autenticarToken, async (req, res) => {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({erro: "Acesso Negado"});
    const empresa = await db.collection("usuarios").findOne({ _id: new ObjectId(req.params.id) });
    if (!empresa) return res.status(404).json({erro: "Empresa não encontrada"});
    const tokenNovo = jwt.sign({ id: req.usuario.id, tipo: "master", cliente_id: empresa.cliente_id, superadmin_original: true }, process.env.JWT_SECRET || "NERI_SECRET_2026", { expiresIn: "12h" });
    res.json({ ok: true, token: tokenNovo, nome: empresa.empresaNome });
});

app.post('/api/voltar-admin', autenticarToken, async (req, res) => {
    if (!req.usuario.superadmin_original) return res.status(403).json({erro: "Negado"});
    const tokenNovo = jwt.sign({ id: req.usuario.id, tipo: "superadmin", cliente_id: "GLOBAL_SYSTEM" }, process.env.JWT_SECRET || "NERI_SECRET_2026", { expiresIn: "12h" });
    res.json({ ok: true, token: tokenNovo });
});

iniciarSistema();