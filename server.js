const express = require("express"); 
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https"); 
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "NERI_SECRET_2026";

const ai = new GoogleGenAI();

const URL_DO_SEU_SISTEMA = "https://rotas-2.onrender.com"; 

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db = null;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  if (!db) return res.status(503).json({ erro: "Banco de dados inicializando. Tente novamente em instantes." });
  next();
});

const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: "Acesso negado." });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET); 
    next();
  } catch (err) { return res.status(403).json({ erro: "Token inválido." }); }
};

// =====================================================================
// GOOGLE MAPS + VALIDAÇÃO INTELIGENTE DE ENDEREÇOS
// =====================================================================
function normalizarEnderecoTexto(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function pontuarResultadoGoogle(resultado, enderecoOriginal) {
  const texto = normalizarEnderecoTexto(resultado.formatted_address);
  let pontos = 0;
  const campos = [enderecoOriginal.rua, enderecoOriginal.bairro, enderecoOriginal.distrito, enderecoOriginal.cidade];

  campos.forEach(campo => {
    if (campo && texto.includes(normalizarEnderecoTexto(campo))) pontos += 20;
  });

  if (enderecoOriginal.cep) {
    const cep = String(enderecoOriginal.cep).replace(/\D/g,"").substring(0,5);
    if(texto.includes(cep)) pontos += 25;
  }

  if (resultado.geometry.location_type === "ROOFTOP") pontos += 30;
  else if (resultado.geometry.location_type === "RANGE_INTERPOLATED") pontos += 20;

  return pontos;
}

app.post('/api/geocodificar-endereco', autenticarToken, async (req,res)=>{
  try {
    const { endereco, dadosOriginais } = req.body;
    if(!endereco) return res.status(400).json({ erro: "Endereço vazio" });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if(!apiKey) return res.status(500).json({ erro: "GOOGLE_MAPS_API_KEY não configurada no Vercel" });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco + ", Brasil")}&language=pt-BR&key=${apiKey}`;

    https.get(url, (response)=>{
      let dados="";
      response.on("data", (chunk)=>{ dados += chunk; });
      response.on("end", ()=>{
        const json = JSON.parse(dados);
        if(json.status !== "OK" || !json.results.length){
          return res.json({ encontrado: false, status: json.status });
        }

        const candidatos = json.results.map(resultado => ({
          ...resultado,
          score: pontuarResultadoGoogle(resultado, dadosOriginais || {})
        }));

        candidatos.sort((a,b)=> b.score - a.score);
        const melhor = candidatos[0];

        return res.json({
          encontrado: true,
          lat: melhor.geometry.location.lat,
          lon: melhor.geometry.location.lng,
          precisao: melhor.geometry.location_type,
          score: melhor.score,
          enderecoFormatado: melhor.formatted_address
        });
      });
    });
  } catch(e) {
    res.status(500).json({ erro: "Erro ao comunicar com Google Maps" });
  }
});

// =====================================================================
// ROTA DE PROCESSAMENTO COM GEMINI AI
// =====================================================================
app.post('/api/rotas/processar-ia', autenticarToken, async (req, res) => {
  try {
    const { enderecosBrutos } = req.body;
    if (!enderecosBrutos || !Array.isArray(enderecosBrutos)) {
      return res.status(400).json({ erro: "Lista de endereços inválida." });
    }

    const prompt = `Analise a seguinte lista de endereços e dados brutos extraídos de uma planilha logística. 
    Para cada item, corrija erros de digitação, limpe abreviações e deduza informações faltantes. Retorne estritamente um array JSON válido onde cada objeto contenha exatamente: 
    { "rua": "...", "numero": "...", "bairro": "...", "cidade": "...", "estado": "...", "cep": "..." }.
    
    Dados: ${JSON.stringify(enderecosBrutos)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const enderecosTratados = JSON.parse(response.text);
    res.json({ ok: true, resultados: enderecosTratados });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao processar com IA." });
  }
});

const getFiltroSaaS = (req) => {
  if (req.usuario.tipo === "superadmin") return {}; 
  return { cliente_id: req.usuario.cliente_id };
};

app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/roteirizador.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/roteirizador.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/ping", (req, res) => res.status(200).send("Servidor acordado!"));

