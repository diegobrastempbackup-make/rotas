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
// DEFINIÇÕES GLOBAIS DO SISTEMA (DINÂMICAS)
// =================================================================
let tecnicos = []; 
let dadosGlobal = [];
let tecnicoAtual = "TODOS";
let grafico1;
let grafico2;

const tokenDashboard = localStorage.getItem("token");

if (!tokenDashboard) {
  window.location.replace("/login.html");
}

// =================================================================
// INICIALIZAÇÃO DO DASHBOARD
// =================================================================
async function iniciarDashboard() {
  configurarDropdownAno();
  aplicarRestricoesDeNivel();
  
  // 1. Carrega os técnicos ativos do banco
  await carregarTecnicosDaAPI();
  
  // 2. Preenche o select lateral de filtros
  popularSelectTecnicos();
  
  // 3. Define o mês atual no filtro e busca os dados
  const d = new Date();
  const mesAtual = String(d.getMonth() + 1).padStart(2, '0');
  const anoAtual = d.getFullYear();
  
  document.getElementById("filtroMes").value = mesAtual;
  document.getElementById("filtroAno").value = anoAtual;

  await buscarDadosDaAPI();
}

// BUSCA TÉCNICOS ATIVOS DIRECTO DA API (SINCRONIZADO)
async function carregarTecnicosDaAPI() {
  try {
    const res = await fetch("/api/tecnicos/ativos", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    if (!res.ok) throw new Error("Erro ao carregar técnicos ativos.");
    tecnicos = await res.json();
  } catch (err) {
    console.error(err);
    alert("Erro ao sincronizar lista de técnicos com o servidor.");
  }
}

function popularSelectTecnicos() {
  const select = document.getElementById("filtroTecnico");
  if (!select) return;
  
  select.innerHTML = '<option value="TODOS">Todos os Técnicos</option>';
  tecnicos.forEach(t => {
    select.innerHTML += `<option value="${t.nome}">${t.nome}</option>`;
  });
}

function configurarDropdownAno() {
  const selectAno = document.getElementById("filtroAno");
  if (!selectAno) return;
  const anoAtual = new Date().getFullYear();
  selectAno.innerHTML = "";
  for (let i = anoAtual - 2; i <= anoAtual + 2; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.innerText = i;
    selectAno.appendChild(opt);
  }
}

function aplicarRestricoesDeNivel() {
  const tipo = localStorage.getItem("usuarioTipo");
  
  if (tipo === "master" || tipo === "admin") {
    const btnDados = document.getElementById("btnIrParaDados");
    const btnEstoque = document.getElementById("btnIrParaEstoque");
    const btnCad = document.getElementById("btnMenuCadastro");
    
    if (btnDados) btnDados.style.display = "inline-block";
    if (btnEstoque) btnEstoque.style.display = "inline-block";
    if (btnCad) btnCad.style.display = "inline-block";
  } else if (tipo === "estoque") {
    const btnEstoque = document.getElementById("btnIrParaEstoque");
    if (btnEstoque) btnEstoque.style.display = "inline-block";
  }
}

// =================================================================
// REQUISIÇÃO E PROCESSAMENTO DOS VALORES DO DASHBOARD
// =================================================================
async function buscarDadosDaAPI() {
  try {
    const res = await fetch("/api/registros", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        efetuarAutoLogout();
        return;
      }
      throw new Error("Erro ao ler registros");
    }

    dadosGlobal = await res.json();
    atualizarDashboard();

  } catch (err) {
    console.error(err);
    alert("Erro ao conectar com o servidor para atualizar o Dashboard.");
  }
}

