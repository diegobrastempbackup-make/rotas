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

// ==========================================
// --- ROTAS DE PÁGINAS (FRONT-END) ---
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/dados.html", (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(__dirname + "/public/dados.html");
  } catch (err) {
    res.redirect("/login.html");
  }
});

app.get("/estoque.html", (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(__dirname + "/public/estoque.html");
  } catch (err) {
    res.redirect("/login.html");
  }
});

app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/public/index.html"));

// ==========================================
// --- API: ROTAS DO SISTEMA (BACK-END) ---
// ==========================================

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Preencha usuário e senha" });
    }

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

// CADASTRO
app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
     if (req.usuario?.tipo !== "master") {
        return res.status(403).json({
            erro: "Somente usuários MASTER podem cadastrar usuários."
        });
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

// LISTAGEM DE USUÁRIOS
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

app.delete("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master") {
      return res.status(403).json({ erro: "Somente Master pode excluir usuários" });
    }
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir usuário" });
  }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master") {
      return res.status(403).json({ erro: "Somente Master pode editar usuários" });
    }

    const { nome, tipo, senha } = req.body;
    const atualizacao = { nome, tipo };

    if (senha && senha.trim() !== "") {
      atualizacao.senha = await bcrypt.hash(senha, 10);
    }

    await db.collection("usuarios").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: atualizacao }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao editar usuário" });
  }
});

// ATUALIZAR USUÁRIO V2
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

    res.json({ ok: true, message: "Usuário updated!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: "Erro ao atualizar usuário" });
  }
});

app.delete("/usuario/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master") {
      return res.status(403).json({ erro: "Somente Master pode excluir usuários." });
    }
    const { id } = req.params;
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(id) });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir usuário" });
  }
});

// =========================
// TÉCNICOS
// =========================

app.get("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const tecnicos = await db.collection("tecnicos").find().sort({ nome: 1 }).toArray();
    res.json(tecnicos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao listar técnicos" });
  }
});

app.post("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const nome = (req.body.nome || "").trim();
    if (!nome) return res.status(400).json({ erro: "Nome obrigatório" });

    const existe = await db.collection("tecnicos").findOne({ nome });
    if (existe) return res.status(400).json({ erro: "Técnico já cadastrado" });

    const resultado = await db.collection("tecnicos").insertOne({ nome, criadoEm: new Date() });
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao cadastrar técnico" });
  }
});

app.delete("/api/tecnicos/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("tecnicos").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir técnico" });
  }
});

// =========================
// ESTOQUE
// =========================

const estoqueHandler = async (req, res) => {
  try {
    const estoque = await db.collection("estoque").find().toArray();
    res.json(estoque);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar estoque" });
  }
};
app.get("/api/estoque", autenticarToken, estoqueHandler);
app.get("/estoque", autenticarToken, estoqueHandler);

app.post("/api/estoque", autenticarToken, async (req, res) => {
  try {
    const novoItem = {
      codigo: req.body.codigo || "",
      nome: req.body.nome || "",
      categoria: req.body.categoria || "",
      localizacao: req.body.localizacao || "",
      preco: Number(req.body.preco) || 0,
      qtd: Number(req.body.qtd) || 0,
      criadoEm: new Date()
    };
    const resultado = await db.collection("estoque").insertOne(novoItem);
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao salvar item" });
  }
});

app.put("/api/estoque/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("estoque").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          codigo: req.body.codigo,
          nome: req.body.nome,
          categoria: req.body.categoria,
          localizacao: req.body.localizacao,
          preco: Number(req.body.preco) || 0,
          qtd: Number(req.body.qtd) || 0
        }
      }
    );
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao editar item" });
  }
});

app.delete("/api/estoque/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("estoque").deleteOne({ _id: new ObjectId(id) });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir item" });
  }
});

const historicoEstoqueHandler = async (req, res) => {
  try {
    const historico = await db.collection("historico_estoque").find().toArray();
    res.json(historico);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar histórico do estoque" });
  }
};
app.get("/api/estoque/historico", autenticarToken, historicoEstoqueHandler);
app.get("/estoque/historico", autenticarToken, historicoEstoqueHandler);

app.get("/api/estoque/historico/:nome", autenticarToken, async (req, res) => {
  try {
    const logs = await db.collection("historico_estoque").find({ tecnico: req.params.nome }).sort({ data: -1 }).toArray();
    res.json(logs);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao buscar histórico" });
  }
});

