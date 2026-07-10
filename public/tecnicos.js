const token = localStorage.getItem("token");
let cacheTecnicos = [];

if (!token) window.location.replace("/login.html");

function obterNivelRealDoToken() {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload).tipo;
    } catch (e) { return null; }
}

document.addEventListener("DOMContentLoaded", async () => {
    const usuarioTipo = localStorage.getItem("usuarioTipo");
    const tipoReal = obterNivelRealDoToken(); 
    
    if (usuarioTipo === "master" || tipoReal === "superadmin") {
        document.getElementById("btnTabUsuarios").style.display = "flex";
    }

    if (tipoReal === "superadmin") {
        document.getElementById("btnTabEmpresas").style.display = "flex";
        await carregarEmpresas();
    }

    await carregarTecnicos();
    await carregarUsuarios();

    document.getElementById("buscaNome").addEventListener("input", filtrarTabela);
    document.getElementById("filtroStatus").addEventListener("change", filtrarTabela);
});

function mudarAba(abaSelecionada) {
    document.getElementById("abaTecnicos").style.display = abaSelecionada === 'tecnicos' ? 'block' : 'none';
    document.getElementById("abaUsuarios").style.display = abaSelecionada === 'usuarios' ? 'block' : 'none';
    document.getElementById("abaEmpresas").style.display = abaSelecionada === 'empresas' ? 'block' : 'none';
    
    document.getElementById("btnTabTecnicos").className = abaSelecionada === 'tecnicos' ? 'tab-btn ativa' : 'tab-btn';
    document.getElementById("btnTabUsuarios").className = abaSelecionada === 'usuarios' ? 'tab-btn ativa' : 'tab-btn';
    document.getElementById("btnTabEmpresas").className = abaSelecionada === 'empresas' ? 'tab-btn ativa' : 'tab-btn';
}

function fecharModal(idModal) { document.getElementById(idModal).classList.remove("ativo"); }

// --- GESTÃO DE CLIENTES (SAAS) ---
async function carregarEmpresas() {
    try {
        const res = await fetch("/api/empresas", { headers: { "Authorization": `Bearer ${token}` } });
        const empresas = await res.json();
        const corpo = document.getElementById("corpoTabelaEmpresas");
        corpo.innerHTML = "";
        
        empresas.forEach(emp => {
            const dataReg = emp.criadoEm ? new Date(emp.criadoEm).toLocaleDateString("pt-BR") : "-";
            const statusText = emp.ativo !== false ? "Ativo" : "Bloqueado";
            const badgeClass = emp.ativo !== false ? "badge-ativo" : "badge-desligado";
            const btnStatusTexto = emp.ativo !== false ? "Bloquear Acesso" : "Desbloquear";
            const novoStatus = emp.ativo !== false ? false : true;

            corpo.innerHTML += `
                <tr>
                    <td><strong>${emp.empresaNome || 'Desconhecida'}</strong></td>
                    <td>${emp.nome}</td>
                    <td><span style="color:#94A3B8;">${emp.usuario}</span></td>
                    <td><span class="badge ${badgeClass}">${statusText}</span></td>
                    <td>${dataReg}</td>
                    <td>
                        <button class="btn-mini" style="background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3);" onclick="alternarStatusEmpresa('${emp._id}', ${novoStatus})">${btnStatusTexto}</button>
                        <button class="btn-mini btn-excluir" onclick="excluirEmpresa('${emp._id}', '${emp.empresaNome}')">Excluir Cliente</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) { console.error("Erro ao carregar empresas"); }
}

async function alternarStatusEmpresa(id, novoStatus) {
    const acao = novoStatus ? "desbloquear" : "suspender";
    if(!confirm(`Deseja realmente ${acao} o acesso desta empresa e de todos os seus funcionários?`)) return;
    try {
        const res = await fetch(`/api/empresas/${id}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ativo: novoStatus })
        });
        if(res.ok) await carregarEmpresas();
    } catch(err) { alert("Erro de conexão."); }
}