function atualizarDashboard() {
  const mes = document.getElementById("filtroMes").value;
  const ano = document.getElementById("filtroAno").value;
  tecnicoAtual = document.getElementById("filtroTecnico").value;

  const chaveMesFiltro = `${ano}-${mes}`;

  // 1. Filtragem inteligente para o mês/ano selecionado (suporta ISO e PT-BR)
  let dadosFiltrados = dadosGlobal.filter(item => {
    if (!item.data) return false;
    
    let dataStr = String(item.data).trim();
    let anoItem = "";
    let mesItem = "";

    if (dataStr.includes("-") && dataStr.indexOf("-") === 4) {
      const partes = dataStr.split("T")[0].split("-");
      anoItem = partes[0];
      mesItem = partes[1];
    } 
    else if (dataStr.includes("/")) {
      const partes = dataStr.split("/");
      if (partes.length === 3) {
        anoItem = partes[2].split(" ")[0]; 
        mesItem = partes[1];
      }
    }

    if (anoItem && mesItem) {
      return anoItem === ano && mesItem === mes;
    }
    return dataStr.split("T")[0].startsWith(chaveMesFiltro);
  });

  // 2. Filtro por Técnico individual (se selecionado)
  if (tecnicoAtual !== "TODOS") {
    dadosFiltrados = dadosFiltrados.filter(item => item.tecnico === tecnicoAtual);
  }

  // 3. Acumuladores para os cards principais
  let totalLitros = 0;
  let totalValor = 0;
  let totalKm = 0;

  // Dicionários dinâmicos para a distribuição dos gráficos por técnico
  let mapaGastos = {};
  let mapaKm = {};

  tecnicos.forEach(t => {
    mapaGastos[t.nome] = 0;
    mapaKm[t.nome] = 0;
  });

  // 4. Soma dos valores usando os novos campos mapeados da planilha
  dadosFiltrados.forEach(item => {
    const lts = parseFloat(item.litros) || 0;
    const vlr = parseFloat(item.valor_total) || 0; // Novo campo alinhado com dados.html
    const kmR = parseFloat(item.km_rodado) || 0;    // Novo campo alinhado com dados.html

    totalLitros += lts;
    totalValor += vlr;
    totalKm += kmR;

    if (mapaGastos[item.tecnico] !== undefined) {
      mapaGastos[item.tecnico] += vlr;
      mapaKm[item.tecnico] += kmR;
    }
  });

  // 5. Atualização dos elementos de texto da interface (Cards superiores)
  const elemGasto = document.getElementById("gastoTotalVal");
  const elemKm = document.getElementById("kmTotalVal");
  const elemLitros = document.getElementById("litrosTotalVal");
  const elemMedia = document.getElementById("mediaGeralVal");

  if (elemGasto) elemGasto.innerText = `R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elemKm) elemKm.innerText = `${totalKm.toLocaleString("pt-BR")} KM`;
  if (elemLitros) elemLitros.innerText = `${totalLitros.toFixed(2)} L`;
  
  if (elemMedia) {
    const mediaGeral = totalLitros > 0 ? totalKm / totalLitros : 0;
    elemMedia.innerText = mediaGeral > 0 ? `${mediaGeral.toFixed(2)} km/l` : "-";
  }

  // 6. Atualização dinâmica das estruturas de gráficos
  renderizarGraficos(mapaGastos, mapaKm);
}

// =================================================================
// RENDERIZAÇÃO DOS GRÁFICOS (CHART.JS)
// =================================================================
function renderizarGraficos(mapaGastos, mapaKm) {
  let labels = [];
  let dadosGastos = [];
  let dadosKm = [];

  if (tecnicoAtual === "TODOS") {
    labels = tecnicos.map(t => t.nome);
    dadosGastos = labels.map(nome => mapaGastos[nome] || 0);
    dadosKm = labels.map(nome => mapaKm[nome] || 0);
  } else {
    labels = [tecnicoAtual];
    dadosGastos = [mapaGastos[tecnicoAtual] || 0];
    dadosKm = [mapaKm[tecnicoAtual] || 0];
  }

  // Configurações visuais padrão da paleta corporativa escura
  const opcoesPadrao = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end',
        align: 'top',
        color: '#94A3B8',
        font: { weight: 'bold', size: 11 },
        formatter: (value, ctx) => {
          if (value === 0) return "";
          if (ctx.chart.id === 0) {
            return "R$ " + value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
          }
          return value.toLocaleString("pt-BR") + " KM";
        }
      }
    },
    scales: {
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#94A3B8" }
      },
      x: {
        grid: { display: false },
        ticks: { color: "#94A3B8" }
      }
    }
  };

  // Destrói instâncias anteriores para evitar sobreposição visual do canvas
  if (grafico1) grafico1.destroy();
  if (grafico2) grafico2.destroy();

  const ctx1 = document.getElementById("graficoGastos")?.getContext("2d");
  if (ctx1) {
    grafico1 = new Chart(ctx1, {
      type: "bar",
      plugins: [ChartDataLabels],
      data: {
        labels: labels,
        datasets: [{
          data: dadosGastos,
          backgroundColor: "#EF4444",
          borderRadius: 6
        }]
      },
      options: opcoesPadrao
    });
  }

  const ctx2 = document.getElementById("graficoKm")?.getContext("2d");
  if (ctx2) {
    grafico2 = new Chart(ctx2, {
      type: "bar",
      plugins: [ChartDataLabels],
      data: {
        labels: labels,
        datasets: [{
          data: dadosKm,
          backgroundColor: "#3B82F6",
          borderRadius: 6
        }]
      },
      options: opcoesPadrao
    });
  }
}

// =================================================================
// EMISSÃO DE RELATÓRIO PDF CORPORATIVO (JSPDF)
// =================================================================
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const mes = document.getElementById("filtroMes").value;
  const ano = document.getElementById("filtroAno").value;
  const tecnicoFiltro = document.getElementById("filtroTecnico").value;

  const mesesNomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const nomeMesExtenso = mesesNomes[parseInt(mes) - 1];

  // Filtra dados do período para compor as linhas do relatório estático
  let dadosRelatorio = dadosGlobal.filter(item => {
    if (!item.data) return false;
    let dataStr = String(item.data).trim();
    if (dataStr.includes("-")) {
      return dataStr.split("T")[0].startsWith(`${ano}-${mes}`);
    } else if (dataStr.includes("/")) {
      const partes = dataStr.split("/");
      return partes.length === 3 && partes[2].startsWith(ano) && partes[1] === mes;
    }
    return false;
  });

  if (tecnicoFiltro !== "TODOS") {
    dadosRelatorio = dadosRelatorio.filter(item => item.tecnico === tecnicoFiltro);
  }

  // Ordenação sequencial por dia
  dadosRelatorio.sort((a, b) => String(a.data).localeCompare(String(b.data)));

  let y = 15;

  function verificarPagina() {
    if (y > 275) {
      doc.addPage();
      y = 15;
    }
  }

  // Cabeçalho institucional do PDF
  doc.setFillColor(15, 23, 42);
  doc.rect(10, y, 190, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("NERI - RELATÓRIO DE FECHAMENTO MENSAL", 15, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`PERÍODO: ${nomeMesExtenso} DE ${ano}   |   TÉCNICO: ${tecnicoFiltro}`, 15, y + 16);

  y += 30;

  // Cabeçalho da Tabela
  doc.setFillColor(30, 41, 59);
  doc.rect(10, y, 190, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("DATA", 12, y + 5);
  doc.text("TÉCNICO", 32, y + 5);
  doc.text("KM INICIAL", 68, y + 5);
  doc.text("KM FINAL", 88, y + 5);
  doc.text("KM RODADO", 108, y + 5);
  doc.text("LITROS", 132, y + 5);
  doc.text("VALOR TOTAL", 152, y + 5);
  doc.text("MÉDIA", 178, y + 5);

  y += 8;

  let totalKm = 0;
  let totalLitros = 0;
  let totalValor = 0;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);

  dadosRelatorio.forEach(item => {
    const km = parseFloat(item.km_rodado) || 0;
    const litros = parseFloat(item.litros) || 0;
    const valor = parseFloat(item.valor_total) || 0;

    totalKm += km;
    totalLitros += litros;
    totalValor += valor;

    let dataFormatada = item.data;
    if (String(item.data).includes("-")) {
      const parts = String(item.data).split("T")[0].split("-");
      if (parts.length === 3) dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    doc.text(String(dataFormatada), 12, y);
    doc.text(String(item.tecnico).substring(0, 18), 32, y);
    doc.text(item.km_inicial !== undefined ? String(item.km_inicial) : "-", 68, y);
    doc.text(item.km_final !== undefined ? String(item.km_final) : "-", 88, y);
    doc.text(km > 0 ? `${km} KM` : "-", 108, y);
    doc.text(litros > 0 ? `${litros.toFixed(2)} L` : "-", 132, y);
    doc.text(valor > 0 ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-", 152, y);
    
    const media = litros > 0 ? km / litros : 0;
    doc.text(media > 0 ? `${media.toFixed(2)} km/l` : "-", 178, y);

    y += 8;
    verificarPagina();
  });

  if (y > 240) { 
    y += 5;
    verificarPagina();
  } else {
    y += 5;
  }

  // Caixa de Resumo Acumulado do Período
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
  doc.text(`TOTAL DE COMBUSTÍVEL: ${totalLitros.toFixed(2)} LITROS`, 15, y + 25);
  
  doc.text(`VALOR TOTAL INVESTIDO: ${totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 110, y + 17);
  const mediaFinal = totalLitros > 0 ? totalKm / totalLitros : 0;
  doc.text(`MÉDIA GERAL DA FROTA: ${mediaFinal > 0 ? mediaFinal.toFixed(2) + " km/l" : "-"}`, 110, y + 25);

  doc.save(`Fechamento_Neri_${nomeMesExtenso}_${ano}.pdf`);
}

// Vincula a inicialização do script ao ciclo global de carregamento do Dashboard
window.addEventListener("DOMContentLoaded", iniciarDashboard);