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

// Inicializa a IA do Google Gemini (lê automaticamente process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI();

// =====================================================================
const URL_DO_SEU_SISTEMA = "https://rotas-2.onrender.com"; 
// =====================================================================

// MONGO DB
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db = null;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Middleware de segurança para evitar crash se a requisição chegar antes da conexão do DB
app.use((req, res, next) => {
  if (!db) return res.status(503).json({ erro: "Banco de dados inicializando. Tente novamente em instantes." });
  next();
});

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

// =====================================================================
// GOOGLE MAPS + VALIDAÇÃO INTELIGENTE DE ENDEREÇOS
// =====================================================================

function normalizarEnderecoTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}


function pontuarResultadoGoogle(resultado, enderecoOriginal) {

  const texto = normalizarEnderecoTexto(
    resultado.formatted_address
  );

  let pontos = 0;


  const campos = [
    enderecoOriginal.rua,
    enderecoOriginal.bairro,
    enderecoOriginal.distrito,
    enderecoOriginal.cidade
  ];


  campos.forEach(campo => {

    if (
      campo &&
      texto.includes(
        normalizarEnderecoTexto(campo)
      )
    ) {
      pontos += 20;
    }

  });


  if (enderecoOriginal.cep) {

    const cep =
      String(enderecoOriginal.cep)
      .replace(/\D/g,"")
      .substring(0,5);


    if(texto.includes(cep)){
      pontos += 25;
    }

  }


  if(
    resultado.geometry.location_type === "ROOFTOP"
  ){
    pontos += 30;
  }

  else if(
    resultado.geometry.location_type === "RANGE_INTERPOLATED"
  ){
    pontos += 20;
  }


  return pontos;

}



app.post(
'/api/geocodificar-endereco',
autenticarToken,
async (req,res)=>{


try{


const {
 endereco,
 dadosOriginais
}=req.body;



if(!endereco){

return res.status(400).json({
erro:"Endereço vazio"
});

}



const apiKey =
process.env.GOOGLE_MAPS_API_KEY;



if(!apiKey){

return res.status(500).json({

erro:
"GOOGLE_MAPS_API_KEY não configurada"

});

}



const url =
"https://maps.googleapis.com/maps/api/geocode/json?"
+
`address=${encodeURIComponent(
endereco + ", Brasil"
)}`
+
"&language=pt-BR"
+
`&key=${apiKey}`;



https.get(
url,
(response)=>{


let dados="";


response.on(
"data",
(chunk)=>{

dados+=chunk;

});


response.on(
"end",
()=>{


const json =
JSON.parse(dados);



if(
json.status !== "OK"
||
!json.results.length
){


return res.json({

encontrado:false,

status:
json.status

});


}



const candidatos =
json.results.map(resultado=>{


return {

...resultado,

score:
pontuarResultadoGoogle(
resultado,
dadosOriginais || {}
)

};


});



candidatos.sort(
(a,b)=>
b.score-a.score
);



const melhor =
candidatos[0];



return res.json({

encontrado:true,


lat:
melhor.geometry.location.lat,


lon:
melhor.geometry.location.lng,


precisao:
melhor.geometry.location_type,


score:
melhor.score,


enderecoFormatado:
melhor.formatted_address

});


});


});


}

catch(e){


console.error(e);


res.status(500).json({

erro:
"Erro Google Maps"

});


}


});



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

// ROTA ANTI-HIBERNAÇÃO
app.get("/ping", (req, res) => {
  res.status(200).send("Servidor acordado!");
});

