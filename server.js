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

const getFiltroSaaS = (req) => {
  if (req.usuario.tipo === "superadmin") return {}; 
  return { cliente_id: req.usuario.cliente_id };
};

// =====================================================================
// GOOGLE MAPS GEOCODING API COM FALLBACK SEGURO
// =====================================================================
app.post('/api/geocodificar-endereco', autenticarToken, async (req,res)=>{
  try {
    const { endereco } = req.body;
    if(!endereco) return res.status(400).json({ encontrado: false });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if(!apiKey) return res.status(500).json({ erro: "GOOGLE_MAPS_API_KEY não configurada" });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco + ", Brasil")}&language=pt-BR&key=${apiKey}`;

    https.get(url, (response)=>{
      let dados="";
      response.on("data", (chunk)=>{ dados += chunk; });
      response.on("end", ()=>{
        const json = JSON.parse(dados);
        if(json.status !== "OK" || !json.results.length){
          return res.json({ encontrado: false });
        }
        const melhor = json.results[0];
        return res.json({
          encontrado: true,
          lat: melhor.geometry.location.lat,
          lon: melhor.geometry.location.lng,
          precisao: melhor.geometry.location_type
        });
      });
    });
  } catch(e) {
    res.status(500).json({ encontrado: false });
  }
});

// =====================================================================
// ROTA DE PROCESSAMENTO COM GEMINI AI
// =====================================================================
app.post('/api/rotas/processar-ia', autenticarToken, async (req, res) => {
  try {
    const { enderecosBrutos } = req.body;
    if (!enderecosBrutos || !Array.isArray(enderecosBrutos)) {
      return res.status(400).json({ erro: "Lista inválida." });
    }

    const prompt = `Analise a lista de endereços e retorne estritamente um array JSON válido onde cada objeto contenha exatamente: 
    { "rua": "...", "numero": "...", "bairro": "...", "cidade": "...", "estado": "...", "cep": "..." }.
    Dados: ${JSON.stringify(enderecosBrutos)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    res.json({ ok: true, resultados: JSON.parse(response.text) });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao processar com IA." });
  }
});

// ROTAS DE PÁGINAS FRONT-END
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/roteirizador.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/roteirizador.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/ping", (req, res) => res.status(200).send("Servidor acordado!"));

app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });
    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });
    const token = jwt.sign({ id: usuarioBanco._id, tipo: usuarioBanco.tipo, cliente_id: usuarioBanco.cliente_id }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ ok: true, token, nome: usuarioBanco.nome, tipo: usuarioBanco.tipo === "superadmin" ? "master" : usuarioBanco.tipo });
  } catch (err) { res.status(500).json({ erro: "Erro no login" }); }
});

app.get('/api/bases', autenticarToken, async (req, res) => {
  try {
    const bases = await db.collection("bases_operacionais").find({ cliente_id: req.usuario.cliente_id }).sort({ nome: 1 }).toArray();
    res.json(bases);
  } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.get('/api/tecnicos-dashboard/com-bases', autenticarToken, async (req, res) => {
  try {
    const cliente_id = req.usuario.cliente_id;
    const [tecnicosDashboard, usuariosTecnicos, bases] = await Promise.all([
      db.collection("tecnicos_dashboard").find({ cliente_id }).toArray(),
      db.collection("usuarios").find({ cliente_id, tipo: "tecnico" }).toArray(),
      db.collection("bases_operacionais").find({ cliente_id }).toArray()
    ]);
    const mapaBases = new Map(bases.map(b => [String(b._id), b]));
    const resultado = tecnicosDashboard.map(t => ({
      ...t,
      base: t.base_id ? mapaBases.get(String(t.base_id)) : null
    }));
    res.json(resultado);
  } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.post('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, tecnico, itinerario, base_id } = req.body;
      if (!data || !tecnico || !itinerario) return res.status(400).json({ erro: "Incompletos" });
      await db.collection("planejamento_rotas").updateOne(
          { data: data, tecnico: tecnico, cliente_id: req.usuario.cliente_id },
          { $set: { itinerario, base_id: base_id || null, atualizadoEm: new Date() } },
          { upsert: true }
      );
      res.json({ mensagem: "Salvo!" });
  } catch (err) { res.status(500).json({ erro: "Erro ao salvar" }); }
});

app.get('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, codigo } = req.query;
      let filtro = { cliente_id: req.usuario.cliente_id };
      if (data) filtro.data = data;
      if (codigo) filtro["itinerario.codigo"] = new RegExp(codigo, 'i');
      const rotas = await db.collection("planejamento_rotas").find(filtro).toArray();
      res.json(rotas);
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.delete('/api/rotas/:id', autenticarToken, async (req, res) => {
  try {
      await db.collection("planejamento_rotas").deleteOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id });
      res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
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