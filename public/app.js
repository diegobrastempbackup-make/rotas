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

function sair() {
  localStorage.clear(); 
  window.location.replace("/login.html");
}

function acessarDados() {
  if (!tokenDashboard) {
    alert("Token ausente. Efetue login novamente.");
    return;
  }
  window.location.href = `/dados.html?token=${tokenDashboard}`;
}

function acessarEstoque() {
  if (!tokenDashboard) {
    alert("Token ausente. Efetue login novamente.");
    return;
  }
  window.location.href = `/estoque.html?token=${tokenDashboard}`;
}

// =================================================================
// INICIALIZAÇÃO DO CONTROLE DE INTERFACE POR PERFIL
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
  const tipoDashboard = localStorage.getItem("usuarioTipo");

  const btnDados = document.getElementById("btnIrParaDados");
  const btnEstoque = document.getElementById("btnIrParaEstoque");
  const btnCadastrar = document.getElementById("btnMenuCadastro");

  // EXCLUSIVIDADE DE GERENCIAMENTO DE USUÁRIOS PARA MASTER
  if (tipoDashboard === "master") {
    if (btnDados) btnDados.style.display = "block";
    if (btnEstoque) btnEstoque.style.display = "block";
    if (btnCadastrar) btnCadastrar.style.display = "block"; 
  } else if (tipoDashboard === "admin") {
    if (btnDados) btnDados.style.display = "block";
    if (btnEstoque) btnEstoque.style.display = "block";
    if (btnCadastrar) btnCadastrar.style.display = "none";  // Admin não gerencia usuários
  } else if (tipoDashboard === "simples") {
    if (btnDados) btnDados.style.display = "none";
    if (btnEstoque) btnEstoque.style.display = "none";
    if (btnCadastrar) btnCadastrar.style.display = "none";
  }

  carregarDados();
});

// =================================================================
// COLETAR E ENVIAR OS NOVOS DADOS DA TABELA (SALVAMENTO SEM DUPLICADOS)
// =================================================================
async function salvarDados() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Sessão inválida ou expirada. Faça login novamente.");
    return;
  }

  const listaParaEnviar = [];

  // Captura os dados preenchidos dinamicamente na interface por técnico
  tecnicos.forEach((nome) => {
    const prefixo = nome.replace(/\s+/g, "");
    
    const kmInput = document.getElementById(`km${prefixo}`);
    const litrosInput = document.getElementById(`litros${prefixo}`);
    const valorInput = document.getElementById(`valor${prefixo}`);
    const dataInput = document.getElementById(`data${prefixo}`);

    // Se pelo menos um campo de KM ou Consumo foi inserido, envia para a lista
    if (kmInput && (kmInput.value.trim() !== "" || (litrosInput && litrosInput.value.trim() !== ""))) {
      const dataFormatada = dataInput && dataInput.value ? dataInput.value : new Date().toISOString().split("T")[0];
      
      listaParaEnviar.push({
        tecnico: nome,
        data: dataFormatada,
        km: Number(kmInput.value) || 0,
        litros: litrosInput ? (Number(litrosInput.value) || 0) : 0,
        valor: valorInput ? (Number(valorInput.value) || 0) : 0
      });
    }
  });

  if (listaParaEnviar.length === 0) {
    alert("Por favor, preencha as informações de ao menos um técnico para salvar.");
    return;
  }

  try {
    const resposta = await fetch("/api/salvar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(listaParaEnviar)
    });

    const resultado = await resposta.json();

    if (resposta.ok) {
      alert("Dados gravados com sucesso! Registros duplicados foram evitados.");
      
      // Limpa os campos após salvar com sucesso
      tecnicos.forEach((nome) => {
        const prefixo = nome.replace(/\s+/g, "");
        const km = document.getElementById(`km${prefixo}`);
        const litros = document.getElementById(`litros${prefixo}`);
        const valor = document.getElementById(`valor${prefixo}`);
        if (km) km.value = "";
        if (litros) litros.value = "";
        if (valor) valor.value = "";
      });

      // Atualiza o Dashboard imediatamente
      if (typeof carregarDados === "function") {
        carregarDados();
      }
    } else {
      alert(`Erro ao salvar dados: ${resultado.erro || "Verifique o servidor."}`);
    }
  } catch (erro) {
    console.error("Erro na requisição para salvar dados:", erro);
    alert("Não foi possível conectar ao servidor.");
  }
}

