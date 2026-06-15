// =================================================================
// CONTROLE DE INATIVIDADE (5 MINUTOS)
// =================================================================
let temporizadorInatividade;

function resetarTemporizador() {
  clearTimeout(temporizadorInatividade);
  temporizadorInatividade = setTimeout(efetuarAutoLogout, 5 * 60 * 1000);
}

function efetuarAutoLogout() {
  alert("Sessão expirada por inatividade. Por favor, faça login novamente.");
  localStorage.removeItem("token");
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("usuarioTipo");
  window.location.replace("/login.html");
}

window.onload = resetarTemporizador;
window.onmousemove = resetarTemporizador;
window.onmousedown = resetarTemporizador;
window.ontouchstart = resetarTemporizador;
window.onclick = resetarTemporizador;     
window.onkeydown = resetarTemporizador;

// =================================================================
// DEFINIÇÕES GLOBAIS DO SISTEMA
// =================================================================
const tecnicos = [
  "Sibele",
  "Empresa",
  "Danilo",
  "José Cicero",
  "Alex",
  "Danilo BH",
  "Thiago BH"
];

let dadosGlobal = [];
let tecnicoAtual = "TODOS";
let grafico1;
let grafico2;

const tokenDashboard = localStorage.getItem("token");

// Se não houver token, manda de volta para o login imediatamente
if (!tokenDashboard) {
  window.location.replace("/login.html");
}

// =================================================================
// INICIALIZAÇÃO DE PERMISSÕES E BOTÕES (DOM LOADED)
// =================================================================
window.addEventListener("DOMContentLoaded", async () => {
  let tipoDashboard = localStorage.getItem("usuarioTipo");
  const usuarioLogadoNome = localStorage.getItem("usuarioLogado") || "master";
  const usuarioNomeReal = localStorage.getItem("usuarioNome");

  // Trava visual para o perfil de estoque
  if (usuarioNomeReal && usuarioNomeReal.toUpperCase().includes("ESTOQUE")) {
    tipoDashboard = "estoque";
    localStorage.setItem("usuarioTipo", "estoque");
  }
  
  if (!tipoDashboard || tipoDashboard === "undefined" || tipoDashboard === "null") {
    try {
      const resPerfil = await fetch("/api/usuarios", {
        headers: { "Authorization": `Bearer ${tokenDashboard}` }
      });
      if (resPerfil.ok) {
        const usuariosLista = await resPerfil.json();
        const usuarioAtual = usuariosLista.find(u => u.usuario === usuarioLogadoNome);
        
        if (usuarioAtual) {
          if (usuarioAtual.nome && usuarioAtual.nome.toUpperCase().includes("ESTOQUE")) {
            tipoDashboard = "estoque";
          } else {
            tipoDashboard = usuarioAtual.tipo;
          }
          localStorage.setItem("usuarioTipo", tipoDashboard);
        } else {
          tipoDashboard = "master";
          localStorage.setItem("usuarioTipo", "master");
        }
      }
    } catch (e) {
      console.error("Erro na trava de segurança de perfil:", e);
      tipoDashboard = "master";
    }
  }

  // Se o usuário for puramente do estoque, redireciona para a página correta de ferramentas
  if (tipoDashboard === "estoque") {
    window.location.replace("/estoque.html");
    return;
  }

  const btnDados = document.getElementById("btnIrParaDados");
  const btnCadastrar = document.getElementById("btnMenuCadastro");
  const btnEstoque = document.getElementById("btnIrParaEstoque");
  const perfilBadge = document.getElementById("perfilTipo");

  if (perfilBadge && tipoDashboard) {
    perfilBadge.innerText = `Dashboard (${tipoDashboard.toUpperCase()})`;
  }

  if (tipoDashboard === "master") {
    if (btnDados) btnDados.style.display = "block";
    if (btnCadastrar) btnCadastrar.style.display = "block";
    if (btnEstoque) btnEstoque.style.display = "block";
  } else if (tipoDashboard === "admin") {
    if (btnDados) btnDados.style.display = "block";
    if (btnEstoque) btnEstoque.style.display = "block";
  } else if (tipoDashboard === "simples") {
    if (btnDados) btnDados.style.display = "none";
    if (btnCadastrar) btnCadastrar.style.display = "none";
    if (btnEstoque) btnEstoque.style.display = "none";
  }

  carregarDados();
});