// =====================================================================
// LOGIN E GESTÃO DE UTILIZADORES / EMPRESAS
// =====================================================================
app.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const usuarioBanco = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    
    if (!usuarioBanco) return res.status(401).json({ erro: "Utilizador não encontrado" });
    if (usuarioBanco.ativo === false) return res.status(403).json({ erro: "Acesso suspenso. Contacte a administração." });

    const senhaValida = await bcrypt.compare(senha, usuarioBanco.senha);
    if (!senhaValida) return res.status(401).json({ erro: "Senha incorreta" });

    const token = jwt.sign(
      { id: usuarioBanco._id, tipo: usuarioBanco.tipo, cliente_id: usuarioBanco.cliente_id },
      JWT_SECRET, { expiresIn: "30d" }
    );

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

    await db.collection("usuarios").insertOne({
      cliente_id: novoClienteId, empresaNome: empresa.trim(), nome, usuario: usuario.toLowerCase().trim(),
      senha: senhaHash, tipo: "master", ativo: true, criadoEm: new Date()
    });
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
        const colecoes = ["usuarios", "tecnicos_dashboard", "tecnicos", "estoque", "historico_estoque", "registros", "planejamento_rotas"];
        for(let col of colecoes) await db.collection(col).deleteMany({ cliente_id: cid });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.post("/cadastro", autenticarToken, async (req, res) => {
  try {
    if (req.usuario?.tipo !== "master" && req.usuario?.tipo !== "superadmin") return res.status(403).json({ erro: "Permissão negada." });
    
    const { nome, usuario, senha, tipo, cliente_id, base_id, base_nome } = req.body; 
    
    const existe = await db.collection("usuarios").findOne({ usuario: usuario.toLowerCase().trim() });
    if (existe) return res.status(400).json({ erro: "Login já em uso" });
    
    const senhaHash = await bcrypt.hash(senha, 10);
    
    const tenantId = (req.usuario.tipo === "superadmin" && cliente_id) ? cliente_id : req.usuario.cliente_id;

    await db.collection("usuarios").insertOne({ cliente_id: tenantId, nome, usuario: usuario.toLowerCase().trim(), senha: senhaHash, tipo, base_id: base_id ? String(base_id) : null, base_nome: base_nome || null, ativo: true, criadoEm: new Date() });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.get("/api/usuarios", autenticarToken, async (req, res) => {
  try { res.json(await db.collection("usuarios").find(getFiltroSaaS(req)).project({ senha: 0 }).toArray()); } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.delete("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Negado" });
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

app.put("/api/usuarios/:id", autenticarToken, async (req, res) => {
  try {
    if (req.usuario.tipo !== "master" && req.usuario.tipo !== "superadmin") return res.status(403).json({ erro: "Negado" });
    const { nome, tipo, senha, base_id, base_nome } = req.body;
    const atualizacao = { nome, tipo, base_id: base_id ? String(base_id) : null, base_nome: base_nome || null };
    if (senha && senha.trim() !== "") atualizacao.senha = await bcrypt.hash(senha, 10);
    await db.collection("usuarios").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: atualizacao });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: "Erro" }); }
});

// =====================================================================
// BASES OPERACIONAIS (MULTIBASE / MULTITENANT)
// =====================================================================
app.get('/api/bases', autenticarToken, async (req, res) => {
  try {
    const bases = await db.collection("bases_operacionais")
      .find({ cliente_id: req.usuario.cliente_id }).sort({ nome: 1 }).toArray();
    res.json(bases);
  } catch (e) { res.status(500).json({ erro: "Erro ao listar bases." }); }
});

app.post('/api/bases', autenticarToken, async (req, res) => {
  try {
    const { nome, lat, lon, raioBase, limiteAtraso, endereco } = req.body;
    if (!nome || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return res.status(400).json({ erro: "Nome, latitude e longitude são obrigatórios." });
    }
    const base = {
      cliente_id: req.usuario.cliente_id,
      nome: String(nome).trim(),
      endereco: endereco || "",
      lat: Number(lat), lon: Number(lon),
      raioBase: Number(raioBase) || 150,
      limiteAtraso: limiteAtraso || "08:00",
      criadoEm: new Date(), atualizadoEm: new Date()
    };
    const r = await db.collection("bases_operacionais").insertOne(base);
    res.json({ ok: true, id: r.insertedId, base: { ...base, _id: r.insertedId } });
  } catch (e) { res.status(500).json({ erro: "Erro ao criar base." }); }
});

app.put('/api/bases/:id', autenticarToken, async (req, res) => {
  try {
    const dados = {};
    for (const campo of ["nome","endereco","limiteAtraso"]) if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    if (req.body.lat !== undefined) dados.lat = Number(req.body.lat);
    if (req.body.lon !== undefined) dados.lon = Number(req.body.lon);
    if (req.body.raioBase !== undefined) dados.raioBase = Number(req.body.raioBase);
    dados.atualizadoEm = new Date();
    const r = await db.collection("bases_operacionais").updateOne(
      { _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, { $set: dados });
    if (!r.matchedCount) return res.status(404).json({ erro: "Base não encontrada." });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: "Erro ao atualizar base." }); }
});

