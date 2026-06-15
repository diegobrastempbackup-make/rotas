const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

// =================================================================
// CONFIGURAÇÃO DO BANCO DE DADOS (MONGO ATLAS / LOCAL)
// =================================================================
// Correção: Ajustado o protocolo para 'mongodb+srv://' para o perfeito funcionamento com o Atlas
const uri = process.env.MONGO_URI || "mongodb+srv://diegobrastempbackup_db_user:app123@cluster0.tp1g94v.mongodb.net/rotas?retryWrites=true&w=majority&authSource=admin";

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let db = null;

async function conectarBanco() {
  try {
    await client.connect();
    db = client.db("rotas"); 
    console.log("=> Conectado com sucesso ao MongoDB Atlas (Banco: rotas)!");
  } catch (err) {
    console.error("x Erro crítico ao conectar ao MongoDB:", err);
    process.exit(1);
  }
}
conectarBanco();

// =================================================================
// MIDDLEWARES
// =================================================================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// =================================================================
// ROTAS DE INTERFACE / PROTEÇÃO DE ACESSO
// =================================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/dados.html", (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(path.join(__dirname, "public/dados.html"));
  } catch (err) {
    res.redirect("/login.html");
  }
});

app.get("/estoque.html", (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(path.join(__dirname, "public/estoque.html"));
  } catch (err) {
    res.redirect("/login.html");
  }
});

// Middleware de autenticação das requisições de API
function verificarTokenAPI(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
  try {
    const verificado = jwt.verify(token, JWT_SECRET);
    req.usuarioLogado = verificado;
    next();
  } catch (err) {
    res.status(403).json({ erro: "Token inválido ou expirado." });
  }
}

// =================================================================
// ENDPOINTS — AUTENTICAÇÃO E USUÁRIOS
// =================================================================

app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });

    if (!usuarioBanco) return res.status(401).json({ erro: "Usuário não encontrado" });

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });

    const token = jwt.sign(
      { id: usuarioBanco._id, tipo: usuarioBanco.tipo },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      usuario: { nome: usuarioBanco.nome, usuario: usuarioBanco.usuario, tipo: usuarioBanco.tipo }
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

app.get("/api/usuarios", verificarTokenAPI, async (req, res) => {
  try {
    const lista = await db.collection("usuarios").find({}, { projection: { senha: 0 } }).toArray();
    res.json(lista);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar usuários" });
  }
});

app.post("/api/usuarios", verificarTokenAPI, async (req, res) => {
  try {
    const { id, _id, nome, usuario, senha, tipo } = req.body;
    const idUnificado = id || _id;
    const usernameFormatado = usuario.toLowerCase().trim();

    // Cenário Edição/Atualização
    if (idUnificado && idUnificado !== "undefined" && idUnificado !== "") {
      const dadosUpdate = { nome, usuario: usernameFormatado, tipo };
      if (senha && senha.trim() !== "") {
        dadosUpdate.senha = await bcrypt.hash(senha, 10);
      }
      await db.collection("usuarios").updateOne(
        { _id: new ObjectId(idUnificado) },
        { $set: dadosUpdate }
      );
      return res.json({ ok: true });
    }

    // Cenário Novo Cadastro — Impedir usuário com login duplicado
    const usuarioExistente = await db.collection("usuarios").findOne({ usuario: usernameFormatado });
    if (usuarioExistente) {
      return res.status(400).json({ erro: "Este nome de usuário já está cadastrado!" });
    }

    if (!senha) return res.status(400).json({ erro: "Senha obrigatória para novo usuário" });
    const hash = await bcrypt.hash(senha, 10);
    
    await db.collection("usuarios").insertOne({
      nome,
      usuario: usernameFormatado,
      senha: hash,
      tipo
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao processar usuário" });
  }
});

app.delete("/api/usuarios/:id", verificarTokenAPI, async (req, res) => {
  try {
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ erro: "Erro ao deletar usuário" });
  }
});

// =================================================================
// ENDPOINTS — REGISTROS GERAIS DO DASHBOARD (DADOS.HTML)
// =================================================================

app.get("/api/registros", verificarTokenAPI, async (req, res) => {
  try {
    const registros = await db.collection("registros").find().toArray();
    res.json(registros);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar registros" });
  }
});

app.post("/api/registros", verificarTokenAPI, async (req, res) => {
  try {
    // Evita duplicações idênticas enviadas por cliques múltiplos seguidos
    const ultimoRegistro = await db.collection("registros").findOne({}, { sort: { _id: -1 } });
    if (ultimoRegistro && 
        ultimoRegistro.tecnico === req.body.tecnico && 
        ultimoRegistro.km === req.body.km && 
        ultimoRegistro.valor === req.body.valor &&
        ultimoRegistro.data === req.body.data) {
      return res.status(400).json({ erro: "Registro idêntico detectado recentemente para evitar duplicidade." });
    }

    const resultado = await db.collection("registros").insertOne(req.body);
    res.json(resultado);
  } catch {
    res.status(500).json({ erro: "Erro ao inserir registro" });
  }
});

// =================================================================
// ENDPOINTS — GESTÃO DE ESTOQUE (ESTOQUE.HTML)
// =================================================================

app.get("/api/estoque", verificarTokenAPI, async (req, res) => {
  try {
    const estoque = await db.collection("estoque").find().toArray();
    res.json(estoque);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar estoque" });
  }
});

app.post("/api/estoque", verificarTokenAPI, async (req, res) => {
  try {
    const { id, _id, nome, preco, qtd } = req.body;
    const idUnificado = id || _id;
    const nomeFormatado = nome.trim();

    const ferramentaDados = {
      nome: nomeFormatado,
      preco: Number(preco) || 0,
      qtd: Number(qtd) || 0
    };

    // Cenário Edição/Atualização por ID
    if (idUnificado && idUnificado !== "undefined" && idUnificado !== "") {
      await db.collection("estoque").updateOne(
        { _id: new ObjectId(idUnificado) },
        { $set: ferramentaDados }
      );
      return res.json({ ok: true });
    }

    // Cenário Novo Cadastro — Segurança Antiduplicação por Nome
    const ferramentaExistente = await db.collection("estoque").findOne({ nome: new RegExp(`^${nomeFormatado}$`, "i") });
    if (ferramentaExistente) {
      // Se já existe uma ferramenta com esse nome, apenas soma a quantidade para não duplicar linhas
      await db.collection("estoque").updateOne(
        { _id: ferramentaExistente._id },
        { $set: { preco: ferramentaDados.preco }, $inc: { qtd: ferramentaDados.qtd } }
      );
      return res.json({ ok: true, msg: "Quantidade incrementada no item existente." });
    }

    await db.collection("estoque").insertOne(ferramentaDados);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao salvar item no estoque" });
  }
});

app.delete("/api/estoque/:id", verificarTokenAPI, async (req, res) => {
  try {
    await db.collection("estoque").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ erro: "Erro ao excluir ferramenta" });
  }
});

