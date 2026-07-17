const token = localStorage.getItem("token");
let cacheTecnicos = [];
let cacheTotem = [];
window.cacheUsuarios = []; // Cache global de Usuários para não perder os dados na edição

if (!token) window.location.replace("/login.html");

function obterPayloadDoToken() {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

document.addEventListener("DOMContentLoaded", async () => {
    const payload = obterPayloadDoToken();
    const tipoReal = payload ? payload.tipo : null;
    const isSuperAdminDisfarcado = payload ? payload.superadmin_original : false;
    const usuarioTipo = localStorage.getItem("usuarioTipo");
    
    if (usuarioTipo === "master" || tipoReal === "superadmin" || isSuperAdminDisfarcado) {
        document.getElementById("btnTabUsuarios").style.display = "flex";
    }

    if (tipoReal === "superadmin") {
        document.getElementById("btnTabEmpresas").style.display = "flex";
        if(typeof carregarEmpresas === 'function') await carregarEmpresas();
    }

    if (isSuperAdminDisfarcado) {
        const menus = document.querySelector('.menu');
        if(menus) {
            menus.innerHTML += `<hr><button onclick="voltarSuperAdmin()" style="background:#EF4444; color:white; border:1px solid #B91C1C; font-weight:bold;">🔙 Voltar ao Painel Global</button>`;
        }
    }

    await carregarTecnicos();
    await carregarUsuarios();
    await carregarEquipeTotem();

    const buscaNome = document.getElementById("buscaNome");
    const filtroStatus = document.getElementById("filtroStatus");
    if(buscaNome) buscaNome.addEventListener("input", filtrarTabela);
    if(filtroStatus) filtroStatus.addEventListener("change", filtrarTabela);
});

function mudarAba(abaSelecionada) {
    const abas = ['tecnicos', 'usuarios', 'empresas', 'totem'];
    abas.forEach(aba => {
        const el = document.getElementById(`aba${aba.charAt(0).toUpperCase() + aba.slice(1)}`);
        const btn = document.getElementById(`btnTab${aba.charAt(0).toUpperCase() + aba.slice(1)}`);
        if(el) el.style.display = abaSelecionada === aba ? 'block' : 'none';
        if(btn) btn.className = abaSelecionada === aba ? 'tab-btn ativa' : 'tab-btn';
    });
}

function fecharModal(idModal) { document.getElementById(idModal).classList.remove("ativo"); }

// =========================================================
// FUNÇÃO MÁGICA DE CEP PARA USUÁRIOS TÉCNICOS
// =========================================================
async function buscarCep(cep) {
    const cepLimpo = cep.replace(/\D/g, '');
    if(cepLimpo.length !== 8) return;
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const dados = await res.json();
        if(!dados.erro) {
            document.getElementById("cadBairro").value = dados.bairro + " - " + dados.localidade;
        }
    } catch(e) {}
}

