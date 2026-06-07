// ⏱️ SISTEMA DE CONTROLE DE INATIVIDADE (5 MINUTOS)
let temporizadorInatividade;

function resetarTemporizador() {
  clearTimeout(temporizadorInatividade);
  temporizadorInatividade = setTimeout(efetuarAutoLogout, 5 * 60 * 1000); // 5 Minutos
}

function efetuarAutoLogout() {
  alert("Sessão expirada por inatividade. Por favor, faça login novamente.");
  localStorage.removeItem("token");
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("usuarioTipo");
  window.location.replace("/login.html");
}

// Configura os gatilhos globais de monitoramento de inatividade
window.onload = resetarTemporizador;
window.onmousemove = resetarTemporizador;
window.onmousedown = resetarTemporizador;
window.ontouchstart = resetarTemporizador;
window.onclick = resetarTemporizador;     
window.onkeydown = resetarTemporizador;

// Definições Globais do Dashboard
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

// FUNÇÃO DE LOGOUT
function sair() {
  localStorage.clear(); 
  window.location.replace("/login.html");
}

// 🔥 ACESSAR DIRETO SEM PEDIR SENHA PARA ADMIN
function acessar() {
  const tokenLogin = localStorage.getItem("token");
  if (tokenLogin) {
    window.location.href = `/dados.html?token=${tokenLogin}`;
  } else {
    window.location.replace("/login.html");
  }
}

// ========================================================
// 👤 SISTEMA INTEGRADO DE GERENCIAMENTO DE USUÁRIOS
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
      
      const badge = u.tipo === "admin" ? "<span style='color:#60A5FA; font-size:11px;'>[Admin]</span>" : "<span style='color:#94A3B8; font-size:11px;'>[Comum]</span>";
      
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

      if (!resposta.ok) return alert(dados.erro || "Erro ao cadastrar");

      alert("Novo usuário cadastrado!");
      abrirModalGerenciamento(); 
    } catch (err) {
      alert("Erro de comunicação com o servidor.");
    }
  }
}

// ========================================================
// PROCESSING E FILTRAGEM DE REGISTROS DE KMs / GASTOS
// ========================================================

function obterMesAtual(){
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2,"0");
  return `${ano}-${mes}`;
}

function dadosPorMes(mes){
  return dadosGlobal.filter(d=>{
    if(!d.data) return false;
    return d.data.startsWith(mes);
  });
}

async function carregarDados(){
  const res = await fetch("/registros");
  dadosGlobal = await res.json();
  dadosGlobal.sort((a,b)=>{
    return new Date(a.data) - new Date(b.data);
  });

  const mesAtual = obterMesAtual();
  document.getElementById("mesFiltro").value = mesAtual;
  const filtrado = dadosPorMes(mesAtual);
  processar(filtrado, tecnicoAtual);
}

function filtrar(nome){
  tecnicoAtual = nome;
  const mes = document.getElementById("mesFiltro").value;
  const filtrado = dadosPorMes(mes);
  processar(filtrado, tecnicoAtual);
}

function filtrarMes(){
  const mes = document.getElementById("mesFiltro").value;
  const filtrado = dadosPorMes(mes);
  processar(filtrado, tecnicoAtual);
}

function limparFiltro(){
  const mesAtual = obterMesAtual();
  document.getElementById("mesFiltro").value = mesAtual;
  const filtrado = dadosPorMes(mesAtual);
  processar(filtrado, tecnicoAtual);
}

function processar(dados, tecnico){
  let valores = Array(tecnicos.length).fill(0);
  let kms = Array(tecnicos.length).fill(0);

  dados.forEach(d=>{
    if(tecnico === "TODOS" || d.tecnico === tecnico){
      const i = tecnicos.indexOf(d.tecnico);
      if(i >= 0){
        kms[i] += Number(d.km) || 0;
        valores[i] += Number(d.valor) || 0;
      }
    }
  });
  atualizarDashboard(valores, kms, tecnico);
}

