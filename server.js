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

// MIDDLEWARE DE AUTENTICAÇÃO REVISADO
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Aceita tanto 'Bearer <token>' quanto '<token>' puro para evitar quebras de compatibilidade
  const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

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

// --- API: ROTAS DO SISTEMA (BACK-END) ---
// LOGIN REPARADO E SEGURO
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    
    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Preencha todos os campos" });
    }

    const usuarioLimpo = usuario.toLowerCase().trim();

    // 1. CONTA MASTER FIXA DE RECOVERY (Garante seu acesso imediato mesmo se o banco falhar)
    if (usuarioLimpo === "neri" && senha === "admin123") {
      const token = jwt.sign(
        { id: "master_recovery", tipo: "master" },
        JWT_SECRET,
        { expiresIn: "12h" }
      );
      return res.json({
        ok: true,
        token,
        nome: "NERI MASTER",
        tipo: "master"
      });
    }

    // 2. CASO NÃO SEJA O MASTER FIXO, BUSCA OS OUTROS USUÁRIOS NO BANCO (Danilo, Sibele, etc.)
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuarioLimpo });

    if (!usuarioBanco) {
      return res.status(401).json({ erro: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha incorrecta" });
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
    console.error("Erro no login:", err);
    res.status(500).json({ erro: "Erro ao realizar login" });
  }
});

// CADASTRO DE USUÁRIOS
app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master") {
      return res.status(403).json({ erro: "Você não tem permissão para cadastrar usuários." });
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
    console.error(err);
    res.status(500).json({ erro: "Erro ao cadastrar usuário" });
  }
});

// LISTAGEM E GERENCIAMENTO DE USUÁRIOS
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
      return res.status(403).json({ erro: "Você não tem permissão para editar usuários!" });
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

// ROTAS LEGADAS DE USUÁRIO (Para compatibilidade se houver chamadas antigas)
app.put("/usuario/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, tipo, novaSenha } = req.body;
    let dadosAtualizados = { nome, tipo };

    if (novaSenha && novaSenha.trim() !== "") {
      dadosAtualizados.senha = await bcrypt.hash(novaSenha, 10);
    }

    await db.collection("usuarios").updateOne({ _id: new ObjectId(id) }, { $set: dadosAtualizados });
    res.json({ ok: true, message: "Usuário atualizado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar usuário" });
  }
});

app.delete("/usuario/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master") {
      return res.status(403).json({ erro: "Você não tem permissão para excluir usuários!" });
    }
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir usuário" });
  }
});

// =================================================================
// GESTÃO DE TÉCNICOS (MÓDULO DE FROTAS / COMBUSTÍVEL)
// =================================================================

// 1. LISTAR TODOS OS TÉCNICOS DA FROTA
app.get("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const tecnicos = await db.collection("tecnicos").find().sort({ nome: 1 }).toArray();
    res.json(tecnicos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao listar técnicos" });
  }
});

// 2. LISTAR APENAS OS TÉCNICOS ATIVOS DA FROTA (Usado nos Dropdowns de dados e dashboards)
app.get("/api/tecnicos/ativos", autenticarToken, async (req, res) => {
  try {
    const listaTecnicos = await db.collection("tecnicos")
      .find({ status: { $ne: "Inativo" } })
      .sort({ nome: 1 })
      .toArray();
    res.json(listaTecnicos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao carregar técnicos ativos." });
  }
});

// 3. ADICIONAR TÉCNICO NA FROTA
app.post("/api/tecnicos", autenticarToken, async (req, res) => {
  try {
    const nome = (req.body.nome || "").trim();
    if (!nome) return res.status(400).json({ erro: "Nome obrigatório" });

    const existe = await db.collection("tecnicos").findOne({ nome });
    if (existe) return res.status(400).json({ erro: "Técnico já cadastrado" });

    const resultado = await db.collection("tecnicos").insertOne({ 
      nome, 
      status: "Ativo",
      criadoEm: new Date() 
    });
    res.json({ ok: true, id: resultado.insertedId });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao cadastrar técnico" });
  }
});

// 4. EXCLUIR TÉCNICO DA FROTA
app.delete("/api/tecnicos/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("tecnicos").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir técnico" });
  }
});

// =================================================================
// GESTÃO DE ESTOQUE
// =================================================================

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
    res.status(500).json({ erro: "Erro ao salvar item no estoque" });
  }
});

app.put("/api/estoque/:id", autenticarToken, async (req, res) => {
  try {
    await db.collection("estoque").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: {
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
    await db.collection("estoque").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir item do estoque" });
  }
});

app.get("/api/estoque/historico", autenticarToken, async (req, res) => {
  try {
    const logs = await db.collection("estoque_historico").find().sort({ data: -1 }).toArray();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar histórico do estoque." });
  }
});

// =================================================================
// REGISTROS DA PLANILHA (SISTEMA DE COMBUSTÍVEL)
// =================================================================

app.get("/api/registros", autenticarToken, async (req, res) => {
  try {
    const registros = await db.collection("registros").find().toArray();
    res.json(registros);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar registros" });
  }
});

app.post("/api/registros", autenticarToken, async (req, res) => {
  try {
    const dados = req.body;
    if (!Array.isArray(dados) || dados.length === 0) {
      return res.status(400).json({ erro: "Dados inválidos." });
    }

    const operacoes = dados.map(item => {
      if (item._id) {
        const id = item._id;
        delete item._id;
        return {
          updateOne: {
            filter: { _id: new ObjectId(id) },
            update: { $set: item }
          }
        };
      }
      
      const dataLimpa = item.data ? String(item.data).split("T")[0] : null;
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

app.delete("/registro/:id", autenticarToken, async (req, res) => {
  try {
    const resultado = await db.collection("registros").deleteOne({ _id: new ObjectId(req.params.id) });
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

// INICIALIZAÇÃO DO SERVIDOR
async function iniciarSistema() {
  try {
    console.log("🔄 Conectando ao MongoDB Atlas...");
    await client.connect();
    db = client.db("neri_sistema");
    console.log("✅ Conectado com sucesso ao Banco de Dados.");
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando com sucesso na porta: ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Falha crítica ao iniciar o servidor:", err);
    process.exit(1);
  }
}

iniciarSistema();