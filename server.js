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

// HOME (Entrega a tela de login)
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

// ==========================================
// --- INTERFACE DE DADOS / OPERAÇÕES ---
// ==========================================

// BUSCAR HISTÓRICO COMPLETO
app.get("/api/registros", autenticarToken, async (req, res) => {
  try {
    const dados = await db.collection("registros").find().toArray();
    res.json(dados);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar dados históricos" });
  }
});

// SALVAR OU ATUALIZAR REGISTROS (COM TRAVA DE DUPLICADOS CORRIGIDA)
app.post("/api/salvar", autenticarToken, async (req, res) => {
  try {
    const dadosParaSalvar = req.body;

    if (!Array.isArray(dadosParaSalvar) || dadosParaSalvar.length === 0) {
      return res.status(400).json({ erro: "Nenhum dado enviado ou formato inválido." });
    }

    // Monta as operações em lote usando upsert para evitar duplicações por dia e técnico
    const operacoes = dadosParaSalvar.map((item) => {
      // Isola a data no formato YYYY-MM-DD removendo qualquer fuso horário
      const dataLimpa = item.data ? String(item.data).split("T")[0] : "";

      return {
        updateOne: {
          filter: { tecnico: item.tecnico, data: dataLimpa },
          update: { 
            $set: {
              tecnico: item.tecnico,
              data: dataLimpa,
              km: Number(item.km) || 0,
              litros: Number(item.litros) || 0,
              valor: Number(item.valor) || 0
            } 
          }, 
          upsert: true // Se já existir o registro neste dia para o técnico, atualiza. Se não, cria!
        }
      };
    });

    await db.collection("registros").bulkWrite(operacoes);
    res.json({ ok: true, message: "Dados processados e salvos sem duplicações!" });
  } catch (err) {
    console.error("Erro no salvamento via bulkWrite:", err);
    res.status(500).json({ erro: "Erro interno no servidor ao tentar salvar." });
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

// ==========================================
// --- GESTÃO DE USUÁRIOS (MASTER) ---
// ==========================================

// LISTAR USUÁRIOS
app.get("/api/usuarios", autenticarToken, async (req, res) => {
  try {
    const lista = await db.collection("usuarios").find({}, { projection: { senha: 0 } }).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao listar usuários" });
  }
});

// CADASTRAR USUÁRIO
app.post("/api/usuarios", autenticarToken, async (req, res) => {
  try {
    const { nome, usuario, senha, tipo } = req.body;
    
    const existe = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) {
      return res.status(400).json({ erro: "Nome de usuário já cadastrado no sistema!" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const novo = {
      nome,
      usuario: usuario.toLowerCase().trim(),
      senha: senhaHash,
      tipo: tipo || "simples"
    };

    await db.collection("usuarios").insertOne(novo);
    res.json({ ok: true, message: "Usuário cadastrado com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao cadastrar usuário" });
  }
});

// EDITAR USUÁRIO
app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, usuario, novaSenha, tipo } = req.body;

    const dadosAtualizados = {
      nome,
      usuario: usuario.toLowerCase().trim(),
      tipo
    };

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
      token,
      usuario: usuarioBanco.usuario,
      nome: usuarioBanco.nome,
      tipo: usuarioBanco.tipo
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno ao realizar login" });
  }
});

// Arquivos estáticos da pasta public
app.use(express.static(__dirname + "/public", { index: false }));

// INICIALIZAÇÃO SINCRONIZADA SEGURO
async function iniciarSistema() {
  try {
    console.log("🔄 Conectando ao Banco de Dados...");
    await client.connect();
    db = client.db("neriFrotas");
    console.log("✅ Conectado com sucesso ao MongoDB!");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor NERI rodando perfeitamente na porta ${PORT}`);
    });
  } catch (erro) {
    console.error("❌ Falha crítica ao inicializar o sistema:", erro);
    process.exit(1);
  }
}

iniciarSistema();