function atualizarDashboard(valores, kms, tecnico){
  const totalValor = valores.reduce((a,b)=>a+b,0);
  const totalKm = kms.reduce((a,b)=>a+b,0);

  document.getElementById("gastoTotal").innerText = "R$ " + totalValor.toFixed(2);
  document.getElementById("kmTotal").innerText = totalKm + " KM";

  if(tecnico !== "TODOS"){
    const i = tecnicos.indexOf(tecnico);
    document.getElementById("gastoIndividual").innerText = "R$ " + valores[i].toFixed(2);
    document.getElementById("kmIndividual").innerText = kms[i] + " KM";
  }else{
    document.getElementById("gastoIndividual").innerText = "R$ 0,00";
    document.getElementById("kmIndividual").innerText = "0 KM";
  }

  if(grafico1) grafico1.destroy();
  if(grafico2) grafico2.destroy();

  const ctx1 = document.getElementById("g1").getContext("2d");
  const grad1 = ctx1.createLinearGradient(0,0,0,400);
  grad1.addColorStop(0, "#60A5FA");
  grad1.addColorStop(1, "#2563EB");

  grafico1 = new Chart(ctx1,{
    type:"bar",
    data:{
      labels:tecnicos,
      datasets:[{
        label:"Gastos",
        data:valores,
        backgroundColor:grad1,
        borderRadius:10,
        borderSkipped:false
      }]
    },
    plugins:[ChartDataLabels],
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:"#fff" } },
        title:{
          display:true,
          text: "💰 CONSUMO GERAL",
          color:"#fff",
          font:{ size:20, weight:"bold" }
        },
        datalabels:{
          color:"#fff",
          anchor:"end",
          align:"top",
          formatter:(value)=>{ return "R$ " + value.toFixed(0); }
        }
      },
      scales:{
        x:{ ticks:{ color:"#fff" }, grid:{ display:false } },
        y:{ ticks:{ color:"#CBD5E1" }, grid:{ color: "rgba(255,255,255,0.08)" } }
      }
    }
  });

  const ctx2 = document.getElementById("g2").getContext("2d");
  const grad2 = ctx2.createLinearGradient(0,0,0,400);
  grad2.addColorStop(0, "#34D399");
  grad2.addColorStop(1, "#059669");

  grafico2 = new Chart(ctx2,{
    type:"bar",
    data:{
      labels:tecnicos,
      datasets:[{
        label:"KM",
        data:kms,
        backgroundColor:grad2,
        borderRadius:10,
        borderSkipped:false
      }]
    },
    plugins:[ChartDataLabels],
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:"#fff" } },
        title:{
          display:true,
          text: "🛣 KM GERAL",
          color:"#fff",
          font:{ size:20, weight:"bold" }
        },
        datalabels:{
          color:"#fff",
          anchor:"end",
          align:"top",
          formatter:(value)=>{ return value + " KM"; }
        }
      },
      scales:{
        x:{ ticks:{ color:"#fff" }, grid:{ display:false } },
        y:{ ticks:{ color:"#CBD5E1" }, grid:{ color: "rgba(255,255,255,0.08)" } }
      }
    }
  });
}

