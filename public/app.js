let temporizadorInatividade;
function resetarTemporizador() { clearTimeout(temporizadorInatividade); temporizadorInatividade = setTimeout(efetuarAutoLogout, 5 * 60 * 1000); }
function efetuarAutoLogout() { alert("Sessão expirada por inatividade."); localStorage.removeItem("token"); localStorage.removeItem("usuarioLogado"); localStorage.removeItem("usuarioTipo"); window.location.replace("/login.html"); }
window.onload = resetarTemporizador; window.onmousemove = resetarTemporizador; window.onmousedown = resetarTemporizador; window.ontouchstart = resetarTemporizador; window.onclick = resetarTemporizador; window.onkeydown = resetarTemporizador;

let tecnicos = [];
let dadosGlobal = [];
let tecnicoAtual = "TODOS";
let grafico1;
let grafico2;

const tokenDashboard = localStorage.getItem("token");
if (!tokenDashboard) window.location.replace("/login.html");

window.addEventListener("DOMContentLoaded", async () => {
  let tipoDashboard = localStorage.getItem("usuarioTipo");
  
  if (tipoDashboard === "estoque") {
    window.location.replace("/estoque.html");
    return;
  }
  
  await carregarTecnicosFrota();
  carregarDados();
}); 

async function carregarTecnicosFrota() {
  try {
    const res = await fetch("/api/tecnicos-dashboard", { headers: { "Authorization": `Bearer ${tokenDashboard}` } });
    if(res.ok) {
        const listaDB = await res.json();
        tecnicos = listaDB.filter(t => t.status === "Ativo" || !t.status).map(t => t.nome);
        const dropdown = document.getElementById("dropdownLista");
        if(dropdown) {
           dropdown.innerHTML = "";
           tecnicos.forEach(nome => { dropdown.innerHTML += `<p onclick="filtrar('${nome}')">${nome}</p>`; });
        }
    }
  } catch (err) { console.error("Erro:", err); }
}

function irParaEstoque() { const token = localStorage.getItem("token"); window.location.href = `/estoque.html?token=${token}`; }
function irParaTecnicos() { const token = localStorage.getItem("token"); window.location.href = `/tecnicos.html?token=${token}`; }
function acessar() { const tokenLogin = localStorage.getItem("token"); window.location.href = `/dados.html?token=${tokenLogin}`; }
function sair() { localStorage.clear(); window.location.replace("/login.html"); }

// FUNÇÕES DE TEMPO PARA OS INDICADORES DE TENDÊNCIA
function obtenerMesAtual(){ const hoje = new Date(); return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}`; }

function getMesAnterior(mesYYYYMM) {
    if (!mesYYYYMM) return null;
    const [ano, mes] = mesYYYYMM.split("-").map(Number);
    if (mes === 1) return `${ano - 1}-12`;
    return `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

function dadosPorMes(mes){ return dadosGlobal.filter(d => d.data && d.data.startsWith(mes)); }

async function carregarDados(){
  try {
    const res = await fetch("/api/registros", { headers: { "Authorization": `Bearer ${tokenDashboard}` } });
    dadosGlobal = await res.json();
    dadosGlobal.sort((a,b) => new Date(a.data) - new Date(b.data));

    if (document.getElementById("mesFiltro") && document.getElementById("g1")) {
      const mesAtual = obtenerMesAtual();
      document.getElementById("mesFiltro").value = mesAtual;
      processar(mesAtual, tecnicoAtual);
    }
  } catch (err) { console.error("Erro:", err); }
}

function filtrar(nome){ 
  tecnicoAtual = nome; 
  processar(document.getElementById("mesFiltro").value, tecnicoAtual); 
}

function filtrarMes(){ 
  processar(document.getElementById("mesFiltro").value, tecnicoAtual); 
}

