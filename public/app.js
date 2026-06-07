// ⏱️ CONTROLE DE INATIVIDADE (5 MINUTOS)
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

// Definições Globais do Sistema
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

function sair() {
  localStorage.clear(); 
  window.location.replace("/login.html");
}

function acessar() {
  const tokenLogin = localStorage.getItem("token");
  if (tokenLogin) {
    window.location.href = `/dados.html?token=${tokenLogin}`;
  } else {
    window.location.replace("/login.html");
  }
}

// ========================================================
// 👤 SEÇÃO: GERENCIAMENTO DE USUÁRIOS (LOGICA DE 3 NÍVEIS)
// ========================================================

async function abrirModalGerenciamento() {
  document.getElementById("modalCadastro").classList.add("show");
  document.getElementById("secaoListaUsuarios").style.display = "block";
  document.getElementById("formUsuario").style.display = "none";
  document.getElementById("btnSalvarUsuario").style.display = "none";
  await atualizarListaUsuarios();
}

async function atualizarListaUsuarios() {
  const container = document.getElementById("listaUsuariosContainer");
  container.innerHTML = "<p style='text-align:center;'>Carregando usuários...</p>";
  
  try {
    const res = await fetch("/usuarios");
    const usuarios = await res.json();
    
    container.innerHTML = "";
    usuarios.forEach(u => {
      const div = document.createElement("div");
      div.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);";
      
      let badge = "";
      if (u.tipo === "master") {
        badge = "<span style='color:#f59e0b; font-size:11px;'>[Master]</span>";
      } else if (u.tipo === "admin") {
        badge = "<span style='color:#60A5FA; font-size:11px;'>[Admin]</span>";
      } else {
        badge = "<span style='color:#94A3B8; font-size:11px;'>[Simples]</span>";
      }
      
      div.innerHTML = `
        <div>
          <strong>${u.nome}</strong> <br> ${badge} <span style='color:#64748B; font-size:12px;'>(${u.usuario})</span>
        </div>
        <button onclick="prepararEdicao('${u._id}', '${u.nome}', '${u.usuario}', '${u.tipo}')" style="width: auto; margin: 0; padding: 5px 10px; background: #3b82f6; font-size: 12px;">Editar</button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>Erro ao carregar lista.</p>";
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
  
  document.getElementById("secaoListaUsuarios").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
}

function prepararEdicao(id, nome, usuario, tipo) {
  document.getElementById("formTitulo").innerText = `Editar: ${usuario}`;
  document.getElementById("editId").value = id;
  document.getElementById("cadNome").value = nome;
  document.getElementById("cadUsuario").value = usuario;
  document.getElementById("cadUsuario").disabled = true; 
  document.getElementById("cadSenha").value = "";
  document.getElementById("lblSenha").innerText = "Nova Senha (deixe em branco para manter a atual):";
  document.getElementById("cadSenha").placeholder = "Preencha apenas se for alterar";
  document.getElementById("cadTipo").value = tipo;

  document.getElementById("secaoListaUsuarios").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
}

function fecharModalCadastro() {
  document.getElementById("modalCadastro").classList.remove("show");
}

async function salvarUsuario() {
  const id = document.getElementById("editId").value;
  const nome = document.getElementById("cadNome").value.trim();
  const usuario = document.getElementById("cadUsuario").value.trim();
  const senha = document.getElementById("cadSenha").value;
  const tipo = document.getElementById("cadTipo").value;

  if (!nome || !usuario) {
    alert("Nome e Usuário são obrigatórios!");
    return;
  }

  if (id) {
    try {
      const respuesta = await fetch(`/usuario/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, tipo, novaSenha: senha })
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) return alert(resultado.erro || "Erro ao atualizar");
      
      alert("Alterações salvas com sucesso!");
      if(usuario === localStorage.getItem("usuarioLogado")) {
        localStorage.setItem("usuarioTipo", tipo);
      }
      abrirModalGerenciamento(); 
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  } else {
    if (!senha) return alert("A senha é obrigatória para novos usuários!");
    
    try {
      const respuesta = await fetch("/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

// ========================================================
// REQUISITIONS E FILTROS DO DASHBOARD
// ========================================================

function obtenerMesAtual(){
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}`;
}

function dadosPorMes(mes){
  return dadosGlobal.filter(d => d.data && d.data.startsWith(mes));
}

async function carregarDados(){
  const res = await fetch("/registros");
  dadosGlobal = await res.json();
  dadosGlobal.sort((a,b) => new Date(a.data) - new Date(b.data));

  // Proteção: Só atualiza elementos do Dashboard se o campo de filtro do Dashboard existir na tela
  const filtroMesDashboard = document.getElementById("mesFiltro");
  if (filtroMesDashboard && document.getElementById("g1")) {
    const mesAtual = obtenerMesAtual();
    filtroMesDashboard.value = mesAtual;
    processar(dadosPorMes(mesAtual), tecnicoAtual);
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

function atualizarDashboard(valores, kms, tecnico, gastoInd, kmInd, litrosInd){
  if (!document.getElementById("g1")) return; // Aborta se não estiver no dashboard index.html

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
        title: { display: true, text: "💰 GASTO POR VEÍCULO", color: "#fff", font: { size: 16, weight: "bold" } },
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
        title: { display: true, text: "🛣️ QUILOMETRAGEM POR VEÍCULO", color: "#fff", font: { size: 16, weight: "bold" } },
        datalabels: { 
          color: "#fff", anchor: "end", align: "top", offset: 4, font: { weight: "bold" },
          formatter: (val) => val > 0 ? val.toLocaleString("pt-BR") + " KM" : ""
        }
      },
      scales: { x: { ticks: { color: "#94A3B8" }, grid: { display: false } }, y: { grace: "15%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } } }
    }
  });
}

// 🗑️ NOVA FUNÇÃO: DISPARAR A LIXEIRA DIRETO NO SERVIDOR E ATUALIZAR A TELA
async function deletarRegistro(id) {
  if (!id || id === "undefined" || id === "") {
    alert("Este registro é novo e ainda não está salvo no banco. Basta limpar os campos dele e clicar em Salvar.");
    return;
  }

  if (!confirm("Tem certeza absoluta de que deseja excluir permanentemente esta linha do sistema?")) {
    return;
  }

  try {
    const respuesta = await fetch(`/registro/${id}`, {
      method: "DELETE"
    });

    const resultado = await respuesta.json();

    if (resposta.ok) {
      alert("Registro excluído com sucesso!");
      
      dadosGlobal = dadosGlobal.filter(d => d._id !== id);
      
      // Se a função carregar da tela dados.html existir, atualiza ela sincronizadamente
      if (typeof carregar === "function") {
        const mesAtual = document.getElementById("mesFiltro").value;
        await carregar(