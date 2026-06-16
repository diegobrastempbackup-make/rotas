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

  // CORREÇÃO DA EXIBIÇÃO DOS BOTÕES POR PERFIL
  if (tipoDashboard === "master") {
    if (btnDados) btnDados.style.display = "block";
    if (btnEstoque) btnEstoque.style.display = "block";
    if (btnCadastrar) btnCadastrar.style.display = "block"; // Mudado para block para o master ver!
  } else if (tipoDashboard === "admin") {
    if (btnDados) btnDados.style.display = "block";
    if (btnEstoque) btnEstoque.style.display = "block";
    if (btnCadastrar) btnCadastrar.style.display = "none";
  } else if (tipoDashboard === "simples") {
    if (btnDados) btnDados.style.display = "none";
    if (btnCadastrar) btnCadastrar.style.display = "none";
    if (btnEstoque) btnEstoque.style.display = "none";
  }

  carregarDados();
}); // <--- Agora este fechamento está correto porque a função foi aberta lá no topo!

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
  const nome = document.getElementById("cadNome").value.trim();
  const usuario = document.getElementById("cadUsuario").value.trim();
  const senha = document.getElementById("cadSenha").value;
  const tipo = document.getElementById("cadTipo").value;

  if (!nome || !usuario) {
    alert("Preencha todos os campos.");
    return;
  }

  try {

    let resposta;

    if (id) {

      resposta = await fetch(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenDashboard}`
        },
        body: JSON.stringify({
          nome,
          tipo,
          senha
        })
      });

    } else {

      resposta = await fetch("/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenDashboard}`
        },
        body: JSON.stringify({
          nome,
          usuario,
          senha,
          tipo
        })
      });

    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      alert(dados.erro || "Erro");
      return;
    }

    alert("Operação realizada com sucesso!");

    fecharModalCadastro();
    atualizarListaUsuarios();

  } catch (err) {

    console.error(err);

    alert("Erro ao conectar com o servidor.");

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

// =================================================================
// EXTRAÇÃO E GERADO DE RELATÓRIOS EM PDF (jsPDF)
// =================================================================
function exportarPDF() {
  if (!dadosGlobal || dadosGlobal.length === 0) {
    alert("Não há dados carregados para gerar o relatório.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Filtra com base no mês selecionado no input HTML
  const mesSelecionado = document.getElementById("mesFiltro") ? document.getElementById("mesFiltro").value : "";
  let dadosFiltrados = [...dadosGlobal];

  if (mesSelecionado) {
    dadosFiltrados = dadosFiltrados.filter(d => d.data && d.data.startsWith(mesSelecionado));
  }

  // Filtra os dados com base no técnico atual (Se for TODOS, pega a lista inteira do mês)
  if (tecnicoAtual !== "TODOS") {
    dadosFiltrados = dadosFiltrados.filter(d => String(d.tecnico).toLowerCase() === tecnicoAtual.toLowerCase());
  }

  if (dadosFiltrados.length === 0) {
    alert(`Nenhum registro encontrado para ${tecnicoAtual} no período selecionado.`);
    return;
  }

  // Ordena os registros por data (mais antigo para o mais recente)
  dadosFiltrados.sort((a, b) => new Date(a.data) - new Date(b.data));

  // --- CONFIGURAÇÃO DE DESIGN (PADRÃO NERI) ---
  const corPrimaria = [15, 23, 42]; // #0F172A
  let paginaAtual = 1;

  function verificarMesAnoExtenso(anoMes) {
    if (!anoMes || !anoMes.includes("-")) return "";
    const [ano, mes] = anoMes.split("-");
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${meses[parseInt(mes) - 1]} de ${ano}`;
  }

  function desenharCabecalho() {
    // Topo escuro elegante
    doc.setFillColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
    doc.rect(0, 0, 210, 40, "F");

    // Tentar desenhar a logo se ela existir no HTML
    const imgLogo = document.getElementById("logoNERI");
    if (imgLogo && imgLogo.src) {
      try {
        doc.addImage(imgLogo, "PNG", 12, 5, 30, 30);
      } catch (e) {
        console.log("Aviso: logo.png não pôde ser carregada no PDF localmente (CORS).");
      }
    }

    // Títulos do Relatório
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NERI - GESTÃO DE FROTAS", 48, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Cinza claro

    const textoFiltro = tecnicoAtual === "TODOS" ? "RELATÓRIO GERAL DE MOVIMENTAÇÃO" : `RELATÓRIO INDIVIDUAL: ${tecnicoAtual.toUpperCase()}`;
    doc.text(textoFiltro, 48, 23);
    
    const labelPeriodo = mesSelecionado ? `Competência: ${verificarMesAnoExtenso(mesSelecionado).toUpperCase()}` : "Período: Total Acumulado";
    doc.text(labelPeriodo, 48, 29);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 48, 35);

    // Cabeçalho da Tabela
    let yTabela = 50;
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.rect(10, yTabela - 5, 190, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    
    // Alinhamento das colunas dependendo se é Geral ou Individual
    doc.text("DATA", 13, yTabela);
    if (tecnicoAtual === "TODOS") {
      doc.text("VEÍCULO / TÉCNICO", 40, yTabela);
      doc.text("KM REGISTRADO", 90, yTabela);
    } else {
      doc.text("KM REGISTRADO", 55, yTabela);
    }
    doc.text("LITROS", 125, yTabela);
    doc.text("VALOR (R$)", 153, yTabela);
    doc.text("MÉDIA (KM/L)", 178, yTabela);
  }

  desenharCabecalho();

  let y = 58;
  let totalKm = 0;
  let totalLitros = 0;
  let totalValor = 0;

  function verificarPagina() {
    if (y > 270) {
      // Rodapé da página que está terminando
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Página ${paginaAtual}`, 190, 287);

      doc.addPage();
      paginaAtual++;
      desenharCabecalho();
      y = 58;
    }
  }

  // --- LOOP DOS DADOS ---
  dadosFiltrados.forEach((d, indice) => {
    const km = Number(d.km) || 0;
    const litros = Number(d.litros) || 0;
    const valor = Number(d.valor) || 0;
    
    totalKm += km;
    totalLitros += litros;
    totalValor += valor;

    // Linhas zebradas para facilitar a leitura visual
    doc.setFillColor(indice % 2 === 0 ? 255 : 248, indice % 2 === 0 ? 255 : 248, indice % 2 === 0 ? 255 : 248);
    doc.rect(10, y - 5, 190, 8, "F");
    doc.setDrawColor(241, 245, 249);
    doc.rect(10, y - 5, 190, 8, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    // Formata a data de AAAA-MM-DD para DD/MM/AAAA
    let dataFormatada = String(d.data).split("T")[0];
    if (dataFormatada.includes("-")) {
      const partes = dataFormatada.split("-");
      dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    doc.text(dataFormatada, 13, y);

    if (tecnicoAtual === "TODOS") {
      doc.text(String(d.tecnico || "-"), 40, y);
      doc.text(km.toLocaleString("pt-BR"), 90, y);
    } else {
      doc.text(km.toLocaleString("pt-BR"), 55, y);
    }

    doc.text(litros.toFixed(2), 125, y);
    doc.text(valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), 153, y);
    
    const media = litros > 0 ? km / litros : 0;
    doc.text(media > 0 ? `${media.toFixed(2)} km/l` : "-", 178, y);

    y += 8;
    verificarPagina();
  });

  // --- QUADRO DE TOTAIS CONSOLIDADO ---
  if (y > 240) { 
    y += 5;
    verificarPagina();
  } else {
    y += 5;
  }

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, y, 190, 32, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("RESUMO ACUMULADO DO PERÍODO", 15, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`DISTÂNCIA TOTAL PERCORRIDA: ${totalKm.toLocaleString("pt-BR")} KM`, 15, y + 17);
  doc.text(`TOTAL DE COMBUSTÍVEL: ${totalLitros.toFixed(2)} LITROS`, 15, y + 24);

  doc.text(`VALOR TOTAL INVESTIDO: ${totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 115, y + 17);
  const mediaGeral = totalLitros > 0 ? totalKm / totalLitros : 0;
  doc.text(`MÉDIA GERAL DA FROTA: ${mediaGeral > 0 ? `${mediaGeral.toFixed(2)} KM/L` : "-"}`, 115, y + 24);

  // Rodapé final
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Página ${paginaAtual}`, 190, 287);

  // Define o nome de saída do documento baseado no contexto do filtro
  const sulfixoMes = mesSelecionado ? `_${mesSelecionado}` : "";
  const nomeArquivo = tecnicoAtual === "TODOS" ? `Relatorio_Geral_Frota${sulfixoMes}.pdf` : `Relatorio_Frota_${tecnicoAtual}${sulfixoMes}.pdf`;
  
  doc.save(nomeArquivo);
}