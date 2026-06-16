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

// LISTAGEM DE USUÁRIOS (Mapeado para responder em ambas as variações de chamada)
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
      return res.status(403).json({
        erro: "Somente Master pode excluir usuários"
      });
    }

    await db.collection("usuarios").deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({
      ok: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: "Erro ao excluir usuário"
    });
  }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {

    if (req.usuario.tipo !== "master") {
      return res.status(403).json({
        erro: "Somente Master pode editar usuários"
      });
    }

    const { nome, tipo, senha } = req.body;

    const atualizacao = {
      nome,
      tipo
    };

    if (senha && senha.trim() !== "") {
      atualizacao.senha = await bcrypt.hash(senha, 10);
    }

    await db.collection("usuarios").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: atualizacao }
    );

    res.json({
      ok: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: "Erro ao editar usuário"
    });
  }
});

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

app.delete("/usuario/:id", autenticarToken, async (req, res) => {
  try {

    if (req.usuario?.tipo !== "master") {
      return res.status(403).json({
        erro: "Somente Master pode excluir usuários."
      });
    }

    const { id } = req.params;

    await db.collection("usuarios").deleteOne({
      _id: new ObjectId(id)
    });

    res.json({
      ok: true
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: "Erro ao excluir usuário"
    });
  }
});

// =========================
// TÉCNICOS
// =========================

// LISTAR TÉCNICOS
app.get("/api/tecnicos", autenticarToken, async (req, res) => {
  try {

    const tecnicos = await db
      .collection("tecnicos")
      .find()
      .sort({ nome: 1 })
      .toArray();

    res.json(tecnicos);

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao listar técnicos"
    });
  }
});

// CADASTRAR TÉCNICO
app.post("/api/tecnicos", autenticarToken, async (req, res) => {
  try {

    const nome = (req.body.nome || "").trim();

    if (!nome) {
      return res.status(400).json({
        erro: "Nome obrigatório"
      });
    }

    const existe = await db
      .collection("tecnicos")
      .findOne({ nome });

    if (existe) {
      return res.status(400).json({
        erro: "Técnico já cadastrado"
      });
    }

    const resultado = await db
      .collection("tecnicos")
      .insertOne({
        nome,
        criadoEm: new Date()
      });

    res.json({
      ok: true,
      id: resultado.insertedId
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao cadastrar técnico"
    });
  }
});

// EXCLUIR TÉCNICO
app.delete("/api/tecnicos/:id", autenticarToken, async (req, res) => {
  try {

    await db.collection("tecnicos").deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({
      ok: true
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao excluir técnico"
    });
  }
});

// ESTOQUE
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
// CADASTRAR ITEM
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

    const resultado = await db
      .collection("estoque")
      .insertOne(novoItem);

    res.json({
      ok: true,
      id: resultado.insertedId
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao salvar item"
    });
  }
});

// EDITAR ITEM
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
    res.status(500).json({
      erro: "Erro ao editar item"
    });
  }
});

// EXCLUIR ITEM
app.delete("/api/estoque/:id", autenticarToken, async (req, res) => {
  try {

    const { id } = req.params;

    await db.collection("estoque").deleteOne({
      _id: new ObjectId(id)
    });

    res.json({ ok: true });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao excluir item"
    });
  }
});
// HISTÓRICO DE ESTOQUE
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

// HISTÓRICO POR TÉCNICO
app.get("/api/estoque/historico/:nome", autenticarToken, async (req, res) => {
  try {

    const logs = await db
      .collection("historico_estoque")
      .find({
        tecnico: req.params.nome
      })
      .sort({ data: -1 })
      .toArray();

    res.json(logs);

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao buscar histórico"
    });
  }
});

// SALVAR MOVIMENTAÇÃO
app.post("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {

    const {
      ferramentaId,
      quantidade,
      tipoAcao
    } = req.body;

    // Verifica estoque antes de entregar ou trocar
    if (
      ferramentaId &&
      (tipoAcao === "Entrega" || tipoAcao === "Troca")
    ) {

      const item = await db.collection("estoque").findOne({
        _id: new ObjectId(ferramentaId)
      });

      if (!item) {
        return res.status(404).json({
          erro: "Item não encontrado no estoque."
        });
      }

      const saldoAtual = Number(item.qtd || 0);
      const qtdSolicitada = Number(quantidade || 0);

      if (qtdSolicitada > saldoAtual) {
        return res.status(400).json({
          erro: `Estoque insuficiente. Disponível: ${saldoAtual}`
        });
      }
    }

    // Grava histórico
    await db
      .collection("historico_estoque")
      .insertOne(req.body);

    // Atualiza saldo do estoque
    if (ferramentaId) {

      let ajuste = 0;

      if (tipoAcao === "Entrega") {
        ajuste = -Number(quantidade);
      }

      if (
        tipoAcao === "Devolução" ||
        tipoAcao === "Devolucao"
      ) {
        ajuste = Number(quantidade);
      }

      if (tipoAcao === "Troca") {
        ajuste = -Number(quantidade);
      }

      await db.collection("estoque").updateOne(
        { _id: new ObjectId(ferramentaId) },
        { $inc: { qtd: ajuste } }
      );
    }

    res.json({
      ok: true
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao gravar histórico"
    });
  }
});

// REGISTROS
const registrosHandler = async (req, res) => {
  try {
    const dados = await db.collection("registros").find().sort({ data: 1 }).toArray();
    res.json(dados);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar registros" });
  }
};
app.get("/registros", autenticarToken, registrosHandler);
app.get("/api/registros", autenticarToken, registrosHandler);

// SALVAR REGISTRO
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

// APAGAR REGISTRO
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

// INICIALIZAÇÃO SINCRONIZADA SEGURO
async function iniciarSistema() {
  try {
    console.log("🔄 Conectando ao MongoDB Atlas...");
    await client.connect();
    db = client.db("rotas");
    console.log("✅ Mongo conectado com sucesso!");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor NERI rodando perfeitamente na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro crítico ao conectar ao MongoDB:", err);
    process.exit(1);
  }
}

iniciarSistema();