// =========================================================
// MODO ESPIÃO: NAVEGAÇÃO DE EMPRESAS (SaaS)
// =========================================================
async function acessarEmpresa(id, nomeEmpresa) {
    try {
        const res = await fetch(`/api/acessar-empresa/${id}`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const dados = await res.json();
        
        if (res.ok) {
            localStorage.setItem("token", dados.token);
            alert(`A transferir painel para a empresa: ${dados.nome}`);
            window.location.replace(`/index.html?token=${dados.token}`);
        } else {
            alert(dados.erro || "Erro ao acessar a empresa.");
        }
    } catch(e) { alert("Erro de comunicação com a central."); }
}

async function voltarSuperAdmin() {
    if(!confirm("Deseja sair do painel desta empresa e voltar à visão global?")) return;
    try {
        const res = await fetch(`/api/voltar-admin`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const dados = await res.json();
        
        if (res.ok) {
            localStorage.setItem("token", dados.token);
            window.location.replace(`/tecnicos.html?token=${dados.token}`);
        }
    } catch(e) {}
}

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
            const btnStatusTexto = emp.ativo !== false ? "Bloquear" : "Desbloquear";
            const novoStatus = emp.ativo !== false ? false : true;

            corpo.innerHTML += `
                <tr>
                    <td><strong>${emp.empresaNome || 'Desconhecida'}</strong></td>
                    <td>${emp.nome}</td>
                    <td><span style="color:#94A3B8;">${emp.usuario}</span></td>
                    <td><span class="badge ${badgeClass}">${statusText}</span></td>
                    <td>${dataReg}</td>
                    <td style="display:flex; gap: 5px;">
                        <button class="btn-mini" style="background:#10B981; color:white; border:none;" onclick="acessarEmpresa('${emp._id}', '${emp.empresaNome}')">👁️ Acessar Dashboard</button>
                        <button class="btn-mini" style="background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3);" onclick="alternarStatusEmpresa('${emp._id}', ${novoStatus})">${btnStatusTexto}</button>
                        <button class="btn-mini btn-excluir" onclick="excluirEmpresa('${emp._id}', '${emp.empresaNome}')">Excluir</button>
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
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ ativo: novoStatus })
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
    document.getElementById("regEmpresa").value = ""; document.getElementById("regNome").value = "";
    document.getElementById("regUsuario").value = ""; document.getElementById("regSenha").value = "";
    document.getElementById("modalEmpresa").classList.add("ativo");
}

async function salvarNovaEmpresa() {
    const empresa = document.getElementById("regEmpresa").value.trim(); const nome = document.getElementById("regNome").value.trim();
    const usuario = document.getElementById("regUsuario").value.trim(); const senha = document.getElementById("regSenha").value;
    if (!empresa || !nome || !usuario || !senha) return alert("Preencha todos os campos.");

    try {
        const res = await fetch("/nova-empresa", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ empresa, nome, usuario, senha })
        });
        const dados = await res.json();
        if (!res.ok) return alert(dados.erro || "Falha no registo.");
        alert(`Cliente ${empresa} criado com sucesso!`);
        fecharModal('modalEmpresa'); await carregarEmpresas();
    } catch (err) { alert("Erro de conexão."); }
}

// =========================================================
// TÉCNICOS DASHBOARD (REVERTIDO PARA O BÁSICO DE FROTA)
// =========================================================
async function carregarTecnicos() {
    try {
        const res = await fetch("/api/tecnicos-dashboard", { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) return;
        cacheTecnicos = await res.json();
        atualizarCardsIndicadores();
        renderizarTabela(cacheTecnicos);
    } catch (err) {}
}

function atualizarCardsIndicadores() {
    const ativos = cacheTecnicos.filter(t => t.status === "Ativo" || !t.status).length;
    const ferias = cacheTecnicos.filter(t => t.status === "Em Férias").length;
    const afastados = cacheTecnicos.filter(t => t.status === "Afastado").length;
    const desligados = cacheTecnicos.filter(t => t.status === "Desligado").length;
    if(document.getElementById("cardAtivos")) document.getElementById("cardAtivos").innerText = ativos;
    if(document.getElementById("cardFerias")) document.getElementById("cardFerias").innerText = ferias;
    if(document.getElementById("cardAfastados")) document.getElementById("cardAfastados").innerText = afastados;
    if(document.getElementById("cardDesligados")) document.getElementById("cardDesligados").innerText = desligados;
}

function renderizarTabela(lista) {
    const corpo = document.getElementById("corpoTabelaTecnicos");
    if(!corpo) return;
    corpo.innerHTML = "";
    lista.forEach(t => {
        const statusReal = t.status || "Ativo";
        let classeBadge = "badge-ativo";
        if (statusReal === "Em Férias") classeBadge = "badge-ferias";
        if (statusReal === "Afastado") classeBadge = "badge-afastado";
        if (statusReal === "Desligado") classeBadge = "badge-desligado";

        corpo.innerHTML += `
            <tr>
                <td style="padding: 10px;"><strong>${t.nome}</strong></td>
                <td style="padding: 10px;"><span class="badge ${classeBadge}">${statusReal}</span></td>
                <td style="padding: 10px;">${t.telefone || "-"}</td>
                <td style="padding: 10px;">${t.email || "-"}</td>
                <td style="padding: 10px;">${t.veiculo || "-"}</td>
                <td style="padding: 10px;">${t.placa || "-"}</td>
                <td style="padding: 10px;">
                    <button class="btn-mini btn-editar" onclick="prepararEdicaoTecnico('${t._id}')">Editar</button>
                    <button class="btn-mini btn-excluir" onclick="deletarTecnico('${t._id}')">Excluir</button>
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
    document.getElementById("modalTituloTecnico").innerText = "Adicionar Técnico Dashboard";
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
        nome: document.getElementById("formNome").value.trim(), 
        status: document.getElementById("formStatus").value,
        telefone: document.getElementById("formTelefone").value.trim(), 
        email: document.getElementById("formEmail").value.trim(),
        veiculo: document.getElementById("formVeiculo").value.trim(), 
        placa: document.getElementById("formPlaca").value.trim()
    };
    if (!payload.nome) return alert("O Nome é obrigatório.");
    try {
        const url = id ? `/api/tecnicos-dashboard/${id}` : "/api/tecnicos-dashboard";
        const metodo = id ? "PUT" : "POST";
        const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload) });
        if (!res.ok) return alert("Erro no servidor.");
        fecharModal('modalTecnico'); await carregarTecnicos();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarTecnico(id) {
    if (!confirm("Remover este técnico permanentemente do Dashboard?")) return;
    try {
        const res = await fetch(`/api/tecnicos-dashboard/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarTecnicos();
    } catch (err) { console.error(err); }
}

// =========================================================
// USUÁRIOS DO SISTEMA (AGORA COM O SUPER CADASTRO DE ROTAS)
// =========================================================
function toggleCamposTecnicoUsuario() {
    const tipo = document.getElementById("cadTipo").value;
    const painel = document.getElementById("camposRoteirizadorUsuario");
    if (tipo === "tecnico") {
        painel.style.display = "block";
    } else {
        painel.style.display = "none";
    }
}

async function carregarUsuarios() {
    const corpo = document.getElementById("corpoTabelaUsuarios");
    if(!corpo) return;
    corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>`;
    try {
        const res = await fetch("/api/usuarios", { headers: { "Authorization": `Bearer ${token}` } });
        const usuarios = await res.json();
        window.cacheUsuarios = usuarios; // Salva para o modal não perder os dados
        corpo.innerHTML = "";
        
        usuarios.forEach(u => {
            let badge = `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94A3B8;">Simples</span>`;
            if (u.tipo === "master") badge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#FBBF24;">Master</span>`;
            else if (u.tipo === "admin") badge = `<span class="badge" style="background:rgba(96,165,250,0.15); color:#60A5FA;">Admin</span>`;
            else if (u.tipo === "estoque") badge = `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34D399;">Estoque</span>`;
            else if (u.tipo === "tecnico") badge = `<span class="badge" style="background:rgba(6, 182, 212, 0.15); color:#22D3EE;">Técnico</span>`;
            else if (u.tipo === "totem") badge = `<span class="badge" style="background:rgba(236, 72, 153, 0.15); color:#F472B6;">Totem</span>`;
            else if (u.tipo === "superadmin") badge = `<span class="badge" style="background:rgba(139, 92, 246, 0.15); color:#8B5CF6;">Super Admin</span>`;

            corpo.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 15px;"><strong>${u.nome}</strong></td>
                    <td>${u.usuario}</td>
                    <td>${badge}</td>
                    <td>
                        ${u.tipo !== "superadmin" ? `<button class="btn-mini btn-editar" onclick="prepararEdicaoUsuario('${u._id}')">Editar</button> <button class="btn-mini btn-excluir" onclick="deletarUsuario('${u._id}')">Excluir</button>` : `<span style="color:#64748B; font-size:11px;">Protegido</span>`}
                    </td>
                </tr>
            `;
        });
    } catch (err) { corpo.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">Erro ao carregar usuários.</td></tr>`; }
}

function abrirModalUsuario() {
    document.getElementById("modalTituloUsuario").innerText = "Novo Usuário";
    document.getElementById("usuarioEditId").value = ""; 
    document.getElementById("cadNome").value = "";
    document.getElementById("cadUsuario").value = ""; 
    document.getElementById("cadUsuario").disabled = false; 
    document.getElementById("cadSenha").value = ""; 
    document.getElementById("cadTipo").value = "simples";
    
    // Limpa campos de Roteirizador
    document.getElementById("cadStatus").value = "Ativo";
    document.getElementById("cadTipoVeiculo").value = "Carro";
    document.getElementById("cadCapacidadeOS").value = "";
    document.getElementById("cadCapacidadeCaixas").value = "";
    document.getElementById("cadCep").value = "";
    document.getElementById("cadBairro").value = "";
    
    toggleCamposTecnicoUsuario();
    document.getElementById("modalUsuario").classList.add("ativo"); 
}

function prepararEdicaoUsuario(id) {
    const u = window.cacheUsuarios.find(x => x._id === id);
    if (!u) return;

    document.getElementById("modalTituloUsuario").innerText = `Editar: ${u.usuario}`;
    document.getElementById("usuarioEditId").value = id; 
    document.getElementById("cadNome").value = u.nome;
    document.getElementById("cadUsuario").value = u.usuario; 
    document.getElementById("cadUsuario").disabled = true; 
    document.getElementById("cadSenha").value = ""; 
    document.getElementById("cadTipo").value = u.tipo;

    // Popula campos avançados se ele for técnico
    document.getElementById("cadStatus").value = u.status || "Ativo";
    document.getElementById("cadTipoVeiculo").value = u.tipoVeiculo || "Carro";
    document.getElementById("cadCapacidadeOS").value = u.capacidadeOS || "";
    document.getElementById("cadCapacidadeCaixas").value = u.capacidadeCaixas || "";
    document.getElementById("cadCep").value = u.cep || "";
    document.getElementById("cadBairro").value = u.bairro || "";

    toggleCamposTecnicoUsuario();
    document.getElementById("modalUsuario").classList.add("ativo");
}

async function salvarUsuario() {
    const id = document.getElementById("usuarioEditId").value;
    const nome = document.getElementById("cadNome").value.trim();
    const usuario = document.getElementById("cadUsuario").value.trim();
    const senha = document.getElementById("cadSenha").value;
    const tipo = document.getElementById("cadTipo").value;

    const status = document.getElementById("cadStatus").value;
    const tipoVeiculo = document.getElementById("cadTipoVeiculo").value;
    const capacidadeOS = document.getElementById("cadCapacidadeOS").value;
    const capacidadeCaixas = document.getElementById("cadCapacidadeCaixas").value;
    const cep = document.getElementById("cadCep").value.trim();
    const bairro = document.getElementById("cadBairro").value.trim();

    if (!nome || !usuario) return alert("Preencha todos os campos obrigatórios.");
    try {
        const payload = { nome, usuario, senha, tipo, status, tipoVeiculo, capacidadeOS, capacidadeCaixas, cep, bairro };
        let res;

        if (id) {
            res = await fetch(`/api/usuarios/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload) });
        } else {
            res = await fetch("/cadastro", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload) });
        }
        if (!res.ok) return alert("Erro na operação.");
        fecharModal('modalUsuario'); await carregarUsuarios();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarUsuario(id) {
    if (!confirm("Deseja remover este usuário permanentemente?")) return;
    try {
        const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarUsuarios();
    } catch (err) { console.error(err); }
}

// =========================================================
// EQUIPA TOTEM
// =========================================================
async function carregarEquipeTotem() {
    const corpo = document.getElementById("corpoTabelaTotem");
    if(!corpo) return;
    corpo.innerHTML = `<tr><td colspan="3" style="text-align:center;">Carregando...</td></tr>`;
    try {
        const res = await fetch("/api/equipe-totem", { headers: { "Authorization": `Bearer ${token}` } });
        const equipe = await res.json();
        corpo.innerHTML = "";
        
        equipe.forEach(p => {
            corpo.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 15px; color: #F8FAFC;"><strong>${p.nome}</strong></td>
                    <td style="padding: 15px; color: #94A3B8;">${p.funcao || "Base"}</td>
                    <td style="padding: 15px; display:flex; gap: 8px;">
                        <button class="btn-mini btn-editar" onclick="prepararEdicaoTotem('${p._id}', '${p.nome}', '${p.funcao}')">Editar</button>
                        <button class="btn-mini btn-excluir" onclick="deletarPessoaTotem('${p._id}')">Excluir</button>
                        <button class="btn-mini" style="background:#8B5CF6; border:1px solid #7C3AED; color:white;" onclick="imprimirCracha('${p.nome}', '${p.funcao || "Base"}')">🖨️ Crachá</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) { corpo.innerHTML = `<tr><td colspan="3" style="color:red; text-align:center;">Erro ao carregar equipa.</td></tr>`; }
}

function abrirModalTotem() {
    document.getElementById("modalTituloTotem").innerText = "Cadastrar Pessoa";
    document.getElementById("totemId").value = ""; document.getElementById("formTotemNome").value = "";
    document.getElementById("formTotemFuncao").value = ""; document.getElementById("modalTotem").classList.add("ativo");
}

function prepararEdicaoTotem(id, nome, funcao) {
    document.getElementById("modalTituloTotem").innerText = "Editar Pessoa";
    document.getElementById("totemId").value = id; document.getElementById("formTotemNome").value = nome;
    document.getElementById("formTotemFuncao").value = funcao !== 'undefined' ? funcao : '';
    document.getElementById("modalTotem").classList.add("ativo");
}

async function salvarPessoaTotem() {
    const id = document.getElementById("totemId").value;
    const nome = document.getElementById("formTotemNome").value.trim();
    const funcao = document.getElementById("formTotemFuncao").value.trim();

    if (!nome) return alert("O Nome é obrigatório.");
    try {
        const url = id ? `/api/equipe-totem/${id}` : "/api/equipe-totem";
        const metodo = id ? "PUT" : "POST";
        const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ nome, funcao }) });
        if (!res.ok) return alert("Erro no servidor.");
        fecharModal('modalTotem'); await carregarEquipeTotem();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarPessoaTotem(id) {
    if (!confirm("Remover esta pessoa do registo do Totem?")) return;
    try {
        const res = await fetch(`/api/equipe-totem/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarEquipeTotem();
    } catch (err) { console.error(err); }
}

function imprimirCracha(nomePessoa, funcao = "Equipe Operacional") {
    const janelaCracha = window.open('', '', 'width=450,height=350');
    janelaCracha.document.write(`
        <html>
        <head>
            <title>Crachá - ${nomePessoa}</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <style>
                body { text-align: center; font-family: 'Segoe UI', Arial, sans-serif; padding-top: 20px; background: white; }
                .cartao { border: 2px solid #1E293B; padding: 25px; display: inline-block; border-radius: 12px; width: 300px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); box-sizing: border-box; }
                .logo-texto { font-size: 20px; font-weight: 900; color: #1E293B; margin: 0 0 15px 0; letter-spacing: 1px; }
                .cargo { margin-top: 15px; font-weight: bold; color: #3B82F6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
                #barcode { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <div class="cartao">
                <div class="logo-texto">NERI LOGÍSTICA</div>
                <svg id="barcode"></svg>
                <div class="cargo">${funcao}</div>
            </div>
            <script>
                window.onload = function() {
                    JsBarcode("#barcode", "${nomePessoa}", { format: "CODE128", width: 1.5, height: 55, displayValue: true, fontSize: 14, fontOptions: "bold", textMargin: 8 });
                    setTimeout(() => { window.print(); window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    janelaCracha.document.close();
}