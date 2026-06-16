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
// DEFINIÇÕES GLOBAIS DO SISTEMA (LISTA ORIGINAL RESTAURADA)
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

document.addEventListener("DOMContentLoaded", async () => {
  if (!tokenDashboard) {
    window.location.replace("/login.html");
    return;
  }

  // Define o mês atual como padrão no input
  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById("filtroMes").value = mesAtualStr;

  // Atualiza os dados quando mudar o mês
  document.getElementById("filtroMes").addEventListener("change", () => {
    processarDadosDashboard();
  });

  await checarPermissoesDoUsuario();
  montarMenuTecnicosFixo();
  await buscarDadosRegistros();
});

// Monta o menu lateral estático original para nunca sumir ninguém
function montarMenuTecnicosFixo() {
  const container = document.getElementById("containerTecnicosDinamicos");
  if (!container) return;
  container.innerHTML = "";

  tecnicos.forEach(nome => {
    const p = document.createElement("p");
    p.textContent = nome;
    p.className = tecnicoAtual === nome ? "active" : "";
    p.onclick = () => filtrar(nome);
    container.appendChild(p);
  });
}

function filtrar(nome) {
  tecnicoAtual = nome;
  
  // Atualiza classes active
  document.getElementById("btnTodos").className = nome === "TODOS" ? "active" : "";
  
  const ps = document.querySelectorAll("#containerTecnicosDinamicos p");
  ps.forEach(p => {
    if (p.textContent === nome) p.classList.add("active");
    else p.classList.remove("active");
  });

  processarDadosDashboard();
}

async function checarPermissoesDoUsuario() {
  const tipo = localStorage.getItem("usuarioTipo");
  if (tipo === "master" || tipo === "admin") {
    document.getElementById("btnIrParaDados").style.display = "block";
    document.getElementById("btnMenuCadastro").style.display = "block";
  }
  if (tipo === "master" || tipo === "admin" || tipo === "estoque") {
    document.getElementById("btnIrParaEstoque").style.display = "block";
  }
}

async function buscarDadosRegistros() {
  try {
    const res = await fetch("/api/registros", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    if (!res.ok) return;
    dadosGlobal = await res.json();
    processarDadosDashboard();
  } catch (err) {
    console.error(err);
  }
}

function processarDadosDashboard() {
  const mesFiltro = document.getElementById("filtroMes").value;

  let dadosFiltrados = dadosGlobal.filter(item => {
    if (!item.data) return false;
    const itemMes = String(item.data).substring(0, 7);
    const bateMes = itemMes === mesFiltro;

    if (tecnicoAtual === "TODOS") {
      return bateMes;
    } else {
      return bateMes && item.tecnico === tecnicoAtual;
    }
  });

  let totalKm = 0;
  let totalLitros = 0;
  let totalValor = 0;

  dadosFiltrados.forEach(item => {
    totalKm += Number(item.kmRodado) || 0;
    totalLitros += Number(item.litros) || 0;
    totalValor += Number(item.valor) || 0;
  });

  const mediaGeral = totalLitros > 0 ? (totalKm / totalLitros) : 0;

  document.getElementById("cardKm").textContent = totalKm.toLocaleString("pt-BR") + " KM";
  document.getElementById("cardLitros").textContent = totalLitros.toFixed(2) + " L";
  document.getElementById("cardValor").textContent = totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("cardMedia").textContent = mediaGeral > 0 ? mediaGeral.toFixed(2) + " km/l" : "-";

  renderizarGraficosDoPeriodo(dadosFiltrados);
}

function renderizarGraficosDoPeriodo(dados) {
  if (!dados || dados.length === 0) {
    if (grafico1) grafico1.destroy();
    if (grafico2) grafico2.destroy();
    return;
  }

  const diasDoMes = [...new Set(dados.map(item => String(item.data).split("-")[2]))].sort();

  const agrupado = {};
  diasDoMes.forEach(d => agrupado[d] = { km: 0, valor: 0, litros: 0 });

  dados.forEach(item => {
    const dia = String(item.data).split("-")[2];
    if (agrupado[dia]) {
      agrupado[dia].km += Number(item.kmRodado) || 0;
      agrupado[dia].valor += Number(item.valor) || 0;
      agrupado[dia].litros += Number(item.litros) || 0;
    }
  });

  const listaKms = diasDoMes.map(d => agrupado[d].km);
  const listaValores = diasDoMes.map(d => agrupado[d].valor);
  const listaMedias = diasDoMes.map(d => agrupado[d].litros > 0 ? (agrupado[d].km / agrupado[d].litros) : 0);

  if (grafico1) grafico1.destroy();
  if (grafico2) grafico2.destroy();

  Chart.register(ChartDataLabels);

  const ctx1 = document.getElementById("graficoKmGeral").getContext("2d");
  grafico1 = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: diasDoMes.map(d => "Dia " + d),
      datasets: [
        {
          label: "KM Rodado",
          data: listaKms,
          backgroundColor: "#2563EB",
          yAxisID: "y"
        },
        {
          label: "Valor Gasto (R$)",
          data: listaValores,
          backgroundColor: "#EF4444",
          type: "line",
          borderColor: "#EF4444",
          borderWidth: 2,
          fill: false,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: { display: false },
        legend: { labels: { color: "white" } }
      },
      scales: {
        x: { ticks: { color: "#94A3B8" } },
        y: { type: "linear", display: true, position: "left", ticks: { color: "#94A3B8" } },
        y1: { type: "linear", display: true, position: "right", grid: { drawOnChartArea: false }, ticks: { color: "#94A3B8" } }
      }
    }
  });

  const ctx2 = document.getElementById("graficoMediaGeral").getContext("2d");
  grafico2 = new Chart(ctx2, {
    type: "line",
    data: {
      labels: diasDoMes.map(d => "Dia " + d),
      datasets: [{
        label: "Média de Consumo (KM/L)",
        data: listaMedias,
        borderColor: "#10B981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderWidth: 3,
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: "white",
          anchor: "end",
          align: "top",
          formatter: (v) => v > 0 ? v.toFixed(1) + " km/l" : ""
        },
        legend: { labels: { color: "white" } }
      },
      scales: {
        x: { ticks: { color: "#94A3B8" } },
        y: { ticks: { color: "#94A3B8" } }
      }
    }
  });
}

