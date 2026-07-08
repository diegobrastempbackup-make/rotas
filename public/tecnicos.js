const token = localStorage.getItem("token");
let cacheTecnicos = [];

if (!token) window.location.replace("/login.html");

document.addEventListener("DOMContentLoaded", async () => {
    // Esconde a aba de usuários se não for Master
    const usuarioTipo = localStorage.getItem("usuarioTipo");
    if (usuarioTipo !== "master") {
        document.getElementById("btnTabUsuarios").style.display = "none";
    }

    await carregarTecnicos();
    await carregarUsuarios(); // Carrega os usuários também

    document.getElementById("buscaNome").addEventListener("input", filtrarTabela);
    document.getElementById("filtroStatus").addEventListener("change", filtrarTabela);
});

// ================= CONTROLE DE ABAS =================
function mudarAba(abaSelecionada) {
    document.getElementById("abaTecnicos").style.display = abaSelecionada === 'tecnicos' ? 'block' : 'none';
    document.getElementById("abaUsuarios").style.display = abaSelecionada === 'usuarios' ? 'block' : 'none';
    
    document.getElementById("btnTabTecnicos").className = abaSelecionada === 'tecnicos' ? 'tab-btn ativa' : 'tab-btn';
    document.getElementById("btnTabUsuarios").className = abaSelecionada === 'usuarios' ? 'tab-btn ativa' : 'tab-btn';
}

// ================= CONTROLE DE MODAIS (CORRIGIDO PARA .ativo) =================
function fecharModal(idModal) {
    document.getElementById(idModal).classList.remove("ativo");
}

// ================= LÓGICA DE TÉCNICOS =================
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
    
    const totalGlobal = ativos + ferias + afastados;
    document.getElementById("cardAtivos").innerText = ativos;
    document.getElementById("cardFerias").innerText = ferias;
    document.getElementById("cardAfastados").innerText = afastados;
    document.getElementById("cardDesligados").innerText = desligados;

    document.getElementById("pctAtivos").innerText = totalGlobal > 0 ? `${Math.round((ativos/totalGlobal)*100)}% da equipe` : "0% da equipe";
    document.getElementById("pctFerias").innerText = totalGlobal > 0 ? `${Math.round((ferias/totalGlobal)*100)}% da equipe` : "0% da equipe";
    document.getElementById("pctAfastados").innerText = totalGlobal > 0 ? `${Math.round((afastados/totalGlobal)*100)}% da equipe` : "0% da equipe";
    document.getElementById("pctDesligados").innerText = `${desligados} do total geral`;
}