function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const logo = document.getElementById("logoNERI");
  let y = 40;
  const mes = document.getElementById("mesFiltro").value;
  const filtrado = dadosPorMes(mes);

  function desenharCabecalho() {
    doc.setFillColor(10, 61, 196);
    doc.rect(0, 0, 210, 30, "F");
    if (logo && logo.complete) {
      doc.addImage(logo, "PNG", 8, 4, 20, 20);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Relatório Mensal", 35, 13);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text("Relatório de Consumo e Quilometragem", 35, 21);
    doc.text(`Mês: ${mes}`, 145, 13);
    doc.text(new Date().toLocaleString("pt-BR"), 120, 21);
    doc.setTextColor(0, 0, 0);
    y = 40;
  }

  function desenharTabela() {
    doc.setFillColor(10, 61, 196);
    doc.rect(10, y, 190, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("DATA", 15, y + 5);
    doc.text("KM", 55, y + 5);
    doc.text("LITROS", 85, y + 5);
    doc.text("VALOR", 120, y + 5);
    doc.text("KM/L", 165, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 12;
  }

  function verificarPagina() {
    if (y > 270) {
      doc.addPage();
      desenharCabecalho();
      desenharTabela();
    }
  }

  desenharCabecalho();

  if (tecnicoAtual === "TODOS") {
    tecnicos.forEach(nome => {
      const dadosTecnico = filtrado.filter(d => d.tecnico === nome);
      if (!dadosTecnico.length) return;
      verificarPagina();
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.text(nome, 10, y);
      y += 8;
      desenharTabela();

      let totalKm = 0;
      let totalLitros = 0;
      let totalValor = 0;

      dadosTecnico.forEach((d, indice) => {
        const km = Number(d.km) || 0;
        const litros = Number(d.litros) || 0;
        const valor = Number(d.valor) || 0;
        const media = litros > 0 ? km / litros : 0;

        totalKm += km;
        totalLitros += litros;
        totalValor += valor;

        const cor = indice % 2 === 0 ? 255 : 245;
        doc.setFillColor(cor, cor, cor);
        doc.rect(10, y - 5, 190, 8, "F");
        doc.rect(10, y - 5, 190, 8);

        doc.text(String(d.data), 15, y);
        doc.text(km.toFixed(0), 55, y);
        doc.text(litros.toFixed(2), 85, y);
        doc.text(valor.toFixed(2), 120, y);
        doc.text(media.toFixed(2), 165, y);
        y += 8;
        verificarPagina();
      });

      const mediaKmL = totalLitros > 0 ? totalKm / totalLitros : 0;
      const valorLitro = totalValor > 0 ? totalValor / totalLitros : 0;

      doc.setFillColor(230, 236, 245);
      doc.roundedRect(10, y, 190, 40, 3, 3, "FD");
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text(`TOTAL KM: ${totalKm.toFixed(0)} KM`, 15, y + 10);
      doc.text(`TOTAL LITROS: ${totalLitros.toFixed(2)} L`, 15, y + 20);
      doc.text(`TOTAL GASTO: R$ ${totalValor.toFixed(2)}`, 15, y + 30);
      doc.text(`MÉDIA KM/L: ${mediaKmL.toFixed(2)}`, 110, y + 10);
      doc.text(`VALOR/LITRO: R$ ${valorLitro.toFixed(2)}`, 110, y + 20);
      y += 50;
    });
  } else {
    const dadosTecnico = filtrado.filter(d => d.tecnico === tecnicoAtual);
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(tecnicoAtual, 10, y);
    y += 8;
    desenharTabela();

    let totalKm = 0;
    let totalLitros = 0;
    let totalValor = 0;

    dadosTecnico.forEach((d, indice) => {
      const km = Number(d.km) || 0;
      const litros = Number(d.litros) || 0;
      const valor = Number(d.valor) || 0;
      const media = litros > 0 ? km / litros : 0;

      totalKm += km;
      totalLitros += litros;
      totalValor += valor;

      const cor = indice % 2 === 0 ? 255 : 245;
      doc.setFillColor(cor, cor, cor);
      doc.rect(10, y - 5, 190, 8, "F");
      doc.rect(10, y - 5, 190, 8);

      doc.text(String(d.data), 15, y);
      doc.text(km.toFixed(0), 55, y);
      doc.text(litros.toFixed(2), 85, y);
      doc.text(valor.toFixed(2), 120, y);
      doc.text(media.toFixed(2), 165, y);
      y += 8;
      verificarPagina();
    });

    const mediaKmL = totalLitros > 0 ? totalKm / totalLitros : 0;
    const valorLitro = totalLitros > 0 ? totalValor / totalLitros : 0;

    doc.setFillColor(230, 236, 245);
    doc.roundedRect(10, y, 190, 40, 3, 3, "FD");
    doc.setFontSize(10);
    doc.text(`TOTAL KM: ${totalKm.toFixed(0)} KM`, 15, y + 10);
    doc.text(`TOTAL LITROS: ${totalLitros.toFixed(2)} L`, 15, y + 20);
    doc.text(`TOTAL GASTO: R$ ${totalValor.toFixed(2)}`, 15, y + 30);
    doc.text(`MÉDIA KM/L: ${mediaKmL.toFixed(2)}`, 110, y + 10);
    doc.text(`VALOR/LITRO: R$ ${valorLitro.toFixed(2)}`, 110, y + 20);
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Sistema NERI © 2026", 10, 290);
    doc.text(`Página ${i} de ${paginas}`, 170, 290);
  }
  doc.save("relatorio.pdf");
}

// Inicializa a aplicação buscando os dados do back-end
carregarDados();