function limparFiltro(){ 
  const mesAtual = obtenerMesAtual(); 
  document.getElementById("mesFiltro").value = mesAtual; 
  tecnicoAtual = "TODOS"; 
  processar(mesAtual, tecnicoAtual); 
}

function calcularTrend(atual, anterior, tipo) {
    if (anterior === 0 && atual === 0) return { texto: "Sem histórico anterior", classe: "trend-neutral" };
    if (anterior === 0 && atual > 0) return { texto: "▲ 100% (Novo)", classe: tipo === "gasto" ? "trend-up-bad" : "trend-up-good" };
    if (anterior > 0 && atual === 0) return { texto: "▼ 100% (Zerado)", classe: tipo === "gasto" ? "trend-down-good" : "trend-down-bad" };
    
    const variacao = ((atual - anterior) / anterior) * 100;
    const setinha = variacao > 0 ? "▲" : (variacao < 0 ? "▼" : "⏸");
    const valorAbs = Math.abs(variacao).toFixed(1);
    
    let classe = "trend-neutral";
    if (variacao > 0) {
        classe = tipo === "gasto" ? "trend-up-bad" : "trend-up-good";
    } else if (variacao < 0) {
        classe = tipo === "gasto" ? "trend-down-good" : "trend-down-bad";
    }
    
    return { texto: `${setinha} ${valorAbs}% vs mês ant.`, classe };
}

function processar(mesFiltrado, tecnico){
  const mesAnterior = getMesAnterior(mesFiltrado);
  const dadosAtuais = dadosPorMes(mesFiltrado);
  const dadosAnt = dadosPorMes(mesAnterior);

  let valoresGerais = Array(tecnicos.length).fill(0);
  let kmsGerais = Array(tecnicos.length).fill(0);

  let gastoInd = 0; let kmInd = 0; let litrosInd = 0;
  let gastoAnt = 0; let kmAnt = 0; let litrosAnt = 0;

  // Variável para calcular o Pódio da frota no mês atual
  let statsPodium = tecnicos.map(nome => ({ nome, gasto: 0, km: 0, litros: 0, media: 0 }));

  // Analisa o mês atual
  dadosAtuais.forEach(d => {
    const idx = tecnicos.indexOf(d.tecnico);
    if(idx >= 0){ 
      kmsGerais[idx] += Number(d.km) || 0; 
      valoresGerais[idx] += Number(d.valor) || 0; 
      
      statsPodium[idx].gasto += Number(d.valor) || 0;
      statsPodium[idx].km += Number(d.km) || 0;
      statsPodium[idx].litros += Number(d.litros) || 0;
    }

    if (tecnico === "TODOS" || d.tecnico === tecnico) { 
      gastoInd += Number(d.valor) || 0; 
      kmInd += Number(d.km) || 0; 
      litrosInd += Number(d.litros) || 0; 
    }
  });

  // Calcula a média exata de cada técnico para o pódio
  statsPodium.forEach(st => {
      st.media = st.litros > 0 ? (st.km / st.litros) : 0;
  });

  // Analisa o mês anterior para o cenário selecionado
  dadosAnt.forEach(d => {
    if (tecnico === "TODOS" || d.tecnico === tecnico) {
      gastoAnt += Number(d.valor) || 0; 
      kmAnt += Number(d.km) || 0; 
      litrosAnt += Number(d.litros) || 0; 
    }
  });

  const mediaAtual = litrosInd > 0 ? (kmInd / litrosInd) : 0;
  const mediaAnt = litrosAnt > 0 ? (kmAnt / litrosAnt) : 0;

  // Calculamos a tendência comparando o Atual vs Anterior
  const trendGasto = calcularTrend(gastoInd, gastoAnt, "gasto");
  const trendKm = calcularTrend(kmInd, kmAnt, "km");
  const trendConsumo = calcularTrend(mediaAtual, mediaAnt, "consumo");

  atualizarDashboard(valoresGerais, kmsGerais, tecnico, gastoInd, kmInd, mediaAtual, trendGasto, trendKm, trendConsumo, statsPodium);
}