function renderizarTabela(lista) {
    const corpo = document.getElementById("corpoTabelaTecnicos");
    corpo.innerHTML = "";
    if (lista.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8" style="text-align:center;">Nenhum técnico localizado.</td></tr>`;
        return;
    }

    lista.forEach(t => {
        const statusReal = t.status || "Ativo";
        let classeBadge = "badge-ativo";
        if (statusReal === "Em Férias") classeBadge = "badge-ferias";
        if (statusReal === "Afastado") classeBadge = "badge-afastado";
        if (statusReal === "Desligado") classeBadge = "badge-desligado";

        const dataCriacao = t.criadoEm ? new Date(t.criadoEm).toLocaleDateString("pt-BR") : "Histórico";

        corpo.innerHTML += `
            <tr>
                <td><strong>${t.nome}</strong></td>
                <td><span class="badge ${classeBadge}">${statusReal}</span></td>
                <td>${t.telefone || "-"}</td>
                <td>${t.email || "-"}</td>
                <td>${t.veiculo || "-"}</td>
                <td>${t.placa || "-"}</td>
                <td>${dataCriacao}</td>
                <td>
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
    document.getElementById("modalTecnico").classList.add("ativo"); // Corrigido para .ativo
}

function prepararEdicaoTecnico(id) {
    const t = cacheTecnicos.find(item => item._id === id);
    if (!t) return;
    document.getElementById("modalTituloTecnico").innerText = `Editar Cadastro: ${t.nome}`;
    document.getElementById("tecnicoId").value = t._id;
    document.getElementById("formNome").value = t.nome;
    document.getElementById("formStatus").value = t.status || "Ativo";
    document.getElementById("formTelefone").value = t.telefone || "";
    document.getElementById("formEmail").value = t.email || "";
    document.getElementById("formVeiculo").value = t.veiculo || "";
    document.getElementById("formPlaca").value = t.placa || "";
    document.getElementById("modalTecnico").classList.add("ativo"); // Corrigido para .ativo
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

// ================= LÓGICA DE USUÁRIOS (MIGRADA DO APP.JS) =================
async function carregarUsuarios() {
    const corpo = document.getElementById("corpoTabelaUsuarios");
    corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>`;
    try {
        const res = await fetch("/api/usuarios", { headers: { "Authorization": `Bearer ${token}` } });
        const usuarios = await res.json();
        corpo.innerHTML = "";
        
        usuarios.forEach(u => {
            let exibicaoNome = u.nome;
            let exibicaoTipo = u.tipo;

            if (u.nome && u.nome.toUpperCase().includes("ESTOQUE")) {
                exibicaoNome = u.nome.replace(" [ESTOQUE]", "").replace(" ESTOQUE", "").trim();
                exibicaoTipo = "estoque";
            }

            let badge = "";
            if (exibicaoTipo === "master") badge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#FBBF24;">Master</span>`;
            else if (exibicaoTipo === "admin") badge = `<span class="badge" style="background:rgba(96,165,250,0.15); color:#60A5FA;">Admin</span>`;
            else if (exibicaoTipo === "estoque") badge = `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34D399;">Estoque</span>`;
            else badge = `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94A3B8;">Simples</span>`;

            corpo.innerHTML += `
                <tr>
                    <td><strong>${exibicaoNome}</strong></td>
                    <td>${u.usuario}</td>
                    <td>${badge}</td>
                    <td>
                        <button class="btn-mini btn-editar" onclick="prepararEdicaoUsuario('${u._id}', '${exibicaoNome}', '${u.usuario}', '${exibicaoTipo}')">Editar</button>
                        <button class="btn-mini btn-excluir" onclick="deletarUsuario('${u._id}')">Excluir</button>
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
    document.getElementById("lblSenha").innerText = "Senha de Acesso";
    document.getElementById("cadSenha").placeholder = "Digite a senha";
    document.getElementById("cadTipo").value = "simples";
    document.getElementById("modalUsuario").classList.add("ativo"); // Usa a classe oficial do style.css
}

function prepararEdicaoUsuario(id, nome, usuario, tipoReal) {
    document.getElementById("modalTituloUsuario").innerText = `Editar: ${usuario}`;
    document.getElementById("usuarioEditId").value = id;
    document.getElementById("cadNome").value = nome;
    document.getElementById("cadUsuario").value = usuario;
    document.getElementById("cadUsuario").disabled = true; 
    document.getElementById("cadSenha").value = "";
    document.getElementById("lblSenha").innerText = "Nova Senha (vazio mantém a atual)";
    document.getElementById("cadSenha").placeholder = "Apenas se for alterar";
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
            res = await fetch(`/api/usuarios/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ nome, tipo, senha })
            });
        } else {
            res = await fetch("/cadastro", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ nome, usuario, senha, tipo })
            });
        }

        const dados = await res.json();
        if (!res.ok) return alert(dados.erro || "Erro na operação.");
        
        fecharModal('modalUsuario');
        await carregarUsuarios();
    } catch (err) { alert("Erro de conexão."); }
}

async function deletarUsuario(id) {
    if (!confirm("Atenção! Deseja remover este usuário permanentemente?")) return;
    try {
        const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) await carregarUsuarios();
        else alert("Erro ao excluir.");
    } catch (err) { console.error(err); }
}