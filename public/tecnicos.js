const token = localStorage.getItem("token");
let cacheTecnicos = [];

if (!token) window.location.replace("/login.html");

document.addEventListener("DOMContentLoaded", async () => {
    await carregarTecnicos();
    document.getElementById("buscaNome").addEventListener("input", filtrarTabela);
    document.getElementById("filtroStatus").addEventListener("change", filtrarTabela);
});

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
                    <button class="btn-mini btn-editar" onclick="prepararEdicao('${t._id}')">Editar</button>
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

function abrirModalCadastro() {
    document.getElementById("modalTitulo").innerText = "Adicionar Novo Técnico";
    document.getElementById("tecnicoId").value = "";
    document.getElementById("formNome").value = "";
    document.getElementById("formStatus").value = "Ativo";
    document.getElementById("formTelefone").value = "";
    document.getElementById("formEmail").value = "";
    document.getElementById("formVeiculo").value = "";
    document.getElementById("formPlaca").value = "";
    document.getElementById("modalTecnico").classList.add("show");
}

function prepararEdicao(id) {
    const t = cacheTecnicos.find(item => item._id === id);
    if (!t) return;
    document.getElementById("modalTitulo").innerText = `Editar Cadastro: ${t.nome}`;
    document.getElementById("tecnicoId").value = t._id;
    document.getElementById("formNome").value = t.nome;
    document.getElementById("formStatus").value = t.status || "Ativo";
    document.getElementById("formTelefone").value = t.telefone || "";
    document.getElementById("formEmail").value = t.email || "";
    document.getElementById("formVeiculo").value = t.veiculo || "";
    document.getElementById("formPlaca").value = t.placa || "";
    document.getElementById("modalTecnico").classList.add("show");
}

function fecharModal() {
    document.getElementById("modalTecnico").classList.remove("show");
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
        fecharModal();
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