app.get("/api/estoque/historico/:tecnico", verificarTokenAPI, async (req, res) => {
  try {
    const tecnicoNome = req.params.tecnico;
    const logs = await db.collection("historico_estoque")
                         .find({ tecnico: tecnicoNome })
                         .sort({ data: -1 })
                         .toArray();
    res.json(logs);
  } catch {
    res.status(500).json({ erro: "Erro ao carregar histórico" });
  }
});

app.post("/api/estoque/historico", verificarTokenAPI, async (req, res) => {
  try {
    const { tecnico, ferramentaId, ferramentaNome, qtd, tipoAcao, observacao } = req.body;
    const qtdMovimentada = Number(qtd) || 0;
    const fId = new ObjectId(ferramentaId);

    const ferramenta = await db.collection("estoque").findOne({ _id: fId });
    if (!ferramenta) return res.status(404).json({ erro: "Ferramenta não localizada no estoque." });

    let novaQtd = ferramenta.qtd;

    if (tipoAcao === "Entrega" || tipoAcao === "Troca") {
      if (ferramenta.qtd < qtdMovimentada) {
        return res.status(400).json({ erro: `Saldo insuficiente! Estoque atual: ${ferramenta.qtd}` });
      }
      novaQtd -= qtdMovimentada;
    } else if (tipoAcao === "Devolução") {
      novaQtd += qtdMovimentada;
    }

    await db.collection("estoque").updateOne({ _id: fId }, { $set: { qtd: novaQtd } });

    await db.collection("historico_estoque").insertOne({
      tecnico,
      ferramentaId: fId,
      ferramentaNome,
      qtd: qtdMovimentada,
      tipoAcao,
      observacao: observacao || "",
      data: new Date()
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno ao processar a movimentação." });
  }
});

// INICIALIZAÇÃO DO SERVIDOR WEB
app.listen(PORT, () => {
  console.log(`=> NERI Backend rodando perfeitamente na porta ${PORT}`);
});