async function excluirEmpresa(id, nome) {
    if(!confirm(`⚠️ ATENÇÃO EXTREMA: Deseja EXCLUIR PERMANENTEMENTE a empresa '${nome}'? \nEsta ação não tem retorno!`)) return;
    try {
        const res = await fetch(`/api/empresas/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if(res.ok) await carregarEmpresas();
    } catch(err) { alert("Erro de conexão."); }
}

function abrirModalEmpresa() {
    document.getElementById("regEmpresa").value = "";
    document.getElementById("regNome").value = "";
    document.getElementById("regUsuario").value = "";
    document.getElementById("regSenha").value = "";
    document.getElementById("modalEmpresa").classList.add("ativo");
}

async function salvarNovaEmpresa() {
    const empresa = document.getElementById("regEmpresa").value.trim();
    const nome = document.getElementById("regNome").value.trim();
    const usuario = document.getElementById("regUsuario").value.trim();
    const senha = document.getElementById("regSenha").value;
    if (!empresa || !nome || !usuario || !senha) return alert("Preencha todos os campos.");

    try {
        const res = await fetch("/nova-empresa", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ empresa, nome, usuario, senha })
        });
        const dados = await res.json();
        if (!res.ok) return alert(dados.erro || "Falha no registo.");
        alert(`Cliente ${empresa} criado com sucesso!`);
        fecharModal('modalEmpresa');
        await carregarEmpresas();
    } catch (err) { alert("Erro de conexão."); }
}

// --- TÉCNICOS E USUÁRIOS ---
async function carregarTecnicos() {
    try {
        const res = await fetch("/api/tecnicos-dashboard", { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) return;
        cacheTecnicos = await res.json();
        atualizarCardsIndicadores();
        renderizarTabela(cacheTecnicos);
    } catch (err) { console.error(err); }
}

function atualizarCardsIndicadores() {
    const ativos = cacheTecnicos.filter(t => t.status === "Ativo" || !t.status).length;
    const ferias = cacheTecnicos.filter(t => t.status === "Em Férias").length;
    const afastados = cacheTecnicos.filter(t => t.status === "Afastado").length;
    const desligados = cacheTecnicos.filter(t => t.status === "Desligado").length;
    document.getElementById("cardAtivos").innerText = ativos;
    document.getElementById("cardFerias").innerText = ferias;
    document.getElementById("cardAfastados").innerText = afastados;
    document.getElementById("cardDesligados").innerText = desligados;
}

function renderizarTabela(lista) {
    const corpo = document.getElementById("corpoTabelaTecnicos");
    corpo.innerHTML = "";
    lista.forEach(t => {
        const statusReal = t.status || "Ativo";
        let classeBadge = "badge-ativo";
        if (statusReal === "Em Férias") classeBadge = "badge-ferias";
        if (statusReal === "Afastado") classeBadge = "badge-afastado";
        if (statusReal === "Desligado") classeBadge = "badge-desligado";

        corpo.innerHTML += `
            <tr>
                <td><strong>${t.nome}</strong></td>
                <td><span class="badge ${classeBadge}">${statusReal}</span></td>
                <td>${t.telefone || "-"}</td>
                <td>${t.veiculo || "-"}</td>
                <td>
                    <button class="btn-mini btn-editar" onclick="prepararEdicaoTecnico('${t._id}')">Editar</button>
                    <button class="btn-mini btn-excluir" onclick="deletarTecnico('${t._id}')">Excluir</button>
                    <button class="btn-mini" style="background:#8B5CF6; border:1px solid #7C3AED; color:white; font-size:11px; padding:6px; margin-top:5px; width:100%; display:block;" onclick="imprimirCracha('${t.nome}')">🖨️ Crachá</button>
                </td>
            </tr>
        `;
    });
}

function filtrarTabela() {
    const termo = document.getElementById("buscaNome").value.toLowerCase().trim();
    const statusSel = document.getElementById("filtroStatus").value;
    const filtrada = cacheTecnicos.filter(t => {
        const s = t.status || "Ativo";
        return t.nome.toLowerCase().includes(termo) && (statusSel === "TODOS" || s === statusSel);
    });
    renderizarTabela(filtrada);
}

function abrirModalTecnico() {
    document.getElementById("modalTituloTecnico").innerText = "Adicionar Novo Técnico";
    document.getElementById("tecnicoId").value = "";
    document.getElementById("formNome").value = "";
    document.getElementById("formStatus").value = "Ativo";
    document.getElementById("formTelefone").value = "";
    document.getElementById("formEmail").value = "";
    document.getElementById("formVeiculo").value = "";
    document.getElementById("formPlaca").value = "";
    document.getElementById("modalTecnico").classList.add("ativo"); 
}

function prepararEdicaoTecnico(id) {
    const t = cacheTecnicos.find(item => item._id === id);
    if (!t) return;
    document.getElementById("modalTituloTecnico").innerText = `Editar: ${t.nome}`;
    document.getElementById("tecnicoId").value = t._id;
    document.getElementById("formNome").value = t.nome;
    document.getElementById("formStatus").value = t.status || "Ativo";
    document.getElementById("formTelefone").value = t.telefone || "";
    document.getElementById("formEmail").value = t.email || "";
    document.getElementById("formVeiculo").value = t.veiculo || "";
    document.getElementById("formPlaca").value = t.placa || "";
    document.getElementById("modalTecnico").classList.add("ativo"); 
}

async function salvarTecnico() {
    const id = document.getElementById("tecnicoId").value;
    const payload = {
        nome: document.getElementById("formNome").value.trim(), status: document.getElementById("formStatus").value,
        telefone: document.getElementById("formTelefone").value.trim(), email: document.getElementById("formEmail").value.trim(),
        veiculo: document.getElementById("formVeiculo").value.trim(), placa: document.getElementById("formPlaca").value.trim()
    };
    if (!payload.nome) return alert("O Nome é obrigatório.");
    try {
        const url = id ? `/api/tecnicos-dashboard/${id}` : "/api/tecnicos-dashboard";
        const metodo = id ? "PUT" : "POST";
        const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload) });
        if (!res.ok) return alert("Erro no servidor.");
        fecharModal('modalTecnico');
        await carregarTecnicos();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarTecnico(id) {
    if (!confirm("Remover este técnico permanentemente da Frota?")) return;
    try {
        const res = await fetch(`/api/tecnicos-dashboard/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarTecnicos();
    } catch (err) { console.error(err); }
}

// --- IMPRESSÃO DO CÓDIGO DE BARRAS (FÁBRICA DE CRACHÁS) ---
function imprimirCracha(nomeTecnico) {
    const janelaCracha = window.open('', '', 'width=450,height=350');
    janelaCracha.document.write(`
        <html>
        <head>
            <title>Crachá - ${nomeTecnico}</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <style>
                body { text-align: center; font-family: 'Segoe UI', Arial, sans-serif; padding-top: 20px; background: white; }
                .cartao { border: 2px solid #1E293B; padding: 25px; display: inline-block; border-radius: 12px; width: 300px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                .logo-texto { font-size: 20px; font-weight: 900; color: #1E293B; margin: 0 0 15px 0; letter-spacing: 1px; }
                .cargo { margin-top: 15px; font-weight: bold; color: #3B82F6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
            </style>
        </head>
        <body>
            <div class="cartao">
                <div class="logo-texto">NERI LOGÍSTICA</div>
                <svg id="barcode"></svg>
                <div class="cargo">Técnico de Operações</div>
            </div>
            <script>
                window.onload = function() {
                    JsBarcode("#barcode", "${nomeTecnico}", {
                        format: "CODE128",
                        width: 2.5,
                        height: 70,
                        displayValue: true,
                        fontSize: 16,
                        fontOptions: "bold",
                        textMargin: 8
                    });
                    // Pequeno atraso para garantir que a imagem gerou antes da caixa de impressão aparecer
                    setTimeout(() => { window.print(); window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    janelaCracha.document.close();
}

async function carregarUsuarios() { /* Mantivemos o código de utilizadores inalterado aqui para poupar espaço... */ }