function aplicarTrendDOM(id, objTrend) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = objTrend.texto;
    el.className = `trend-badge ${objTrend.classe}`;
}

function atualizarDashboard(valores, kms, tecnico, gastoInd, kmInd, mediaAtual, trendGasto, trendKm, trendConsumo, statsPodium){
  if (!document.getElementById("g1")) return;

  const totalValor = valores.reduce((a,b)=>a+b,0);
  const totalKm = kms.reduce((a,b)=>a+b,0);

  document.getElementById("gastoTotal").innerText = totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("kmTotal").innerText = totalKm.toLocaleString("pt-BR") + " KM";

  // Aplica as tags coloridas de MoM (Month over Month)
  aplicarTrendDOM("trendGasto", trendGasto);
  aplicarTrendDOM("trendKm", trendKm);
  aplicarTrendDOM("trendConsumo", trendConsumo);

  if(tecnico !== "TODOS"){
    document.getElementById("nomeTecnicoSelecionado").innerText = tecnico;
    document.getElementById("gastoIndividual").innerText = gastoInd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("kmIndividual").innerText = kmInd.toLocaleString("pt-BR") + " KM";
    document.getElementById("mediaIndividual").innerText = mediaAtual.toFixed(1) + " KM/L";
    
    // Esconde o pódio quando analisamos um técnico individual
    document.getElementById("painelPodium").style.display = "none";
  } else {
    document.getElementById("nomeTecnicoSelecionado").innerText = "TODOS";
    document.getElementById("gastoIndividual").innerText = "R$ 0,00";
    document.getElementById("kmIndividual").innerText = "0 KM";
    document.getElementById("mediaIndividual").innerText = "0.0 KM/L";
    
    // Mostra e calcula o pódio quando estamos na visão geral da Frota
    document.getElementById("painelPodium").style.display = "grid";
    
    if (statsPodium.length > 0) {
        // Vencedor Eficiência
        let validEfi = statsPodium.filter(t => t.litros > 0 && t.km > 0);
        let vEfi = validEfi.length > 0 ? validEfi.reduce((p, c) => (c.media > p.media) ? c : p) : null;
        document.getElementById("podiumEfiNome").innerText = vEfi ? vEfi.nome : "Nenhum";
        document.getElementById("podiumEfiValor").innerText = vEfi ? `${vEfi.media.toFixed(1)} KM/L` : "0.0 KM/L";

        // Vencedor Distância
        let vDist = statsPodium.reduce((p, c) => (c.km > p.km) ? c : p);
        document.getElementById("podiumDistNome").innerText = vDist && vDist.km > 0 ? vDist.nome : "Nenhum";
        document.getElementById("podiumDistValor").innerText = vDist ? `${vDist.km.toLocaleString("pt-BR")} KM` : "0 KM";

        // Alerta Maior Gasto
        let vGasto = statsPodium.reduce((p, c) => (c.gasto > p.gasto) ? c : p);
        document.getElementById("podiumGastoNome").innerText = vGasto && vGasto.gasto > 0 ? vGasto.nome : "Nenhum";
        document.getElementById("podiumGastoValor").innerText = vGasto ? vGasto.gasto.toLocaleString("pt-BR", {style:"currency", currency:"BRL"}) : "R$ 0,00";
    }
  }

  if (grafico1) { grafico1.destroy(); grafico1 = null; }
  if (grafico2) { grafico2.destroy(); grafico2 = null; }

  const ctx1 = document.getElementById("g1").getContext("2d");
  const grad1 = ctx1.createLinearGradient(0,0,0,400);
  grad1.addColorStop(0, "#3B82F6"); grad1.addColorStop(1, "#1D4ED8");
  grafico1 = new Chart(ctx1,{ type: "bar", data: { labels: tecnicos, datasets: [{ label: "Gastos", data: valores, backgroundColor: grad1, borderRadius: 10 }] }, plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [], options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: "GASTO MENSAL POR VEÍCULO", color: "#fff", font: { size: 16, weight: "bold" } }, datalabels: { color: "#fff", anchor: "end", align: "top", offset: 4, font: { weight: "bold" }, formatter: (val) => val > 0 ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "" } }, scales: { x: { ticks: { color: "#94A3B8" }, grid: { display: false } }, y: { grace: "15%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } } } } });

  const ctx2 = document.getElementById("g2").getContext("2d");
  const grad2 = ctx2.createLinearGradient(0,0,0,400);
  grad2.addColorStop(0, "#10B981"); grad2.addColorStop(1, "#047857");
  grafico2 = new Chart(ctx2,{ type: "bar", data: { labels: tecnicos, datasets: [{ label: "KM", data: kms, backgroundColor: grad2, borderRadius: 10 }] }, plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [], options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: "KM MENSAL POR VEÍCULO", color: "#fff", font: { size: 16, weight: "bold" } }, datalabels: { color: "#fff", anchor: "end", align: "top", offset: 4, font: { weight: "bold" }, formatter: (val) => val > 0 ? val.toLocaleString("pt-BR") + " KM" : "" } }, scales: { x: { ticks: { color: "#94A3B8" }, grid: { display: false } }, y: { grace: "15%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } } } } });
}

function exportarPDF() {
  if (!dadosGlobal || dadosGlobal.length === 0) return alert("Não há dados carregados para gerar o relatório.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const mesSelecionado = document.getElementById("mesFiltro") ? document.getElementById("mesFiltro").value : "";
  let dadosFiltrados = [...dadosGlobal];
  if (mesSelecionado) dadosFiltrados = dadosFiltrados.filter(d => d.data && d.data.startsWith(mesSelecionado));
  if (tecnicoAtual !== "TODOS") dadosFiltrados = dadosFiltrados.filter(d => String(d.tecnico).toLowerCase() === tecnicoAtual.toLowerCase());
  if (dadosFiltrados.length === 0) return alert(`Nenhum registro encontrado para ${tecnicoAtual} no período selecionado.`);
  dadosFiltrados.sort((a, b) => new Date(a.data) - new Date(b.data));

  const corPrimaria = [15, 23, 42]; let paginaAtual = 1;
  function verificarMesAnoExtenso(anoMes) { if (!anoMes || !anoMes.includes("-")) return ""; const [ano, mes] = anoMes.split("-"); const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]; return `${meses[parseInt(mes) - 1]} de ${ano}`; }

  function desenharCabecalho() {
    doc.setFillColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]); doc.rect(0, 0, 210, 40, "F");
    const imgLogo = document.getElementById("logoNERI");
    if (imgLogo && imgLogo.src) { try { doc.addImage(imgLogo, "PNG", 12, 5, 30, 30); } catch (e) { console.log("Erro na logo"); } }
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("NERI - GESTÃO DE FROTAS", 48, 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(148, 163, 184); 
    const textoFiltro = tecnicoAtual === "TODOS" ? "RELATÓRIO GERAL DE MOVIMENTAÇÃO" : `RELATÓRIO INDIVIDUAL: ${tecnicoAtual.toUpperCase()}`;
    doc.text(textoFiltro, 48, 23); doc.text(mesSelecionado ? `Competência: ${verificarMesAnoExtenso(mesSelecionado).toUpperCase()}` : "Período: Total Acumulado", 48, 29); doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 48, 35);
    let yTabela = 50; doc.setFillColor(30, 41, 59); doc.rect(10, yTabela - 5, 190, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    
    // NOVOS CABEÇALHOS DO PDF COM OBSERVAÇÃO
    doc.text("DATA", 13, yTabela); 
    if (tecnicoAtual === "TODOS") { 
        doc.text("VEÍCULO/TÉCNICO", 35, yTabela); 
        doc.text("KM", 75, yTabela); 
    } else { 
        doc.text("KM REGISTRADO", 45, yTabela); 
    }
    doc.text("LITROS", 95, yTabela); 
    doc.text("VALOR (R$)", 115, yTabela); 
    doc.text("OBSERVAÇÃO", 140, yTabela); 
    doc.text("MÉDIA (KM/L)", 175, yTabela);
  }
  desenharCabecalho();

  let y = 58; let totalKm = 0; let totalLitros = 0; let totalValor = 0;
  function verificarPagina() { if (y > 270) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(`Página ${paginaAtual}`, 190, 287); doc.addPage(); paginaAtual++; desenharCabecalho(); y = 58; } }

  dadosFiltrados.forEach((d, indice) => {
    const km = Number(d.km) || 0; const litros = Number(d.litros) || 0; const valor = Number(d.valor) || 0;
    totalKm += km; totalLitros += litros; totalValor += valor;
    doc.setFillColor(indice % 2 === 0 ? 255 : 248, indice % 2 === 0 ? 255 : 248, indice % 2 === 0 ? 255 : 248); doc.rect(10, y - 5, 190, 8, "F"); doc.setDrawColor(241, 245, 249); doc.rect(10, y - 5, 190, 8, "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
    let dataFormatada = String(d.data).split("T")[0]; if (dataFormatada.includes("-")) { const partes = dataFormatada.split("-"); dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`; }
    
    // NOVOS VALORES NO PDF
    doc.text(dataFormatada, 13, y); 
    if (tecnicoAtual === "TODOS") { 
        doc.text(String(d.tecnico || "-").substring(0, 15), 35, y); 
        doc.text(km.toLocaleString("pt-BR"), 75, y); 
    } else { 
        doc.text(km.toLocaleString("pt-BR"), 45, y); 
    }
    doc.text(litros.toFixed(2), 95, y); 
    doc.text(valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), 115, y);
    
    const textoObs = String(d.obs || "-").substring(0, 15);
    doc.text(textoObs, 140, y);
    
    const media = litros > 0 ? km / litros : 0; 
    doc.text(media > 0 ? `${media.toFixed(2)} km/l` : "-", 175, y);

    y += 8; verificarPagina();
  });

  if (y > 240) { y += 5; verificarPagina(); } else { y += 5; }
  doc.setFillColor(241, 245, 249); doc.setDrawColor(203, 213, 225); doc.roundedRect(10, y, 190, 32, 2, 2, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.text("RESUMO ACUMULADO DO PERÍODO", 15, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`DISTÂNCIA TOTAL PERCORRIDA: ${totalKm.toLocaleString("pt-BR")} KM`, 15, y + 17); doc.text(`TOTAL DE COMBUSTÍVEL: ${totalLitros.toFixed(2)} LITROS`, 15, y + 24);
  doc.text(`VALOR TOTAL INVESTIDO: ${totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 115, y + 17); const mediaGeral = totalLitros > 0 ? totalKm / totalLitros : 0; doc.text(`MÉDIA GERAL DA FROTA: ${mediaGeral > 0 ? `${mediaGeral.toFixed(2)} KM/L` : "-"}`, 115, y + 24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(`Página ${paginaAtual}`, 190, 287);
  const sulfixoMes = mesSelecionado ? `_${mesSelecionado}` : "";
  doc.save(tecnicoAtual === "TODOS" ? `Relatorio_Geral_Frota${sulfixoMes}.pdf` : `Relatorio_Frota_${tecnicoAtual}${sulfixoMes}.pdf`);
}

function toggleDropdown() { document.getElementById("dropdownLista").classList.toggle("show-dropdown"); }
window.addEventListener("click", function(event) { if (!event.target.matches('.btn-dropdown')) { const dropdowns = document.getElementsByClassName("dropdown-conteudo"); for (let i = 0; i < dropdowns.length; i++) { dropdowns[i].classList.remove('show-dropdown'); } } });