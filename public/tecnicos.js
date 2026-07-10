const token = localStorage.getItem("token");
let cacheTecnicos = [];
let cacheTotem = [];

if (!token) window.location.replace("/login.html");

function obterNivelRealDoToken() {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload).tipo;
    } catch (e) { return null; }
}

document.addEventListener("DOMContentLoaded", async () => {
    const usuarioTipo = localStorage.getItem("usuarioTipo");
    const tipoReal = obterNivelRealDoToken(); 
    
    if (usuarioTipo === "master" || tipoReal === "superadmin") {
        document.getElementById("btnTabUsuarios").style.display = "flex";
    }

    if (tipoReal === "superadmin" && document.getElementById("btnTabEmpresas")) {
        document.getElementById("btnTabEmpresas").style.display = "flex";
        if(typeof carregarEmpresas === 'function') await carregarEmpresas();
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

// --- TÉCNICOS DE CAMPO (FROTA) ---
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

// --- RESTAURAÇÃO: USUÁRIOS DO SISTEMA ---
async function carregarUsuarios() {
    const corpo = document.getElementById("corpoTabelaUsuarios");
    if(!corpo) return;
    corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>`;
    try {
        const res = await fetch("/api/usuarios", { headers: { "Authorization": `Bearer ${token}` } });
        const usuarios = await res.json();
        corpo.innerHTML = "";
        
        usuarios.forEach(u => {
            let badge = `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94A3B8;">Simples</span>`;
            if (u.tipo === "master") badge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#FBBF24;">Master</span>`;
            else if (u.tipo === "admin") badge = `<span class="badge" style="background:rgba(96,165,250,0.15); color:#60A5FA;">Admin</span>`;
            else if (u.tipo === "estoque") badge = `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34D399;">Estoque</span>`;
            else if (u.tipo === "tecnico") badge = `<span class="badge" style="background:rgba(6, 182, 212, 0.15); color:#22D3EE;">Técnico</span>`;
            else if (u.tipo === "superadmin") badge = `<span class="badge" style="background:rgba(139, 92, 246, 0.15); color:#8B5CF6;">Super Admin</span>`;

            corpo.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 15px;"><strong>${u.nome}</strong></td>
                    <td>${u.usuario}</td>
                    <td>${badge}</td>
                    <td>
                        ${u.tipo !== "superadmin" ? `<button class="btn-mini btn-editar" onclick="prepararEdicaoUsuario('${u._id}', '${u.nome}', '${u.usuario}', '${u.tipo}')">Editar</button> <button class="btn-mini btn-excluir" onclick="deletarUsuario('${u._id}')">Excluir</button>` : `<span style="color:#64748B; font-size:11px;">Protegido</span>`}
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
    document.getElementById("modalUsuario").classList.add("ativo"); 
}

function prepararEdicaoUsuario(id, nome, usuario, tipoReal) {
    document.getElementById("modalTituloUsuario").innerText = `Editar: ${usuario}`;
    document.getElementById("usuarioEditId").value = id;
    document.getElementById("cadNome").value = nome;
    document.getElementById("cadUsuario").value = usuario;
    document.getElementById("cadUsuario").disabled = true; 
    document.getElementById("cadSenha").value = "";
    document.getElementById("cadTipo").value = tipoReal;
    document.getElementById("modalUsuario").classList.add("ativo");
}

async function salvarUsuario() {
    const id = document.getElementById("usuarioEditId").value;
    const nome = document.getElementById("cadNome").value.trim();
    const usuario = document.getElementById("cadUsuario").value.trim();
    const senha = document.getElementById("cadSenha").value;
    const tipo = document.getElementById("cadTipo").value;
    if (!nome || !usuario) return alert("Preencha todos os campos obrigatórios.");
    try {
        let res;
        if (id) {
            res = await fetch(`/api/usuarios/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ nome, tipo, senha }) });
        } else {
            res = await fetch("/cadastro", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ nome, usuario, senha, tipo }) });
        }
        if (!res.ok) return alert("Erro na operação.");
        fecharModal('modalUsuario');
        await carregarUsuarios();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarUsuario(id) {
    if (!confirm("Deseja remover este usuário permanentemente?")) return;
    try {
        const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarUsuarios();
    } catch (err) { console.error(err); }
}

// --- NOVA ABA: EQUIPA TOTEM (FILA/CRACHÁS) ---
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
    document.getElementById("totemId").value = "";
    document.getElementById("formTotemNome").value = "";
    document.getElementById("formTotemFuncao").value = "";
    document.getElementById("modalTotem").classList.add("ativo");
}

function prepararEdicaoTotem(id, nome, funcao) {
    document.getElementById("modalTituloTotem").innerText = "Editar Pessoa";
    document.getElementById("totemId").value = id;
    document.getElementById("formTotemNome").value = nome;
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
        fecharModal('modalTotem');
        await carregarEquipeTotem();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarPessoaTotem(id) {
    if (!confirm("Remover esta pessoa do registo do Totem?")) return;
    try {
        const res = await fetch(`/api/equipe-totem/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarEquipeTotem();
    } catch (err) { console.error(err); }
}

// --- IMPRESSÃO DO CÓDIGO DE BARRAS ---
function imprimirCracha(nomePessoa, funcao = "Equipe Operacional") {
    const janelaCracha = window.open('', '', 'width=450,height=350');
    janelaCracha.document.write(`
        <html>
        <head>
            <title>Crachá - ${nomePessoa}</title>
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
                <div class="cargo">${funcao}</div>
            </div>
            <script>
                window.onload = function() {
                    JsBarcode("#barcode", "${nomePessoa}", {
                        format: "CODE128", width: 2.5, height: 70, displayValue: true, fontSize: 16, fontOptions: "bold", textMargin: 8
                    });
                    setTimeout(() => { window.print(); window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    janelaCracha.document.close();
}