function logout() {
  localStorage.clear();
  window.location.replace("/login.html");
}

// --- MODAL USUÁRIOS ---
function abrirModalCadastro() {
  document.getElementById("modalCadastro").style.display = "flex";
  carregarUsuariosLista();
}
function fecharModalCadastro() {
  document.getElementById("modalCadastro").style.display = "none";
  document.getElementById("formUsuario").style.display = "none";
  document.getElementById("listaUsuariosSecao").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "none";
}

async function carregarUsuariosLista() {
  try {
    const res = await fetch("/api/usuarios", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    const usuarios = await res.json();
    const container = document.getElementById("listaUsuariosContainer");
    container.innerHTML = "";

    usuarios.forEach(u => {
      container.innerHTML += `
        <div class="item-usuario">
          <span><strong>${u.nome}</strong> (${u.usuario}) - <small>${u.tipo}</small></span>
          <button class="btn-excluir-user" onclick="deletarUsuarioDoSistema('${u._id}')">Excluir</button>
        </div>
      `;
    });
  } catch (err) {
    console.log(err);
  }
}

function mostrarFormularioCadastro() {
  document.getElementById("listaUsuariosSecao").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
  
  document.getElementById("editId").value = "";
  document.getElementById("cadNome").value = "";
  document.getElementById("cadUsuario").value = "";
  document.getElementById("cadSenha").value = "";
}

async function salvarNovoUsuario() {
  const nome = document.getElementById("cadNome").value;
  const usuario = document.getElementById("cadUsuario").value;
  const senha = document.getElementById("cadSenha").value;
  const tipo = document.getElementById("cadTipo").value;

  if (!nome || !usuario || !senha) return alert("Preencha todos os campos");

  try {
    const res = await fetch("/cadastro", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenDashboard}`
      },
      body: JSON.stringify({ nome, usuario, senha, tipo })
    });
    if (res.ok) {
      fecharModalCadastro();
    } else {
      const e = await res.json();
      alert(e.erro);
    }
  } catch (err) {
    alert("Erro");
  }
}

async function deletarUsuarioDoSistema(id) {
  if (!confirm("Excluir este usuário?")) return;
  try {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    if (res.ok) carregarUsuariosLista();
  } catch (err) {
    console.log(err);
  }
}

// --- GERAÇÃO DE RELATÓRIO PDF ---
function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const mesFiltro = document.getElementById("filtroMes").value;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 30, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NERI frotas - RELATÓRIO MENSAL", 12, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`PERÍODO: ${mesFiltro} | EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}`, 12, 24);

  let y = 40;
  let totalKm = 0, totalLitros = 0, totalValor = 0;

  tecnicos.forEach(nome => {
    const dadosTecnico = dadosGlobal.filter(item => item.tecnico === nome && String(item.data).substring(0, 7) === mesFiltro);

    let tKm = 0, tLitros = 0, tValor = 0;
    dadosTecnico.forEach(i => {
      tKm += Number(i.kmRodado) || 0;
      tLitros += Number(i.litros) || 0;
      tValor += Number(i.valor) || 0;
    });

    totalKm += tKm;
    totalLitros += tLitros;
    totalValor += tValor;

    const tMedia = tLitros > 0 ? (tKm / tLitros) : 0;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235);
    doc.text(`TÉCNICO: ${nome.toUpperCase()}`, 12, y);
    doc.line(12, y + 2, 198, y + 2);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    
    doc.text(`Distância: ${tKm.toLocaleString("pt-BR")} KM`, 15, y);
    doc.text(`Combustível: ${tLitros.toFixed(2)} L`, 75, y);
    doc.text(`Investido: ${tValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 125, y);
    doc.text(`Média: ${tMedia > 0 ? tMedia.toFixed(2) + " km/l" : "-"}`, 175, y);

    y += 12;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(10, y + 5, 190, 25, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("CONSOLIDADO MENSAL DO SISTEMA", 15, y + 12);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Distância: ${totalKm.toLocaleString("pt-BR")} KM  |  Combustível: ${totalLitros.toFixed(2)} L  |  Total: ${totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 15, y + 20);

  doc.save(`Relatorio_Mensal_${mesFiltro}.pdf`);
}