app.delete('/api/bases/:id', autenticarToken, async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const emUsoDashboard = await db.collection("tecnicos_dashboard").countDocuments({ cliente_id: req.usuario.cliente_id, base_id: req.params.id });
    const emUsoUsuarios = await db.collection("usuarios").countDocuments({ cliente_id: req.usuario.cliente_id, base_id: req.params.id });
    const emUso = emUsoDashboard + emUsoUsuarios;
    if (emUso) return res.status(400).json({ erro: "Não é possível excluir uma base com técnicos vinculados." });
    const r = await db.collection("bases_operacionais").deleteOne({ _id: id, cliente_id: req.usuario.cliente_id });
    if (!r.deletedCount) return res.status(404).json({ erro: "Base não encontrada." });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: "Erro ao excluir base." }); }
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
  } catch (e) {
    console.error("Erro ao carregar técnicos e bases:", e);
    res.status(500).json({ erro: "Erro ao carregar técnicos e bases." });
  }
});

// =====================================================================
// NOVO MÓDULO: ROTEIRIZADOR INTELIGENTE COM GEMINI AI
// =====================================================================

app.post('/api/rotas/processar-ia', autenticarToken, async (req, res) => {
  try {
    const { enderecosBrutos } = req.body;
    if (!enderecosBrutos || !Array.isArray(enderecosBrutos)) {
      return res.status(400).json({ erro: "Lista de endereços inválida." });
    }

    const prompt = `Analise a seguinte lista de endereços e dados brutos extraídos de uma planilha logística. 
    Para cada item, corrija erros de digitação, limpe abreviações complexas, deduza informações faltantes e retorne estritamente um array JSON válido onde cada objeto contenha exatamente os seguintes campos: 
    { "rua": "...", "numero": "...", "bairro": "...", "cidade": "...", "estado": "...", "cep": "..." }.
    
    Dados para análise: ${JSON.stringify(enderecosBrutos)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const enderecosTratados = JSON.parse(response.text);
    res.json({ ok: true, resultados: enderecosTratados });
  } catch (err) {
    console.error("Erro na IA do Roteirizador:", err);
    res.status(500).json({ erro: "Erro ao processar endereços com inteligência artificial." });
  }
});

app.post('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, tecnico, itinerario, base_id } = req.body;
      if (!data || !tecnico || !itinerario) {
          return res.status(400).json({ erro: "Dados incompletos" });
      }

      const tecnicoDoc = await db.collection("tecnicos_dashboard").findOne({
        cliente_id: req.usuario.cliente_id,
        nome: new RegExp(`^${String(tecnico).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i")
      });
      const usuarioTecnico = await db.collection("usuarios").findOne({ cliente_id: req.usuario.cliente_id, nome: tecnicoDoc ? tecnicoDoc.nome : new RegExp(`^${String(tecnico).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i"), tipo: "tecnico" });
      const baseIdFinal = usuarioTecnico?.base_id || tecnicoDoc?.base_id || base_id || null;
      let base = null;
      if (baseIdFinal) base = await db.collection("bases_operacionais").findOne({
        _id: new ObjectId(String(baseIdFinal)), cliente_id: req.usuario.cliente_id
      });
      if (!base) {
        const bases = await db.collection("bases_operacionais").find({ cliente_id: req.usuario.cliente_id }).toArray();
        if (bases.length === 1) base = bases[0];
        else if (bases.length > 1) return res.status(400).json({ erro: `O técnico ${tecnico} não possui uma base operacional vinculada.` });
      }
      const itinerarioFormatado = itinerario.map(item => ({ ...item, status: item.status || 'pendente' }));
      const baseSnapshot = base ? { id: String(base._id), nome: base.nome, endereco: base.endereco || "", lat: Number(base.lat), lon: Number(base.lon), raioBase: base.raioBase, limiteAtraso: base.limiteAtraso } : null;

      await db.collection("planejamento_rotas").updateOne(
          { data: data, tecnico: tecnico, cliente_id: req.usuario.cliente_id },
          { $set: { itinerario: itinerarioFormatado, base_id: baseSnapshot?.id || null, base: baseSnapshot, atualizadoEm: new Date() } },
          { upsert: true }
      );

      res.json({ mensagem: "Roteiro salvo com sucesso!" });
  } catch (err) {
      res.status(500).json({ erro: "Erro ao salvar roteiro." });
  }
});

app.get('/api/rotas', autenticarToken, async (req, res) => {
  try {
      const { data, codigo } = req.query;
      let filtro = { cliente_id: req.usuario.cliente_id };

      if (data) filtro.data = data;
      if (codigo) filtro["itinerario.codigo"] = new RegExp(codigo, 'i');

      const rotas = await db.collection("planejamento_rotas").find(filtro).toArray();
      res.json(rotas);
  } catch (err) {
      res.status(500).json({ erro: "Erro ao buscar roteiros." });
  }
});

app.delete('/api/rotas/:id', autenticarToken, async (req, res) => {
  try {
      const resultado = await db.collection("planejamento_rotas").deleteOne({
          _id: new ObjectId(req.params.id),
          cliente_id: req.usuario.cliente_id
      });
      if (resultado.deletedCount === 1) res.json({ ok: true });
      else res.status(404).json({ erro: "Não encontrada" });
  } catch (err) {
      res.status(500).json({ erro: "Erro ao excluir." });
  }
});

app.put('/api/rotas/status', autenticarToken, async (req, res) => {
    try {
        const { data, tecnico, codigoOs, novoStatus, campoTempo, valorTempo, latitude, longitude, motivo } = req.body;
        
        let filterDoc = { 
            data: data, 
            tecnico: new RegExp(`^${tecnico}$`, 'i'), 
            cliente_id: req.usuario.cliente_id, 
            "itinerario.codigo": { $in: [codigoOs, String(codigoOs), Number(codigoOs)] } 
        };

        let atualizacao = { "itinerario.$.status": novoStatus };

        if (campoTempo && valorTempo) atualizacao[`itinerario.$.${campoTempo}`] = valorTempo;
        if (latitude !== undefined && longitude !== undefined) {
            atualizacao["itinerario.$.latCheckin"] = latitude;
            atualizacao["itinerario.$.lonCheckin"] = longitude;
        }
        if (motivo) atualizacao["itinerario.$.motivoInsucesso"] = motivo;

        const resultado = await db.collection("planejamento_rotas").updateOne(filterDoc, { $set: atualizacao });

        if (resultado.matchedCount > 0) res.json({ ok: true });
        else res.status(400).json({ erro: "Paragem não encontrada" });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar status." });
    }
});

app.get('/api/rotas/relatorio', autenticarToken, async (req, res) => {
    try {
        const { tecnico, mesAno } = req.query; 
        const regexData = new RegExp(`/${mesAno}$`); 
        
        const rotas = await db.collection("planejamento_rotas").find({
            tecnico: new RegExp(`^${tecnico}$`, 'i'),
            cliente_id: req.usuario.cliente_id,
            data: regexData
        }).toArray();

        let total = 0, sucesso = 0, insucesso = 0;
        rotas.forEach(rota => {
            if (rota.itinerario) {
                rota.itinerario.forEach(os => {
                    total++;
                    if (os.status === 'sucesso') sucesso++;
                    else if (os.status === 'insucesso') insucesso++;
                });
            }
        });

        res.json({ total, sucesso, insucesso });
    } catch (e) {
        res.status(500).json({ erro: "Erro ao gerar relatório" });
    }
});

app.put('/api/rotas/tracking', autenticarToken, async (req, res) => {
    try {
        const { data, tecnico, codigoOs, lat, lon } = req.body;
        let filterDoc = { 
            data: data, 
            tecnico: new RegExp(`^${tecnico}$`, 'i'), 
            cliente_id: req.usuario.cliente_id, 
            "itinerario.codigo": { $in: [codigoOs, String(codigoOs), Number(codigoOs)] } 
        };

        let novoPonto = { lat, lon, timestamp: new Date() };
        await db.collection("planejamento_rotas").updateOne(filterDoc, { $push: { "itinerario.$.rastroReal": novoPonto } });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao salvar tracking." });
    }
});

app.put('/api/rotas/endereco', autenticarToken, async (req, res) => {
    try {
        const { data, tecnico, codigoOs, novoEndereco, lat, lon } = req.body;
        let filterDoc = { 
            data: data, 
            tecnico: new RegExp(`^${tecnico}$`, 'i'), 
            cliente_id: req.usuario.cliente_id, 
            "itinerario.codigo": { $in: [codigoOs, String(codigoOs), Number(codigoOs)] } 
        };

        let atualizacao = { 
            "itinerario.$.rua": novoEndereco,
            "itinerario.$.lat": lat,
            "itinerario.$.lon": lon,
            "itinerario.$.precisaCorrecao": false
        };

        const resultado = await db.collection("planejamento_rotas").updateOne(filterDoc, { $set: atualizacao });

        if (resultado.matchedCount > 0) res.json({ ok: true });
        else res.status(400).json({ erro: "Paragem não encontrada." });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao salvar novo endereço." });
    }
});

// =====================================================================
// ESTOQUE, HISTÓRICO, TÉCNICOS DASHBOARD
// =====================================================================
app.get("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { res.json(await db.collection("tecnicos_dashboard").find(getFiltroSaaS(req)).sort({ nome: 1 }).toArray()); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.post("/api/tecnicos-dashboard", autenticarToken, async (req, res) => { try { const { nome, status, telefone, email, veiculo, placa, base_id, base_nome } = req.body; const existe = await db.collection("tecnicos_dashboard").findOne({ nome: nome.trim(), cliente_id: req.usuario.cliente_id }); if (existe) return res.status(400).json({ erro: "Técnico já registado" }); await db.collection("tecnicos_dashboard").insertOne({ cliente_id: req.usuario.cliente_id, nome: nome.trim(), status: status || "Ativo", telefone, email, veiculo, placa, base_id: base_id ? String(base_id) : null, base_nome: base_nome || null, criadoEm: new Date() }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.put("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos_dashboard").updateOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }, { $set: { nome: req.body.nome.trim(), status: req.body.status, telefone: req.body.telefone, email: req.body.email, veiculo: req.body.veiculo, placa: req.body.placa } }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });
app.delete("/api/tecnicos-dashboard/:id", autenticarToken, async (req, res) => { try { await db.collection("tecnicos_dashboard").deleteOne({ _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }); res.json({ ok: true }); } catch (erro) { res.status(500).json({ erro: "Erro" }); } });

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

app.put("/api/estoque/historico/:id", autenticarToken, async (req, res) => {
  try {
    const { tipoAcao, quantidade, observacao } = req.body;
    const resultado = await db.collection("historico_estoque").updateOne(
      { _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) },
      { $set: { tipoAcao, quantidade: Number(quantidade), observacao } }
    );
    if(resultado.matchedCount > 0) res.json({ ok: true });
    else res.status(404).json({ erro: "Registro não encontrado." });
  } catch (erro) { res.status(500).json({ erro: "Erro ao atualizar histórico" }); }
});

app.delete("/api/estoque/historico/:id", autenticarToken, async (req, res) => {
  try {
    const resultado = await db.collection("historico_estoque").deleteOne(
      { _id: new ObjectId(req.params.id), ...getFiltroSaaS(req) }
    );
    if(resultado.deletedCount > 0) res.json({ ok: true });
    else res.status(404).json({ erro: "Registro não encontrado." });
  } catch (erro) { res.status(500).json({ erro: "Erro ao excluir histórico" }); }
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

async function conectarBanco() {
  if (!db) {
    console.log("🔄 A ligar à base de dados...");
    await client.connect(); 
    db = client.db("rotas"); 
    console.log("✅ Conexão estabelecida!");
  }
}

module.exports = async (req, res) => {
  await conectarBanco();
  return app(req, res);
};

// ==========================================
// FASE 5: SISTEMA DE FILA, TOTEM E CRACHÁS
// ==========================================

app.get('/api/equipe-totem', autenticarToken, async (req, res) => {
    try {
        const equipe = await db.collection("equipe_totem").find({ cliente_id: req.usuario.cliente_id }).toArray();
        res.json(equipe);
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/equipe-totem', autenticarToken, async (req, res) => {
    try {
        const { nome, funcao, foto } = req.body;
        await db.collection("equipe_totem").insertOne({ cliente_id: req.usuario.cliente_id, nome, funcao, foto });
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/equipe-totem/:id', autenticarToken, async (req, res) => {
    try {
        const { nome, funcao, foto } = req.body;
        await db.collection("equipe_totem").updateOne(
            { _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, 
            { $set: { nome, funcao, foto } }
        );
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.delete('/api/equipe-totem/:id', autenticarToken, async (req, res) => {
    try {
        await db.collection("equipe_totem").deleteOne({ 
            _id: new ObjectId(req.params.id), 
            cliente_id: req.usuario.cliente_id 
        });
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.get('/api/config-base', autenticarToken, async (req, res) => {
    try {
        let config = await db.collection("configuracoes").findOne({ cliente_id: req.usuario.cliente_id });
        if (!config) config = { limiteAtraso: "08:00" };
        res.json(config);
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/config-base', autenticarToken, async (req, res) => {
    try {
        const { limiteAtraso, latBase, lonBase, raioBase } = req.body;
        await db.collection("configuracoes").updateOne(
            { cliente_id: req.usuario.cliente_id }, 
            { $set: { limiteAtraso, latBase, lonBase, raioBase } }, 
            { upsert: true }
        );
        res.json({ ok: true });
    } catch(e) { 
        res.status(500).json({erro: "Erro"}); 
    }
});

app.post('/api/fila/bipar', autenticarToken, async (req, res) => {
    try {
        const { codigoBarras, horaBatida, dataBatida, origem } = req.body;
        const pessoa = await db.collection("equipe_totem").findOne({ 
            nome: new RegExp(`^${codigoBarras}$`, 'i'), 
            cliente_id: req.usuario.cliente_id 
        });

        if (!pessoa) return res.status(404).json({ erro: "Crachá não reconhecido na Base!" });

        const jaEntrouHoje = await db.collection("fila_ponto").findOne({
            cliente_id: req.usuario.cliente_id,
            tecnico: pessoa.nome,
            data: dataBatida
        });

        if (jaEntrouHoje) return res.status(400).json({ erro: "Entrada já registrada hoje." });

        let config = await db.collection("configuracoes").findOne({ cliente_id: req.usuario.cliente_id });
        const limite = config && config.limiteAtraso ? config.limiteAtraso : "08:00";
        let atrasado = horaBatida > limite;
        
        const registro = {
            cliente_id: req.usuario.cliente_id,
            tecnico: pessoa.nome, 
            data: dataBatida, 
            horaChegada: horaBatida,
            status: "Aguardando", 
            atrasado: atrasado,
            origem: origem || "Totem", 
            timestamp: new Date()
        };

        await db.collection("fila_ponto").insertOne(registro);
        res.json({ ok: true, tecnico: pessoa.nome, atrasado });
    } catch(e) { 
        res.status(500).json({erro: "Erro no servidor."}); 
    }
});

app.get('/api/fila/hoje', autenticarToken, async (req, res) => {
    try {
        const dataHoje = req.query.data;
        const fila = await db.collection("fila_ponto").find({ cliente_id: req.usuario.cliente_id, data: dataHoje, status: { $ne: "Finalizado" } }).sort({ timestamp: 1 }).toArray();
        res.json(fila);
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.get('/api/fila/relatorio', autenticarToken, async (req, res) => {
    try {
        const { mesAno, tecnico } = req.query;
        let filtro = { cliente_id: req.usuario.cliente_id, data: new RegExp(`/${mesAno}$`) };
        if (tecnico && tecnico !== "TODOS") filtro.tecnico = tecnico;
        const historico = await db.collection("fila_ponto").find(filtro).sort({ timestamp: 1 }).toArray();
        res.json(historico);
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/fila/:id/status', autenticarToken, async (req, res) => {
    try {
        const { status } = req.body;
        await db.collection("fila_ponto").updateOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id }, { $set: { status } });
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/totem/alerta-balcao', autenticarToken, async (req, res) => {
    try {
        const { tecnico, coordenador, mensagem } = req.body;
        await db.collection("alertas_totem").insertOne({
            cliente_id: req.usuario.cliente_id,
            tecnico,
            coordenador,
            mensagem,
            status: "Pendente",
            timestamp: new Date()
        });
        res.json({ ok: true });
    } catch(e) { res.status(500).json({erro: "Erro ao registrar alerta"}); }
});

app.get('/api/totem/alertas-pendentes', autenticarToken, async (req, res) => {
    try {
        const alertas = await db.collection("alertas_totem").find({
            cliente_id: req.usuario.cliente_id,
            status: "Pendente"
        }).sort({ timestamp: 1 }).toArray();
        res.json(alertas);
    } catch(e) { res.status(500).json({erro: "Erro ao buscar alertas"}); }
});

app.put('/api/totem/alerta-balcao/:id/concluido', autenticarToken, async (req, res) => {
    try {
        await db.collection("alertas_totem").updateOne(
            { _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id },
            { $set: { status: "Concluido", lidoEm: new Date() } }
        );
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro ao atualizar alerta"}); }
});

app.put('/api/fila/:id/chamar-totem', autenticarToken, async (req, res) => {
    try {
        await db.collection("fila_ponto").updateOne(
            { _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id },
            { $set: { chamando_totem: true, status: "Atendido" } } 
        );
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.get('/api/totem/chamadas', autenticarToken, async (req, res) => {
    try {
        const chamadas = await db.collection("fila_ponto").find({
            cliente_id: req.usuario.cliente_id,
            chamando_totem: true
        }).toArray();
        res.json(chamadas);
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.put('/api/fila/:id/chamada-concluida', autenticarToken, async (req, res) => {
    try {
        await db.collection("fila_ponto").updateOne(
            { _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id },
            { $set: { chamando_totem: false } }
        );
        res.json({ok: true});
    } catch(e) { res.status(500).json({erro: "Erro"}); }
});

app.post('/api/acessar-empresa/:id', autenticarToken, async (req, res) => {
    if (req.usuario.tipo !== "superadmin") return res.status(403).json({erro: "Acesso Negado"});
    const empresa = await db.collection("usuarios").findOne({ _id: new ObjectId(req.params.id) });
    if (!empresa) return res.status(404).json({erro: "Empresa não encontrada"});

    const tokenNovo = jwt.sign(
        { id: req.usuario.id, tipo: "master", cliente_id: empresa.cliente_id, superadmin_original: true },
        process.env.JWT_SECRET || "NERI_SECRET_2026", { expiresIn: "12h" }
    );
    res.json({ ok: true, token: tokenNovo, nome: empresa.empresaNome });
});

app.post('/api/voltar-admin', autenticarToken, async (req, res) => {
    if (!req.usuario.superadmin_original) return res.status(403).json({erro: "Negado"});
    const tokenNovo = jwt.sign(
        { id: req.usuario.id, tipo: "superadmin", cliente_id: "GLOBAL_SYSTEM" },
        process.env.JWT_SECRET || "NERI_SECRET_2026", { expiresIn: "12h" }
    );
    res.json({ ok: true, token: tokenNovo });
});

app.post('/api/pecas/catalogo', autenticarToken, async (req, res) => {
    try {
        const { nome, codigo, quantidade_inicial } = req.body;
        await db.collection("catalogo_pecas").insertOne({
            cliente_id: req.usuario.cliente_id,
            nome: nome.toUpperCase().trim(),
            codigo: codigo || "",
            estoque: Number(quantidade_inicial) || 0,
            criadoEm: new Date()
        });
        res.json({ ok: true });
    } catch(e) { res.status(500).json({erro: "Erro ao cadastrar peça"}); }
});

app.get('/api/pecas/catalogo', autenticarToken, async (req, res) => {
    try {
        const pecas = await db.collection("catalogo_pecas").find({ cliente_id: req.usuario.cliente_id }).sort({ nome: 1 }).toArray();
        res.json(pecas);
    } catch(e) { res.status(500).json({erro: "Erro ao listar peças"}); }
});

app.delete('/api/pecas/catalogo/:id', autenticarToken, async (req, res) => {
    try {
        await db.collection("catalogo_pecas").deleteOne({ _id: new ObjectId(req.params.id), cliente_id: req.usuario.cliente_id });
        res.json({ ok: true });
    } catch(e) { res.status(500).json({erro: "Erro ao excluir peça"}); }
});

// --- LISTAR SOLICITAÇÕES DE PEÇAS COM FILTRO DE DATA ---
app.get('/api/pecas/solicitacoes', autenticarToken, async (req, res) => {

    try {

        let filtro = {
            cliente_id: req.usuario.cliente_id
        };


        if (req.query.data) {

            const inicioDia = new Date(
                req.query.data + "T00:00:00.000Z"
            );

            const fimDia = new Date(
                req.query.data + "T23:59:59.999Z"
            );


            filtro.dataSolicitacao = {
                $gte: inicioDia,
                $lte: fimDia
            };

        }



        const solicitacoes =
            await db.collection("solicitacoes_pecas")
            .find(filtro)
            .sort({
                dataSolicitacao:-1
            })
            .toArray();



        res.json(solicitacoes);



    } catch(e) {


        console.error(e);


        res.status(500).json({
            erro:"Erro ao buscar solicitações"
        });


    }

});







// --- RECEBER SOLICITAÇÃO COM VÁRIAS PEÇAS ---
app.post('/api/pecas/solicitar', autenticarToken, async (req,res)=>{

    try {


        const {
            tecnico,
            pecas,
            observacao
        } = req.body;



        if(
            !tecnico ||
            !pecas ||
            !Array.isArray(pecas) ||
            pecas.length === 0
        ){

            return res.status(400).json({
                erro:"Nenhuma peça informada."
            });

        }




        const solicitacao = {

            cliente_id:req.usuario.cliente_id,

            tecnico,


            pecas:pecas.map(item=>({


                peca_id:item.peca_id,

                nome_peca:item.nome_peca,

                quantidade:Number(item.quantidade) || 0


            })),


            observacao:observacao || "",


            status:"Pendente",


            dataSolicitacao:new Date()


        };




        await db.collection("solicitacoes_pecas")
        .insertOne(solicitacao);



        res.json({

            ok:true,

            mensagem:"Solicitação enviada com sucesso."

        });



    }catch(e){


        console.error(e);


        res.status(500).json({

            erro:"Erro ao solicitar peças"

        });


    }

});








// --- EDITAR UMA PEÇA ESPECÍFICA DA SOLICITAÇÃO ---
app.put('/api/pecas/solicitacoes/:id/peca/:pecaId', autenticarToken, async(req,res)=>{


    try{


        const { quantidade } = req.body;



        const solicitacao =
            await db.collection("solicitacoes_pecas")
            .findOne({

                _id:new ObjectId(req.params.id),

                cliente_id:req.usuario.cliente_id

            });



        if(!solicitacao){

            return res.status(404).json({

                erro:"Solicitação não encontrada"

            });

        }




        const indice =
            solicitacao.pecas.findIndex(

                p =>
                String(p.peca_id) === String(req.params.pecaId)

            );



        if(indice === -1){

            return res.status(404).json({

                erro:"Peça não encontrada"

            });

        }



        solicitacao.pecas[indice].quantidade =
            Number(quantidade) || 0;




        await db.collection("solicitacoes_pecas")
        .updateOne(

            {

                _id:new ObjectId(req.params.id),

                cliente_id:req.usuario.cliente_id

            },

            {

                $set:{

                    pecas:solicitacao.pecas

                }

            }

        );



        res.json({

            ok:true

        });



    }catch(e){


        console.error(e);


        res.status(500).json({

            erro:"Erro ao alterar quantidade"

        });


    }


});









// --- EXCLUIR UMA PEÇA ESPECÍFICA DA SOLICITAÇÃO ---
app.delete('/api/pecas/solicitacoes/:id/peca/:pecaId', autenticarToken, async(req,res)=>{


    try{


        const solicitacao =
            await db.collection("solicitacoes_pecas")
            .findOne({

                _id:new ObjectId(req.params.id),

                cliente_id:req.usuario.cliente_id

            });



        if(!solicitacao){

            return res.status(404).json({

                erro:"Solicitação não encontrada"

            });

        }



        const novasPecas =
            solicitacao.pecas.filter(

                p =>
                String(p.peca_id) !== String(req.params.pecaId)

            );



        await db.collection("solicitacoes_pecas")
        .updateOne(

            {

                _id:new ObjectId(req.params.id),

                cliente_id:req.usuario.cliente_id

            },

            {

                $set:{

                    pecas:novasPecas

                }

            }

        );



        res.json({

            ok:true

        });



    }catch(e){


        console.error(e);


        res.status(500).json({

            erro:"Erro ao excluir peça"

        });


    }


});








// --- EDITAR SOLICITAÇÃO COMPLETA (COMPATIBILIDADE) ---
app.put('/api/pecas/solicitacoes/:id/editar', autenticarToken, async(req,res)=>{


    try{


        const { pecas } = req.body;



        if(!pecas || !Array.isArray(pecas)){


            return res.status(400).json({

                erro:"Lista de peças inválida"

            });


        }



        await db.collection("solicitacoes_pecas")
        .updateOne(

            {

                _id:new ObjectId(req.params.id),

                cliente_id:req.usuario.cliente_id

            },

            {

                $set:{

                    pecas:pecas.map(item=>({

                        peca_id:item.peca_id,

                        nome_peca:item.nome_peca,

                        quantidade:Number(item.quantidade)||0

                    }))

                }

            }

        );



        res.json({

            ok:true

        });



    }catch(e){


        console.error(e);


        res.status(500).json({

            erro:"Erro ao editar solicitação"

        });


    }


});









// --- EXCLUIR SOLICITAÇÃO COMPLETA ---
app.delete('/api/pecas/solicitacoes/:id', autenticarToken, async(req,res)=>{


    try{


        await db.collection("solicitacoes_pecas")
        .deleteOne({

            _id:new ObjectId(req.params.id),

            cliente_id:req.usuario.cliente_id

        });



        res.json({

            ok:true

        });



    }catch(e){


        console.error(e);


        res.status(500).json({

            erro:"Erro ao excluir solicitação"

        });


    }


});