app.post("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {
    const { ferramentaId, quantidade, tipoAcao } = req.body;

    if (ferramentaId && (tipoAcao === "Entrega" || tipoAcao === "Troca")) {
      const item = await db.collection("estoque").findOne({ _id: new ObjectId(ferramentaId) });
      if (!item) return res.status(404).json({ erro: "Item não encontrado no estoque." });

      const saldoAtual = Number(item.qtd || 0);
      const qtdSolicitada = Number(quantidade || 0);

      if (qtdSolicitada > saldoAtual) {
        return res.status(400).json({ erro: `Estoque insuficiente. Disponível: ${saldoAtual}` });
      }
    }

    await db.collection("historico_estoque").insertOne(req.body);

    if (ferramentaId) {
      let ajuste = 0;
      if (tipoAcao === "Entrega") ajuste = -Number(quantidade);
      if (tipoAcao === "Devolução" || tipoAcao === "Devolucao") ajuste = Number(quantidade);
      if (tipoAcao === "Troca") ajuste = -Number(quantidade);

      await db.collection("estoque").updateOne(
        { _id: new ObjectId(ferramentaId) },
        { $inc: { qtd: ajuste } }
      );
    }
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao gravar histórico" });
  }
});

// ==========================================
// --- REGISTROS (TELA DADOS / FROTAS) ---
// ==========================================

const registrosHandler = async (req, res) => {
  try {
    // Busca os registros e garante compatibilidade mapeando o formato de data caso necessário
    const dados = await db.collection("registros").find().sort({ data: 1 }).toArray();
    
    // Mapeamento de segurança: se o front-end esperar estritamente string YYYY-MM-DD,
    // garantimos que o campo '.data' seja entregue de forma inteligível para o app.js antigo
    const dadosTratados = dados.map(item => {
      if (item.data && item.data instanceof Date) {
        // Converte de volta para string limpa no formato que o front original consumia
        item.data = item.data.toISOString().split('T')[0];
      }
      return item;
    });

    res.json(dadosTratados);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar registros" });
  }
};
app.get("/registros", autenticarToken, registrosHandler);
app.get("/api/registros", autenticarToken, registrosHandler);

// SALVAMENTO RETIFICADO COM COMPATIBILIDADE PLENA (Não sobrescreve e aceita leitura do app.js original)
app.post("/registro", autenticarToken, async (req, res) => {
  try {
    let dados = req.body.dados || [];
    if (dados.length === 0) return res.status(400).json({ erro: "Nenhum dado informado" });

    const operacoes = dados.map(item => {
      // Cria a string limpa YYYY-MM-DD que o front usa para renderizar nas tabelas
      const dataLimpaStr = item.data ? String(item.data).split('T')[0] : new Date().toISOString().split('T')[0];

      if (item._id) {
        const idExistente = new ObjectId(item._id);
        delete item._id; 
        
        // Mantemos a estrutura em formato texto puro para o front original conseguir ler sem falhar
        item.data = dataLimpaStr; 

        return {
          updateOne: {
            filter: { _id: idExistente },
            update: { $set: item },
            upsert: false
          }
        };
      } else {
        // Geração de ID exclusivo por registro para acabar com o bug de sobrescrever o mesmo dia
        const novoId = new ObjectId();
        item.data = dataLimpaStr;
        item.dataRegistroOriginal = new Date(); // Salva a hora exata em segundo plano para auditoria

        return {
          updateOne: {
            filter: { _id: novoId },
            update: { $set: item },
            upsert: true
          }
        };
      }
    });

    await db.collection("registros").bulkWrite(operacoes);
    res.json({ ok: true, mensagem: "Lançamentos salvos com sucesso!" });
  } catch (err) {
    console.error("Erro ao salvar registros:", err);
    res.status(500).json({ erro: "Erro ao salvar dados" });
  }
});

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

// Arquivos estáticos da pasta public
app.use(express.static(__dirname + "/public", { index: false }));

// INICIALIZAÇÃO SINCRONIZADA E SEGURA
async function iniciarSistema() {
  try {
    console.log("🔄 Conectando ao MongoDB Atlas...");
    await client.connect();
    
    // Conecta exatamente na database correta que o front antigo busca os dados
    db = client.db("neriFrotas");
    console.log("✅ Mongo conectado com sucesso na database 'neriFrotas'!");

    // TRAVA DE SEGURANÇA ADMINISTRATIVA
    const totalUsuarios = await db.collection("usuarios").countDocuments();
    if (totalUsuarios === 0) {
      console.log("⚠️ Nenhum usuário encontrado. Criando usuário master de emergência...");
      const senhaHash = await bcrypt.hash("admin123", 10);
      await db.collection("usuarios").insertOne({
        nome: "Diego Neri",
        usuario: "diego",
        senha: senhaHash,
        tipo: "master",
        ativo: true,
        criadoEm: new Date()
      });
      console.log("✅ Usuário Master inicial criado: login 'diego' / senha 'admin123'");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor NERI rodando perfeitamente na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro crítico ao conectar ao MongoDB:", err);
    process.exit(1);
  }
}

iniciarSistema();