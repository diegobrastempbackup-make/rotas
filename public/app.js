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

  const mesAtual = obtenerMesAtual();
  document.getElementById("mesFiltro").value = mesAtual;
  processar(dadosPorMes(mesAtual), tecnicoAtual);
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
    plugins: [ChartDataLabels],
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
    plugins: [ChartDataLabels],
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
    const resposta = await fetch(`/registro/${id}`, {
      method: "DELETE"
    });

    const resultado = await respuesta.json();

    if (resposta.ok) {
      alert("Registro excluído com sucesso!");
      
      // Remove o item da lista global localmente para atualizar os gráficos sem recarregar tudo
      dadosGlobal = dadosGlobal.filter(d => d._id !== id);
      
      // Atualiza os filtros e a tabela visível na mesma hora
      const mesAtual = document.getElementById("mesFiltro").value;
      processar(dadosPorMes(mesAtual), tecnicoAtual);
      
      // Se você tiver uma função que desenha as linhas da tabela, chame ela aqui para remontar.
      // Exemplo: se sua função de carregar a tabela se chamar renderizarTabela(), coloque ela aqui!
      if (typeof carregarDados === "function") {
        await carregarDados(); // Recarrega os dados limpos do banco para sumir da tabela
      }
    } else {
      alert(resultado.erro || "Erro ao tentar excluir.");
    }
  } catch (err) {
    console.error(err);
    alert("Erro de comunicação com o servidor ao excluir.");
  }
}

function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const logo = document.getElementById("logoNERI");
  let y = 40;
  const mes = document.getElementById("mesFiltro").value;
  const filtrado = dadosPorMes(mes);

  function desenharCabecalho() {
    doc.setFillColor(10, 61, 196); doc.rect(0, 0, 210, 30, "F");
    if (logo && logo.complete) doc.addImage(logo, "PNG", 8, 4, 20, 20);
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont(undefined, "bold"); doc.text("Relatório Mensal", 35, 13);
    doc.setFontSize(10); doc.setFont(undefined, "normal"); doc.text("Relatório de Consumo e Quilometragem", 35, 21);
    doc.text(`Mês: ${mes}`, 145, 13); doc.text(new Date().toLocaleString("pt-BR"), 120, 21);
    doc.setTextColor(0, 0, 0); y = 40;
  }

  function desenharTabela() {
    doc.setFillColor(10, 61, 196); doc.rect(10, y, 190, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9);
    doc.text("DATA", 15, y + 5); doc.text("KM", 55, y + 5); doc.text("LITROS", 85, y + 5); doc.text("VALOR", 120, y + 5); doc.text("KM/L", 165, y + 5);
    doc.setTextColor(0, 0, 0); y += 12;
  }

  function verificarPagina() { if (y > 270) { doc.addPage(); desenharCabecalho(); desenharTabela(); } }

  desenharCabecalho();

  if (tecnicoAtual === "TODOS") {
    tecnicos.forEach(nome => {
      const dadosTecnico = filtrado.filter(d => d.tecnico === nome);
      if (!dadosTecnico.length) return;
      verificarPagina(); doc.setFontSize(13); doc.setFont(undefined, "bold"); doc.text(nome, 10, y); y += 8;
      desenharTabela();

      let totalKm = 0, totalLitros = 0, totalValor = 0;

      dadosTecnico.forEach((d, indice) => {
        const km = Number(d.km) || 0, litros = Number(d.litros) || 0, valor = Number(d.valor) || 0;
        totalKm += km; totalLitros += litros; totalValor += valor;

        doc.setFillColor(indice % 2 === 0 ? 255 : 245, indice % 2 === 0 ? 255 : 245, indice % 2 === 0 ? 255 : 245);
        doc.rect(10, y - 5, 190, 8, "F"); doc.rect(10, y - 5, 190, 8);
        doc.text(String(d.data), 15, y); doc.text(km.toFixed(0), 55, y); doc.text(litros.toFixed(2), 85, y); doc.text(valor.toFixed(2), 120, y); doc.text((litros > 0 ? km / litros : 0).toFixed(2), 165, y);
        y += 8; verificarPagina();
      });

      doc.setFillColor(230, 236, 245); doc.roundedRect(10, y, 190, 40, 3, 3, "FD"); doc.setFontSize(10); doc.setFont(undefined, "bold");
      doc.text(`TOTAL KM: ${totalKm.toFixed(0)} KM`, 15, y + 10); doc.text(`TOTAL LITROS: ${totalLitros.toFixed(2)} L`, 15, y + 20); doc.text(`TOTAL GASTO: R$ ${totalValor.toFixed(2)}`, 15, y + 30);
      doc.text(`MÉDIA KM/L: ${(totalLitros > 0 ? totalKm / totalLitros : 0).toFixed(2)}`, 110, y + 10); doc.text(`VALOR/LITRO: R$ ${(totalValor > 0 ? totalValor / totalLitros : 0).toFixed(2)}`, 110, y + 20);
      y += 50;
    });
  } else {
    const dadosTecnico = filtrado.filter(d => d.tecnico === tecnicoAtual);
    doc.setFontSize(13); doc.setFont(undefined, "bold"); doc.text(tecnicoAtual, 10, y); y += 8;
    desenharTabela();

    let totalKm = 0, totalLitros = 0, totalValor = 0;
    dadosTecnico.forEach((d, indice) => {
      const km = Number(d.km) || 0, litros = Number(d.litros) || 0, valor = Number(d.valor) || 0;
      totalKm += km; totalLitros += litros; totalValor += valor;

      doc.setFillColor(indice % 2 === 0 ? 255 : 245, indice % 2 === 0 ? 255 : 245, indice % 2 === 0 ? 255 : 245);
      doc.rect(10, y - 5, 190, 8, "F"); doc.rect(10, y - 5, 190, 8);
      doc.text(String(d.data), 15, y); doc.text(km.toFixed(0), 55, y); doc.text(litros.toFixed(2), 85, y); doc.text(valor.toFixed(2), 120, y); doc.text((litros > 0 ? km / litros : 0).toFixed(2), 165, y);
      y += 8; verificarPagina();
    });

    doc.setFillColor(230, 236, 245); doc.roundedRect(10, y, 190, 40, 3, 3, "FD"); doc.setFontSize(10);
    doc.text(`TOTAL KM: ${totalKm.toFixed(0)} KM`, 15, y + 10); doc.text(`TOTAL LITROS: ${totalLitros.toFixed(2)} L`, 15, y + 20); doc.text(`TOTAL GASTO: R$ ${totalValor.toFixed(2)}`, 15, y + 30);
    doc.text(`MÉDIA KM/L: ${(totalLitros > 0 ? totalKm / totalLitros : 0).toFixed(2)}`, 110, y + 10); doc.text(`VALOR/LITRO: R$ ${(totalValor > 0 ? totalValor / totalLitros : 0).toFixed(2)}`, 110, y + 20);
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text("Sistema NERI © 2026", 10, 290); doc.text(`Página ${i} de ${paginas}`, 170, 290); }
  doc.save("relatorio.pdf");
}

carregarDados();