// =================================================================
// REQUISITAR DADOS DO BACKEND E ALIMENTAR O DASHBOARD
// =================================================================
async function carregarDados() {
  try {
    if (!tokenDashboard) return;

    const res = await fetch("/api/registros", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        efetuarAutoLogout();
      }
      return;
    }

    dadosGlobal = await res.json();
    filtrarPorTecnico(tecnicoAtual);
  } catch (err) {
    console.error("Erro ao puxar dados para os gráficos:", err);
  }
}

function filtrarPorTecnico(nome) {
  tecnicoAtual = nome;
  
  // Atualiza estilização visual dos botões de filtro
  document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
  const btnAtivo = document.getElementById(nome === "TODOS" ? "btnTodos" : `btn-${nome.replace(/\s+/g, "")}`);
  if (btnAtivo) btnAtivo.classList.add("active");

  let filtrados = [];
  if (nome === "TODOS") {
    filtrados = [...dadosGlobal];
  } else {
    filtrados = dadosGlobal.filter(d => d.tecnico === nome);
  }

  // Ordena cronologicamente por data
  filtrados.sort((a, b) => new Date(a.data) - new Date(b.data));

  // Soma de acumulados
  let totalKm = 0, totalLitros = 0, totalValor = 0;
  filtrados.forEach(d => {
    totalKm += (Number(d.km) || 0);
    totalLitros += (Number(d.litros) || 0);
    totalValor += (Number(d.valor) || 0);
  });

  const mediaGeral = totalLitros > 0 ? (totalKm / totalLitros) : 0;

  // Atualização dos painéis numéricos do HTML
  document.getElementById("cardKm").innerText = totalKm.toLocaleString("pt-BR") + " KM";
  document.getElementById("cardLitros").innerText = totalLitros.toLocaleString("pt-BR") + " L";
  document.getElementById("cardValor").innerText = totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("cardMedia").innerText = mediaGeral.toFixed(2) + " KM/L";

  // Renderizar gráficos se a função existir
  processarGraficos(filtrados);
}

