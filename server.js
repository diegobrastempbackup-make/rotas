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
// GEOCODIFICAÇÃO GOOGLE MAPS
// =====================================================================
const removerAcentos = (valor = "") => String(valor)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .trim();

const somenteDigitos = (valor = "") => String(valor).replace(/\D/g, "");

const normalizarUf = (valor = "") => {
  const mapa = {
    ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA", CEARA: "CE",
    "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO", MARANHAO: "MA",
    "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG", PARA: "PA",
    PARAIBA: "PB", PARANA: "PR", PERNAMBUCO: "PE", PIAUI: "PI", "RIO DE JANEIRO": "RJ",
    "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", RONDONIA: "RO", RORAIMA: "RR",
    "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE", TOCANTINS: "TO"
  };
  const limpo = removerAcentos(valor);
  return mapa[limpo] || limpo;
};

const componenteGoogle = (resultado, tipos) => {
  const componente = (resultado.address_components || []).find(c =>
    tipos.some(tipo => c.types.includes(tipo))
  );
  return componente?.long_name || "";
};

const similaridadeTexto = (a, b) => {
  const ignorar = new Set(["RUA", "AVENIDA", "AV", "RODOVIA", "ESTRADA", "ALAMEDA", "TRAVESSA"]);
  const tokens = valor => new Set(removerAcentos(valor).split(" ").filter(t => t && !ignorar.has(t)));
  const ta = tokens(a); const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  const intersecao = [...ta].filter(t => tb.has(t)).length;
  return intersecao / Math.max(ta.size, tb.size);
};

const requisitarGoogle = url => new Promise((resolve, reject) => {
  https.get(url, response => {
    let dados = "";
    response.on("data", chunk => { dados += chunk; });
    response.on("end", () => {
      try { resolve(JSON.parse(dados)); } catch (erro) { reject(erro); }
    });
  }).on("error", reject);
});


// =====================================================================
// VALIDACAO_FORTE_ENDERECO_V4
// CEP + NUMERO + LOGRADOURO antes de aceitar coordenada
// =====================================================================

function normalizarTextoEndereco(valor){
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim();
}

function validarCandidatoEndereco(resultado, original){

  const texto = normalizarTextoEndereco(
    resultado.formatted_address
  );

  let score = 0;
  let problemas = [];

  if(original.rua &&
     texto.includes(normalizarTextoEndereco(original.rua))){
      score += 30;
  } else {
      problemas.push("rua");
  }

  if(original.cidade &&
     texto.includes(normalizarTextoEndereco(original.cidade))){
      score += 20;
  } else {
      problemas.push("cidade");
  }

  if(original.bairro &&
     texto.includes(normalizarTextoEndereco(original.bairro))){
      score += 20;
  }

  if(original.cep){
      const cep = String(original.cep).replace(/\D/g,"");
      if(texto.includes(cep.substring(0,5))){
          score += 25;
      } else {
          problemas.push("cep");
      }
  }

  if(resultado.geometry.location_type === "ROOFTOP"){
      score += 20;
  }

  if(resultado.geometry.location_type === "APPROXIMATE"){
      score -= 80;
  }

  return {score, problemas};
}