// =================================================================
// NAVEGAÇÃO DO MENU
// =================================================================
function irParaEstoque() {
  const token = localStorage.getItem("token");
  window.location.href = `/estoque.html?token=${token}`;
}

function acessar() {
  const tokenLogin = localStorage.getItem("token");
  if (tokenLogin) {
    window.location.href = `/dados.html?token=${tokenLogin}`;
  } else {
    window.location.replace("/login.html");
  }
}

function sair() {
  localStorage.clear(); 
  window.location.replace("/login.html");
}

// =================================================================
// GERENCIAMENTO DE USUÁRIOS (MODAL)
// =================================================================
async function abrirModalGerenciamento() {
  document.getElementById("modalCadastro").classList.add("show");
  document.getElementById("secaoListaUsuarios").style.display = "block";
  document.getElementById("formUsuario").style.display = "none";
  document.getElementById("btnSalvarUsuario").style.display = "none";
  await atualizarListaUsuarios();
}

function fecharModalCadastro() {
  document.getElementById("modalCadastro").classList.remove("show");
}

async function atualizarListaUsuarios() {
  const container = document.getElementById("listaUsuariosContainer");
  container.innerHTML = "<p style='text-align:center;'>Carregando usuários...</p>";
  
  try {
    const res = await fetch("/api/usuarios", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    const usuarios = await res.json();
    
    container.innerHTML = "";
    usuarios.forEach(u => {
      const div = document.createElement("div");
      div.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);";
      
      let exibicaoNome = u.nome;
      let exibicaoTipo = u.tipo;

      if (u.nome && u.nome.toUpperCase().includes("ESTOQUE")) {
        exibicaoNome = u.nome.replace(" [ESTOQUE]", "").replace(" ESTOQUE", "").trim();
        exibicaoTipo = "estoque";
      }

      let badge = "";
      if (exibicaoTipo === "master") {
        badge = "<span style='color:#f59e0b; font-size:11px;'>[Master]</span>";
      } else if (exibicaoTipo === "admin") {
        badge = "<span style='color:#60A5FA; font-size:11px;'>[Admin]</span>";
      } else if (exibicaoTipo === "estoque") {
        badge = "<span style='color:#10B981; font-size:11px;'>[Estoque]</span>";
      } else {
        badge = "<span style='color:#94A3B8; font-size:11px;'>[Simples]</span>";
      }
      
      const idGarantido = u._id || u.id || "";

      div.innerHTML = `
        <div>
          <strong>${exibicaoNome}</strong> <br> ${badge} <span style='color:#64748B; font-size:12px;'>(${u.usuario})</span>
        </div>
        <div style="display: flex; gap: 5px;">
          <button onclick="prepararEdicao('${idGarantido}', '${exibicaoNome}', '${u.usuario}', '${exibicaoTipo}')" style="width: auto; margin: 0; padding: 5px 10px; background: #3b82f6; font-size: 12px;">Editar</button>
          <button onclick="excluirUsuario('${idGarantido}')" style="width: auto; margin: 0; padding: 5px 10px; background: #ef4444; font-size: 12px;">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>Erro ao carregar lista.</p>";
  }
}

async function excluirUsuario(id) {
  if (!id) {
    alert("Identificador do usuário inválido.");
    return;
  }

  if (!confirm("Tem certeza absoluta que deseja remover este usuário permanentemente?")) {
    return;
  }

  try {
    const resposta = await fetch(`/api/usuarios/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${tokenDashboard}`
      }
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      return alert(dados.erro || "Erro interno ao tentar apagar usuário.");
    }

    alert("Usuário removido com sucesso!");
    await atualizarListaUsuarios(); 
  } catch (err) {
    console.error("Falha ao deletar:", err);
    alert("Erro ao conectar com o servidor.");
  }
}

function mostrarFormularioCadastro() {
  document.getElementById("formTitulo").innerText = "Novo Usuário";
  document.getElementById("editId").value = "";
  document.getElementById("cadNome").value = "";
  document.getElementById("cadUsuario").value = "";
  document.getElementById("cadUsuario").disabled = false; 
  document.getElementById("cadSenha").value = "";
  document.getElementById("lblSenha").innerText = "Senha:";
  document.getElementById("cadSenha").placeholder = "Senha de acesso";
  document.getElementById("cadTipo").value = "simples";
  
  document.getElementById("secaoListaUsuarios").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
}

function prepararEdicao(id, nome, usuario, tipoReal) {
  document.getElementById("formTitulo").innerText = `Editar: ${usuario}`;
  document.getElementById("editId").value = id;
  document.getElementById("cadNome").value = nome;
  document.getElementById("cadUsuario").value = usuario;
  document.getElementById("cadUsuario").disabled = true; 
  document.getElementById("cadSenha").value = "";
  document.getElementById("lblSenha").innerText = "Nova Senha (deixe em branco para manter a atual):";
  document.getElementById("cadSenha").placeholder = "Preencha apenas se for alterar";
  document.getElementById("cadTipo").value = tipoReal;

  document.getElementById("secaoListaUsuarios").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
}

async function salvarUsuario() {
  const id = document.getElementById("editId").value;
  let nome = document.getElementById("cadNome").value.trim();
  const usuario = document.getElementById("cadUsuario").value.trim();
  const senha = document.getElementById("cadSenha").value;
  let tipo = document.getElementById("cadTipo").value;

  if (!nome || !usuario) {
    alert("Nome e Usuário são obrigatórios!");
    return;
  }

  if (tipo === "estoque") {
    tipo = "simples";
    if (!nome.toUpperCase().includes("ESTOQUE")) {
      nome = nome + " ESTOQUE";
    }
  } else {
    nome = nome.replace(" [ESTOQUE]", "").replace(" ESTOQUE", "").trim();
  }

  const dadosObjeto = { 
    nome: nome, 
    usuario: usuario, 
    tipo: tipo 
  };
  
  if (senha && senha.trim() !== "") {
    dadosObjeto.senha = senha;
  }

  if (id && id !== "undefined" && id !== "") {
    try {
      dadosObjeto._id = id;
      dadosObjeto.id = id;

      const respuesta = await fetch("/api/usuarios", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenDashboard}`
        },
        body: JSON.stringify(dadosObjeto)
      });
      
      if (!respuesta.ok) {
        const resultado = await respuesta.json();
        return alert(resultado.erro || "Erro retornado pelo servidor");
      }
      
      alert("Alterações salvas com sucesso!");
      if(usuario === localStorage.getItem("usuarioLogado")) {
        localStorage.setItem("usuarioTipo", tipo === "simples" && nome.toUpperCase().includes("ESTOQUE") ? "estoque" : tipo);
      }
      abrirModalGerenciamento(); 
    } catch (err) {
      console.error("Erro na requisição de salvamento:", err);
      alert("Erro ao conectar com o servidor. Verifique os dados.");
    }

  } else {
    if (!senha) return alert("A senha é obrigatória para novos usuários!");
    try {
      const respuesta = await fetch("/api/usuarios", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenDashboard}`
        },
        body: JSON.stringify({ nome, usuario, senha, tipo })
      });
      const dados = await respuesta.json();
      if (!respuesta.ok) return alert(dados.erro || "Erro ao cadastrar");

      alert("Novo usuário cadastrado!");
      abrirModalGerenciamento(); 
    } catch (err) {
      alert("Erro de comunicação com o servidor.");
    }
  }
}

// =================================================================
// REQUISIÇÃO E FILTROS DO DASHBOARD
// =================================================================
function obtenerMesAtual(){
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}`;
}

function dadosPorMes(mes){
  return dadosGlobal.filter(d => d.data && d.data.startsWith(mes));
}

async function carregarDados(){
  try {
    const res = await fetch("/api/registros", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    dadosGlobal = await res.json();
    dadosGlobal.sort((a,b) => new Date(a.data) - new Date(b.data));

    if (document.getElementById("mesFiltro") && document.getElementById("g1")) {
      const mesAtual = obtenerMesAtual();
      document.getElementById("mesFiltro").value = mesAtual;
      processar(dadosPorMes(mesAtual), tecnicoAtual);
    }
  } catch (err) {
    console.error("Erro ao carregar dados do dashboard:", err);
  }
}

function filtrar(nome){
  tecnicoAtual = nome;
  processar(dadosPorMes(document.getElementById("mesFiltro").value), tecnicoAtual);
}

function filtrarMes(){
  processar(dadosPorMes(document.getElementById("mesFiltro").value), tecnicoAtual);
}

function limparFiltro(){
  const mesAtual = obtenerMesAtual();
  document.getElementById("mesFiltro").value = mesAtual;
  tecnicoAtual = "TODOS";
  processar(dadosPorMes(mesAtual), tecnicoAtual);
}

function processar(dados, tecnico){
  let valoresGerais = Array(tecnicos.length).fill(0);
  let kmsGerais = Array(tecnicos.length).fill(0);

  let gastoInd = 0;
  let kmInd = 0;
  let litrosInd = 0;

  dados.forEach(d => {
    const idx = tecnicos.indexOf(d.tecnico);
    if(idx >= 0){
      kmsGerais[idx] += Number(d.km) || 0;
      valoresGerais[idx] += Number(d.valor) || 0;
    }

    if (d.tecnico === tecnico) {
      gastoInd += Number(d.valor) || 0;
      kmInd += Number(d.km) || 0;
      litrosInd += Number(d.litros) || 0;
    }
  });

  atualizarDashboard(valoresGerais, kmsGerais, tecnico, gastoInd, kmInd, litrosInd);
}

// =================================================================
// ATUALIZAÇÃO DO DASHBOARD E RENDERIZAÇÃO DE GRÁFICOS (CHART.JS)
// =================================================================
function atualizarDashboard(valores, kms, tecnico, gastoInd, kmInd, litrosInd){
  //SEGURANÇA MÁXIMA: Se o gráfico g1 não estiver no HTML, sai da função na hora para evitar travamentos
  if (!document.getElementById("g1")) return;

  const totalValor = valores.reduce((a,b)=>a+b,0);
  const totalKm = kms.reduce((a,b)=>a+b,0);

  document.getElementById("gastoTotal").innerText = totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("kmTotal").innerText = totalKm.toLocaleString("pt-BR") + " KM";

  if(tecnico !== "TODOS"){
    const mediaKM = litrosInd > 0 ? (kmInd / litrosInd) : 0;

    document.getElementById("nomeTecnicoSelecionado").innerText = tecnico;
    document.getElementById("gastoIndividual").innerText = gastoInd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("kmIndividual").innerText = kmInd.toLocaleString("pt-BR") + " KM";
    document.getElementById("mediaIndividual").innerText = mediaKM.toFixed(1) + " KM/L";
  } else {
    document.getElementById("nomeTecnicoSelecionado").innerText = "TODOS";
    document.getElementById("gastoIndividual").innerText = "R$ 0,00";
    document.getElementById("kmIndividual").innerText = "0 KM";
    document.getElementById("mediaIndividual").innerText = "0.0 KM/L";
  }

  if (grafico1) { grafico1.destroy(); grafico1 = null; }
  if (grafico2) { grafico2.destroy(); grafico2 = null; }

  const ctx1 = document.getElementById("g1").getContext("2d");
  const grad1 = ctx1.createLinearGradient(0,0,0,400);
  grad1.addColorStop(0, "#3B82F6"); grad1.addColorStop(1, "#1D4ED8");

  grafico1 = new Chart(ctx1,{
    type: "bar",
    data: { 
      labels: tecnicos, 
      datasets: [{ label: "Gastos", data: valores, backgroundColor: grad1, borderRadius: 10, borderSkipped: false }] 
    },
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "GASTO MENSAL POR VEÍCULO", color: "#fff", font: { size: 16, weight: "bold" } },
        datalabels: { 
          color: "#fff", anchor: "end", align: "top", offset: 4, font: { weight: "bold" },
          formatter: (val) => val > 0 ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : ""
        }
      },
      scales: { x: { ticks: { color: "#94A3B8" }, grid: { display: false } }, y: { grace: "15%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } } }
    }
  });

  const ctx2 = document.getElementById("g2").getContext("2d");
  const grad2 = ctx2.createLinearGradient(0,0,0,400);
  grad2.addColorStop(0, "#10B981"); grad2.addColorStop(1, "#047857");

  grafico2 = new Chart(ctx2,{
    type: "bar",
    data: { 
      labels: tecnicos, 
      datasets: [{ label: "KM", data: kms, backgroundColor: grad2, borderRadius: 10, borderSkipped: false }] 
    },
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "KM MENSAL POR VEÍCULO", color: "#fff", font: { size: 16, weight: "bold" } },
        datalabels: { 
          color: "#fff", anchor: "end", align: "top", offset: 4, font: { weight: "bold" },
          formatter: (val) => val > 0 ? val.toLocaleString("pt-BR") + " KM" : ""
        }
      },
      scales: { x: { ticks: { color: "#94A3B8" }, grid: { display: false } }, y: { grace: "15%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } } }
    }
  });
}