app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });
    if (usuarioBanco.ativo === false) return res.status(403).json({ erro: "Acesso suspenso." });
    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });
    const token = jwt.sign({ id: usuarioBanco._id, tipo: usuarioBanco.tipo, cliente_id: usuarioBanco.cliente_id }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ ok: true, token, nome: usuarioBanco.nome, tipo: usuarioBanco.tipo === "superadmin" ? "master" : usuarioBanco.tipo });
  } catch (err) { res.status(500).json({ erro: "Erro ao realizar login" }); }
});

app.get('/api/bases', autenticarToken, async (req, res) => {
  try {
    const bases = await db.collection("bases_operacionais").find({ cliente_id: req.usuario.cliente_id }).sort({ nome: 1 }).toArray();
    res.json(bases);
  } catch (e) { res.status(500).json({ erro: "Erro ao listar bases." }); }
});

app.get('/api/tecnicos-dashboard/com-bases', autenticarToken, async (req, res) => {
  try {
    const cliente_id = req.usuario.cliente_id;
    const [tecnicosDashboard, usuariosTecnicos, bases] = await Promise.all([
      db.collection("tecnicos_dashboard").find({ cliente_id }).sort({ nome: 1 }).toArray(),
      db.collection("usuarios").find({ cliente_id, tipo: "tecnico", ativo: { $ne: false } }).toArray(),
      db.collection("bases_operacionais").find({ cliente_id }).toArray()
    ]);
    const normalizarNome = (nome) => String(nome || "").trim().toUpperCase();
    const mapaBases = new Map(bases.map(b => [String(b._id), b]));
    const mapaUsuarios = new Map(usuariosTecnicos.map(u => [normalizarNome(u.nome), u]));
    const mapaDashboard = new Map(tecnicosDashboard.map(t => [normalizarNome(t.nome), t]));
    const nomes = new Set([...mapaUsuarios.keys(), ...mapaDashboard.keys()]);
    const resultado = [];
    for (const chave of nomes) {
      const usuario = mapaUsuarios.get(chave) || null;
      const tecnicoDashboard = mapaDashboard.get(chave) || null;
      const baseId = usuario?.base_id || tecnicoDashboard?.base_id || null;
      const base = baseId ? (mapaBases.get(String(baseId)) || null) : null;
      resultado.push({
        ...(tecnicoDashboard || {}),
        ...(usuario ? { usuario_id: String(usuario._id), usuario: usuario.usuario, tipo: usuario.tipo } : {}),
        nome: usuario?.nome || tecnicoDashboard?.nome || chave,
        base_id: baseId,
        base_nome: base?.nome || usuario?.base_nome || tecnicoDashboard?.base_nome || null,
        base
      });
    }
    resultado.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    res.json(resultado);
  } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.post('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, tecnico, itinerario, base_id } = req.body;
      if (!data || !tecnico || !itinerario) return res.status(400).json({ erro: "Dados incompletos" });
      const itinerarioFormatado = itinerario.map(item => ({ ...item, status: item.status || 'pendente' }));
      await db.collection("planejamento_rotas").updateOne(
          { data: data, tecnico: tecnico, cliente_id: req.usuario.cliente_id },
          { $set: { itinerario: itinerarioFormatado, base_id: base_id || null, atualizadoEm: new Date() } },
          { upsert: true }
      );
      res.json({ mensagem: "Roteiro salvo com sucesso!" });
  } catch (err) { res.status(500).json({ erro: "Erro ao salvar roteiro." }); }
});

app.get('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, codigo } = req.query;
      let filtro = { cliente_id: req.usuario.cliente_id };
      if (data) filtro.data = data;
      if (codigo) filtro["itinerario.codigo"] = new RegExp(codigo, 'i');
      const rotas = await db.collection("planejamento_rotas").find(filtro).toArray();
      res.json(rotas);
  } catch (err) { res.status(500).json({ erro: "Erro ao buscar roteiros." }); }
});

app.delete('/api/rotas/:id', autenticarToken, async (req, res) => {
  try {
      await db.collection("planejamento_rotas").deleteOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id });
      res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao excluir." }); }
});

app.use(express.static(__dirname + "/public", { index: false }));

async function conectarBanco() {
  if (!db) {
    await client.connect(); 
    db = client.db("rotas"); 
  }
}

module.exports = async (req, res) => {
  await conectarBanco();
  return app(req, res);
};