app.post('/api/geocodificar-endereco', autenticarToken, async (req, res) => {
  try {
    const entrada = typeof req.body.endereco === "object"
      ? req.body.endereco
      : { rua: req.body.endereco };
    const rua = String(entrada.rua || entrada.endereco || "").trim();
    const numero = String(entrada.numero || "").trim();
    const bairro = String(entrada.bairro || entrada.distrito || "").trim();
    const cidade = String(entrada.cidade || "").trim();
    const uf = String(entrada.uf || entrada.estado || "").trim();
    const cep = somenteDigitos(entrada.cep).slice(0, 8);
    if (!rua && !cep) return res.status(400).json({ encontrado: false, motivo: "ENDERECO_VAZIO" });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if(!apiKey) return res.status(500).json({ erro: "GOOGLE_MAPS_API_KEY não configurada" });

    const enderecoCompleto = [rua, numero, bairro, cidade, uf, cep, "Brasil"].filter(Boolean).join(", ");
    const consultas = [
      { address: enderecoCompleto },
      { address: [rua, numero, cidade, uf, "Brasil"].filter(Boolean).join(", ") },
      ...(cep ? [{ address: `${cep}, Brasil` }] : [])
    ];

    const candidatos = [];
    for (const consulta of consultas) {
      const params = new URLSearchParams({ ...consulta, language: "pt-BR", region: "br", key: apiKey });
      const json = await requisitarGoogle(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      if (json.status === "REQUEST_DENIED") {
        return res.status(502).json({ encontrado: false, erro: "Google Maps recusou a requisição. Verifique a chave e a Geocoding API." });
      }
      if (json.status === "OK") candidatos.push(...json.results);
    }

    const avaliados = candidatos.map(resultado => {
      const cidadeGoogle = componenteGoogle(resultado, ["administrative_area_level_2", "locality"]);
      const ufGoogle = componenteGoogle(resultado, ["administrative_area_level_1"]);
      const cepGoogle = somenteDigitos(componenteGoogle(resultado, ["postal_code"]));
      const ruaGoogle = componenteGoogle(resultado, ["route"]);
      const numeroGoogle = componenteGoogle(resultado, ["street_number"]);
      const cidadeDivergente = Boolean(cidade && cidadeGoogle && removerAcentos(cidade) !== removerAcentos(cidadeGoogle));
      const ufDivergente = Boolean(uf && ufGoogle && normalizarUf(uf) !== normalizarUf(ufGoogle));
      const cepDivergente = Boolean(cep && cepGoogle && cep !== cepGoogle);
      const tipo = resultado.geometry?.location_type || "APPROXIMATE";
      let score = ({ ROOFTOP: 45, RANGE_INTERPOLATED: 34, GEOMETRIC_CENTER: 18, APPROXIMATE: 5 })[tipo] || 0;
      score += resultado.types.some(t => ["street_address", "premise", "subpremise"].includes(t)) ? 18 : 0;
      score += cidade && cidadeGoogle && !cidadeDivergente ? 18 : 0;
      score += uf && ufGoogle && !ufDivergente ? 7 : 0;
      score += cep && cepGoogle && !cepDivergente ? 14 : 0;
      score += Math.round(similaridadeTexto(rua, ruaGoogle) * 15);
      if (numero) score += numeroGoogle === numero ? 12 : -8;
      if (resultado.partial_match) score -= 20;
      if (cidadeDivergente || ufDivergente || cepDivergente) score = -100;
      return { resultado, score, tipo, cidadeGoogle, ufGoogle, cepGoogle, ruaGoogle, numeroGoogle };
    }).sort((a, b) => b.score - a.score);

    const melhor = avaliados[0];
    if (!melhor || melhor.score < 45) {
      return res.json({
        encontrado: false,
        motivo: melhor?.score === -100 ? "DIVERGENCIA_DE_LOCALIDADE" : "BAIXA_CONFIANCA",
        enderecoConsultado: enderecoCompleto
      });
    }

    const altaPrecisao = melhor.score >= 75 && ["ROOFTOP", "RANGE_INTERPOLATED"].includes(melhor.tipo);
    return res.json({
      encontrado: true,
      lat: melhor.resultado.geometry.location.lat,
      lon: melhor.resultado.geometry.location.lng,
      precisao: melhor.tipo,
      score: Math.min(100, melhor.score),
      precisaCorrecao: !altaPrecisao,
      enderecoFormatado: melhor.resultado.formatted_address,
      componentes: {
        rua: melhor.ruaGoogle,
        numero: melhor.numeroGoogle,
        cidade: melhor.cidadeGoogle,
        uf: melhor.ufGoogle,
        cep: melhor.cepGoogle
      }
    });
  } catch(e) {
    console.error("Erro na geocodificação:", e.message);
    res.status(500).json({ encontrado: false, erro: "Falha ao consultar o serviço de geocodificação." });
  }
});

// =====================================================================
// PROCESSAMENTO COM GEMINI AI
// =====================================================================
app.post('/api/rotas/processar-ia', autenticarToken, async (req, res) => {
  try {
    const { enderecosBrutos } = req.body;
    if (!enderecosBrutos || !Array.isArray(enderecosBrutos)) {
      return res.status(400).json({ erro: "Lista de endereços inválida." });
    }

    const prompt = `Analise a seguinte lista de endereços e dados brutos extraídos de uma planilha logística. 
    Para cada item, corrija erros de digitação, normalize abreviações e valide informações existentes. Não invente dados faltantes. Retorne estritamente um array JSON válido onde cada objeto contenha exatamente: 
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

// ROTAS DE PÁGINAS FRONT-END
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login.html", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/dados.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/dados.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/estoque.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/estoque.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/public/index.html"));
app.get("/roteirizador.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/roteirizador.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/diario.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/diario.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/fila.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/fila.html"); } catch (err) { res.redirect("/login.html"); }});
app.get("/totem.html", (req, res) => { if (!req.query.token) return res.redirect("/login.html"); try { jwt.verify(req.query.token, JWT_SECRET); res.sendFile(__dirname + "/public/totem.html"); } catch (err) { res.redirect("/login.html"); }});

app.get("/ping", (req, res) => res.status(200).send("Servidor acordado!"));

// LOGIN E GESTÃO
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    
    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });
    if (usuarioBanco.ativo === false) return res.status(403).json({ erro: "Acesso suspenso." });

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

app.post("/nova-empresa", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado." });
    const { empresa, nome, usuario, senha } = req.body;
    const novoClienteId = new ObjectId().toString(); 
    const senhaHash = await bcrypt.hash(senha, 10);
    await db.collection("usuarios").insertOne({ cliente_id: novoClienteId, empresaNome: empresa.trim(), nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo: "master", ativo: true, criadoEm: new Date() });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/empresas", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Acesso negado" });
    res.json(await db.collection("usuarios").find({ tipo: "master" }).project({ senha: 0 }).toArray());
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master" && req.usuario?.tipo !== "superadmin") return res.status(403).json({ erro: "Permissão negada." });
    const { nome, usuario, senha, tipo, cliente_id, base_id, base_nome } = req.body; 
    const senhaHash = await bcrypt.hash(senha, 10);
    const tenantId = (req.usuario.tipo === "superadmin" && cliente_id) ? cliente_id : req.usuario.cliente_id;
    await db.collection("usuarios").insertOne({ cliente_id: tenantId, nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo, base_id: base_id ? String(base_id) : null, base_nome: base_nome || null, ativo: true, criadoEm: new Date() });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/usuarios", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("usuarios").find(getFiltroSaaS(req)).project({ senha: 0 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.get('/api/bases', autenticarToken, async (req, res) => {
  try {
    res.json(await db.collection("bases_operacionais").find({ cliente_id: req.usuario.cliente_id }).sort({ nome: 1 }).toArray());
  } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.get('/api/tecnicos-dashboard/com-bases', autenticarToken, async (req, res) => {
  try {
    const cliente_id = req.usuario.cliente_id;
    const [tecnicosDashboard, usuariosTecnicos, bases] = await Promise.all([
      db.collection("tecnicos_dashboard").find({ cliente_id }).sort({ nome: 1 }).toArray(),
      db.collection("usuarios").find({ cliente_id, tipo: "tecnico", ativo: { $ne: false } }).toArray(),
      db.collection("bases_operacionais").find({ cliente_id }).toArray()
    ]);
    const mapaBases = new Map(bases.map(b => [String(b._id), b]));
    const mapaUsuarios = new Map(usuariosTecnicos.map(u => [String(u.nome).trim().toUpperCase(), u]));
    const mapaDashboard = new Map(tecnicosDashboard.map(t => [String(t.nome).trim().toUpperCase(), t]));
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
        base
      });
    }
    res.json(resultado);
  } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

// =====================================================================
// ROTA ADICIONADA: EQUIPE TOTEM (TÉCNICOS LISTA)
// =====================================================================
app.get('/api/equipe-totem', autenticarToken, async (req, res) => {
    try {
        const equipe = await db.collection("equipe_totem").find({ cliente_id: req.usuario.cliente_id }).toArray();
        res.json(equipe);
    } catch(e) { res.status(500).json({ erro: "Erro ao listar equipa" }); }
});

app.post('/api/equipe-totem', autenticarToken, async (req, res) => {
    try {
        const { nome, funcao, foto } = req.body;
        await db.collection("equipe_totem").insertOne({ cliente_id: req.usuario.cliente_id, nome, funcao, foto });
        res.json({ ok: true });
    } catch(e) { res.status(500).json({ erro: "Erro ao cadastrar pessoa" }); }
});


// Compatibilidade com roteirizador novo
app.get("/api/config-base", autenticarToken, async (req, res) => {
  try {
    const base = await db.collection("bases_operacionais")
      .findOne({ cliente_id: req.usuario.cliente_id });

    if (!base) {
      return res.json({});
    }

    res.json({
      latBase: base.lat,
      lonBase: base.lon,
      nome: base.nome,
      endereco: base.endereco
    });

  } catch (e) {
    res.status(500).json({ erro: "Erro ao buscar base" });
  }
});

// ROTEIRIZADOR E PLANEJAMENTO DE ROTAS
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
      if (data) {
          filtro.data = { $in: [data, data.includes('-') ? data.split('-').reverse().join('/') : data] };
      }
      if (codigo) filtro["itinerario.codigo"] = new RegExp(codigo, 'i');
      res.json(await db.collection("planejamento_rotas").find(filtro).toArray());
  } catch (err) { res.status(500).json({ erro: "Erro ao buscar roteiros." }); }
});

app.delete('/api/rotas/:id', autenticarToken, async (req, res) => {
  try {
      await db.collection("planejamento_rotas").deleteOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id });
      res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro ao excluir." }); }
});

app.get("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { res.json(await db.collection("tecnicos_dashboard").find(getFiltroSaaS(req)).toArray()); } catch (e) { res.status(500).json({ erro: "Erro" }); } });
app.get("/api/estoque", autenticarToken, async (req, res) => { try { res.json(await db.collection("estoque").find(getFiltroSaaS(req)).toArray()); } catch (e) { res.status(500).json({ erro: "Erro" }); } });
app.get("/api/registros", autenticarToken, async (req, res) => { try { res.json(await db.collection("registros").find(getFiltroSaaS(req)).sort({ data: 1 }).toArray()); } catch (e) { res.status(500).json({ erro: "Erro" }); } });

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