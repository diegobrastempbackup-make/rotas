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

function obtenerMesAtual(){ const hoje = new Date(); return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}`; }
function dadosPorMes(mes){ return dadosGlobal.filter(d => d.data && d.data.startsWith(mes)); }

async function carregarDados(){
  try {
    const res = await fetch("/api/registros", { headers: { "Authorization": `Bearer ${tokenDashboard}` } });
    dadosGlobal = await res.json();
    dadosGlobal.sort((a,b) => new Date(a.data) - new Date(b.data));

    if (document.getElementById("mesFiltro") && document.getElementById("g1")) {
      const mesAtual = obtenerMesAtual();
      document.getElementById("mesFiltro").value = mesAtual;
      processar(dadosPorMes(mesAtual), tecnicoAtual);
    }
  } catch (err) { console.error("Erro:", err); }
}

function filtrar(nome){ tecnicoAtual = nome; processar(dadosPorMes(document.getElementById("mesFiltro").value), tecnicoAtual); }
function filtrarMes(){ processar(dadosPorMes(document.getElementById("mesFiltro").value), tecnicoAtual); }
function limparFiltro(){ const mesAtual = obtenerMesAtual(); document.getElementById("mesFiltro").value = mesAtual; tecnicoAtual = "TODOS"; processar(dadosPorMes(mesAtual), tecnicoAtual); }

function processar(dados, tecnico){
  let valoresGerais = Array(tecnicos.length).fill(0);
  let kmsGerais = Array(tecnicos.length).fill(0);
  let gastoInd = 0; let kmInd = 0; let litrosInd = 0;

  dados.forEach(d => {
    const idx = tecnicos.indexOf(d.tecnico);
    if(idx >= 0){ kmsGerais[idx] += Number(d.km) || 0; valoresGerais[idx] += Number(d.valor) || 0; }
    if (d.tecnico === tecnico) { gastoInd += Number(d.valor) || 0; kmInd += Number(d.km) || 0; litrosInd += Number(d.litros) || 0; }
  });

  atualizarDashboard(valoresGerais, kmsGerais, tecnico, gastoInd, kmInd, litrosInd);
}

function atualizarDashboard(valores, kms, tecnico, gastoInd, kmInd, litrosInd){
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
    doc.text("DATA", 13, yTabela); if (tecnicoAtual === "TODOS") { doc.text("VEÍCULO / TÉCNICO", 40, yTabela); doc.text("KM REGISTRADO", 90, yTabela); } else { doc.text("KM REGISTRADO", 55, yTabela); }
    doc.text("LITROS", 125, yTabela); doc.text("VALOR (R$)", 153, yTabela); doc.text("MÉDIA (KM/L)", 178, yTabela);
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
    doc.text(dataFormatada, 13, y); if (tecnicoAtual === "TODOS") { doc.text(String(d.tecnico || "-"), 40, y); doc.text(km.toLocaleString("pt-BR"), 90, y); } else { doc.text(km.toLocaleString("pt-BR"), 55, y); }
    doc.text(litros.toFixed(2), 125, y); doc.text(valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), 153, y);
    const media = litros > 0 ? km / litros : 0; doc.text(media > 0 ? `${media.toFixed(2)} km/l` : "-", 178, y);
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