// =================================================================
// PROCESSAMENTO DOS GRÁFICOS (CHART.JS)
// =================================================================
function processarGraficos(lista) {
  // Tratamento de dados para o Gráfico 1 (Evolução do Técnico ou Média Geral)
  const ultimosRegistros = lista.slice(-15);
  const labels1 = ultimosRegistros.map(d => {
    if (!d.data) return "-";
    const partes = d.data.split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}` : d.data;
  });

  const valoresG1 = ultimosRegistros.map(d => {
    const km = Number(d.km) || 0;
    const l = Number(d.litros) || 0;
    return l > 0 ? (km / l) : 0;
  });

  if (grafico1) grafico1.destroy();
  const ctx1 = document.getElementById("g1").getContext("2d");
  const grad1 = ctx1.createLinearGradient(0, 0, 0, 300);
  grad1.addColorStop(0, "rgba(59, 130, 246, 0.4)");
  grad1.addColorStop(1, "rgba(59, 130, 246, 0.0)");

  grafico1 = new Chart(ctx1, {
    type: "line",
    data: {
      labels: labels1,
      datasets: [{
        label: "KM/L",
        data: valoresG1,
        borderColor: "#3B82F6",
        backgroundColor: grad1,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#60A5FA",
        pointRadius: 4
      }]
    },
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "MÉDIA DE CONSUMO RECENTE (KM/L)", color: "#FFF" },
        datalabels: {
          align: "top",
          color: "#60A5FA",
          font: { weight: "bold" },
          formatter: (val) => val > 0 ? val.toFixed(1) : ""
        }
      },
      scales: {
        x: { ticks: { color: "#94A3B8" }, grid: { display: false } },
        y: { grace: "10%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } }
      }
    }
  });

  // Tratamento de dados para o Gráfico 2 (KM Mensal total acumulado por veículo)
  const mesCorrente = new Date().toISOString().substring(0, 7);
  const kms = tecnicos.map(nome => {
    return dadosGlobal
      .filter(d => d.tecnico === nome && d.data && d.data.startsWith(mesCorrente))
      .reduce((soma, d) => soma + (Number(d.km) || 0), 0);
  });

  if (grafico2) grafico2.destroy();
  const ctx2 = document.getElementById("g2").getContext("2d");
  const grad2 = ctx2.createLinearGradient(0, 0, 0, 400);
  grad2.addColorStop(0, "#10B981");
  grad2.addColorStop(1, "#047857");

  grafico2 = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: tecnicos,
      datasets: [{ label: "KM", data: kms, backgroundColor: grad2, borderRadius: 10, borderSkipped: false }]
    },
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "KM MENSAL ACUMULADA POR VEÍCULO", color: "#FFF" },
        datalabels: {
          align: "top",
          anchor: "end",
          color: "#10B981",
          font: { weight: "bold" },
          formatter: (val) => val > 0 ? val.toFixed(0) : ""
        }
      },
      scales: {
        x: { ticks: { color: "#94A3B8" }, grid: { display: false } },
        y: { grace: "15%", ticks: { color: "#64748B" }, grid: { color: "rgba(255,255,255,0.04)" } }
      }
    }
  });
}

function exportarPDF() {
  if (!dadosGlobal || dadosGlobal.length === 0) {
    alert("Não há dados carregados para gerar o relatório.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Filtra os dados com base no técnico atual (Se for TODOS, pega a lista inteira)
  let dadosFiltrados = [...dadosGlobal];
  if (tecnicoAtual !== "TODOS") {
    dadosFiltrados = dadosGlobal.filter(d => String(d.tecnico).toLowerCase() === tecnicoAtual.toLowerCase());
  }

  if (dadosFiltrados.length === 0) {
    alert(`Nenhum registro encontrado para ${tecnicoAtual}.`);
    return;
  }

  // Ordena os registros por data (mais antigo para o mais recente)
  dadosFiltrados.sort((a, b) => new Date(a.data) - new Date(b.data));

  // --- CONFIGURAÇÃO DE DESIGN (PADRÃO NERI) ---
  const corPrimaria = [15, 23, 42]; // #0F172A
  let paginaAtual = 1;

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
        console.log("Aviso: logo.png não pôde ser renderizada no PDF (verifique se está no mesmo domínio).");
      }
    }

    // Títulos do Relatório
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NERI - GESTÃO DE FROTAS", 48, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184); // Cinza claro

    const textoFiltro = tecnicoAtual === "TODOS" ? "RELATÓRIO GERAL (TODOS OS VEÍCULOS)" : `RELATÓRIO INDIVIDUAL: ${tecnicoAtual.toUpperCase()}`;
    doc.text(textoFiltro, 48, 25);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 48, 31);

    // Cabeçalho da Tabela
    let yTabela = 50;
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.rect(10, yTabela - 5, 190, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    
    // Colunas dinâmicas ajustadas se for Geral ou Individual
    doc.text("DATA", 13, yTabela);
    if (tecnicoAtual === "TODOS") {
      doc.text("VEÍCULO/TÉC.", 40, yTabela);
      doc.text("KM REGISTRADO", 85, yTabela);
    } else {
      doc.text("KM REGISTRADO", 55, yTabela);
    }
    doc.text("LITROS", 120, yTabela);
    doc.text("VALOR (R$)", 150, yTabela);
    doc.text("MÉDIA (KM/L)", 175, yTabela);
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

    // Linhas zebradas para facilitar a leitura
    doc.setFillColor(indice % 2 === 0 ? 255 : 245, indice % 2 === 0 ? 255 : 245, indice % 2 === 0 ? 255 : 245);
    doc.rect(10, y - 5, 190, 8, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y - 5, 190, 8, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    // Formata a data de AAAA-MM-DD para DD/MM/AAAA se necessário
    let dataFormatada = String(d.data).split("T")[0];
    if (dataFormatada.includes("-")) {
      const partes = dataFormatada.split("-");
      dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    doc.text(dataFormatada, 13, y);

    if (tecnicoAtual === "TODOS") {
      // Se for relatório Geral, mostra quem é o técnico na linha
      doc.text(String(d.tecnico || "-"), 40, y);
      doc.text(km.toLocaleString("pt-BR"), 85, y);
    } else {
      doc.text(km.toLocaleString("pt-BR"), 55, y);
    }

    doc.text(litros.toFixed(2), 120, y);
    doc.text(valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), 150, y);
    
    const media = litros > 0 ? km / litros : 0;
    doc.text(media > 0 ? `${media.toFixed(2)} km/l` : "-", 175, y);

    y += 8;
    verificarPagina();
  });

  // --- QUADRO DE TOTAIS CONSOLIDADO ---
  if (y > 240) { 
    // Garante que o quadro de totais não seja cortado na borda inferior
    y += 5;
    verificarPagina();
  } else {
    y += 5;
  }

  doc.setFillColor(230, 236, 245);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(10, y, 190, 32, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("RESUMO ACUMULADO DO PERÍODO", 15, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`DISTÂNCIA TOTAL PERCORRIDA: ${totalKm.toLocaleString("pt-BR")} KM`, 15, y + 17);
  doc.text(`TOTAL DE COMBUSTÍVEL CONSUMIDO: ${totalLitros.toFixed(2)} LITROS`, 15, y + 24);

  doc.text(`VALOR TOTAL INVESTIDO: ${totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 110, y + 17);
  const mediaGeral = totalLitros > 0 ? totalKm / totalLitros : 0;
  doc.text(`MÉDIA GERAL DO PERÍODO: ${mediaGeral > 0 ? `${mediaGeral.toFixed(2)} KM/L` : "-"}`, 110, y + 24);

  // Rodapé da última página
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Página ${paginaAtual}`, 190, 287);

  // Nome do arquivo dinâmico
  const nomeArquivo = tecnicoAtual === "TODOS" ? "Relatorio_Geral_Frota.pdf" : `Relatorio_Frota_${tecnicoAtual}.pdf`;
  doc.save(nomeArquivo);
}

// =================================================================
// METODOLOGIAS DE CRIAÇÃO E CONTROLE DE MODAL DE USUÁRIOS
// =================================================================
function abrirModalCadastro() {
  document.getElementById("modalCadastro").style.display = "flex";
  listarUsuarios();
}

function fecharModalCadastro() {
  document.getElementById("modalCadastro").style.display = "none";
  limparFormularioUsuario();
}

function mostrarFormularioCadastro() {
  document.getElementById("secaoListaUsuarios").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
  document.getElementById("formTitulo").innerText = "Novo Usuário";
  document.getElementById("lblSenha").innerText = "Senha:";
  document.getElementById("editId").value = "";
}

function ocultarFormularioCadastro() {
  document.getElementById("secaoListaUsuarios").style.display = "block";
  document.getElementById("formUsuario").style.display = "none";
  document.getElementById("btnSalvarUsuario").style.display = "none";
  limparFormularioUsuario();
}

function limparFormularioUsuario() {
  document.getElementById("cadNome").value = "";
  document.getElementById("cadUsuario").value = "";
  document.getElementById("cadSenha").value = "";
  document.getElementById("cadTipo").value = "simples";
  document.getElementById("editId").value = "";
}

// BUSCAR USUÁRIOS COMPLETO
async function listarUsuarios() {
  try {
    const res = await fetch("/api/usuarios", {
      headers: { "Authorization": `Bearer ${tokenDashboard}` }
    });
    const usuarios = await res.json();
    const container = document.getElementById("listaUsuariosContainer");
    container.innerHTML = "";

    usuarios.forEach(u => {
      container.innerHTML += `
        <div class="usuario-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <strong>${u.nome}</strong> <span style="font-size:11px; color:#64748B;">(${u.tipo})</span>
          </div>
          <button onclick="prepararEdicaoUsuario('${u._id}', '${u.nome}', '${u.usuario}', '${u.tipo}')" style="background:#3B82F6; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">Editar</button>
        </div>
      `;
    });
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
  }
}

function prepararEdicaoUsuario(id, nome, usuario, tipo) {
  document.getElementById("secaoListaUsuarios").style.display = "none";
  document.getElementById("formUsuario").style.display = "block";
  document.getElementById("btnSalvarUsuario").style.display = "block";
  
  document.getElementById("formTitulo").innerText = "Editar Usuário";
  document.getElementById("lblSenha").innerText = "Nova Senha (deixe em branco se não quiser alterar):";
  
  document.getElementById("editId").value = id;
  document.getElementById("cadNome").value = nome;
  document.getElementById("cadUsuario").value = usuario;
  document.getElementById("cadSenha").value = "";
  document.getElementById("cadTipo").value = tipo;
}

// GUARDAR DADOS DE USUÁRIO (NOVO OU EDIÇÃO)
async function guardarUsuario() {
  const id = document.getElementById("editId").value;
  const nome = document.getElementById("cadNome").value.trim();
  const usuario = document.getElementById("cadUsuario").value.trim();
  const senha = document.getElementById("cadSenha").value;
  const tipo = document.getElementById("cadTipo").value;

  if (!nome || !usuario) {
    alert("Nome e Usuário são obrigatórios.");
    return;
  }

  const url = id ? `/api/usuarios/${id}` : "/api/usuarios";
  const metodo = id ? "PUT" : "POST";
  
  const corpo = { nome, usuario, tipo };
  if (id) {
    corpo.novaSenha = senha;
  } else {
    if (!senha) { alert("Senha é obrigatória para novos usuários."); return; }
    corpo.senha = senha;
  }

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenDashboard}`
      },
      body: JSON.stringify(corpo)
    });

    const dados = await res.json();
    if (res.ok) {
      alert(dados.message || "Operação realizada com sucesso!");
      ocultarFormularioCadastro();
      listarUsuarios();
    } else {
      alert(dados.erro || "Erro na operação.");
    }
  } catch (err) {
    console.error(err);
  }
}