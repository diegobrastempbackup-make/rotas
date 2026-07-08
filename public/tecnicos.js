const token = localStorage.getItem("token");
let cacheTecnicos = [];

// Trava inicial de Segurança
if (!token) {
    window.location.replace("/login.html");
}

document.addEventListener("DOMContentLoaded", async () => {
    await carregarTecnicos();
    
    // Listeners para filtragem dinâmica em tempo real
    document.getElementById("buscaNome").addEventListener("input", filtrarTabela);
    document.getElementById("filtroStatus").addEventListener("change", filtrarTabela);
});

async function carregarTecnicos() {
    try {
        const res = await fetch("/api/tecnicos", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!res.ok) return console.error("Erro ao autenticar requisição");
        
        cacheTecnicos = await res.json();
        atualizarCardsIndicadores();
        renderizarTabela(cacheTecnicos);
    } catch (err) {
        console.error("Falha ao carregar técnicos:", err);
    }
}

function atualizarCardsIndicadores() {
    const ativos = cacheTecnicos.filter(t => t.status === "Ativo" || !t.status).length; // Fallback se antigo for nulo
    const ferias = cacheTecnicos.filter(t => t.status === "Em Férias").length;
    const afastados = cacheTecnicos.filter(t => t.status === "Afastado").length;
    const desligados = cacheTecnicos.filter(t => t.status === "Desligado").length;
    
    const totalGlobal = ativos + ferias + afastados; // Equipe ativa de campo
    const totalComDesligados = cacheTecnicos.length;

    document.getElementById("cardAtivos").innerText = ativos;
    document.getElementById("cardFerias").innerText = ferias;
    document.getElementById("cardAfastados").innerText = afastados;
    document.getElementById("cardDesligados").innerText = desligados;

    // Cálculo percentual seguro (evita divisão por zero)
    document.getElementById("pctAtivos").innerText = totalGlobal > 0 ? `${Math.round((ativos/totalGlobal)*100)}% da equipe` : "0% da equipe";
    document.getElementById("pctFerias").innerText = totalGlobal > 0 ? `${Math.round((ferias/totalGlobal)*100)}% da equipe` : "0% da equipe";
    document.getElementById("pctAfastados").innerText = totalGlobal > 0 ? `${Math.round((afastados/totalGlobal)*100)}% da equipe` : "0% da equipe";
    document.getElementById("pctDesligados").innerText = `${desligados} do total geral`;
}

function renderizarTabela(lista) {
    const corpo = document.getElementById("corpoTabelaTecnicos");
    corpo.innerHTML = "";

    if (lista.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--texto-secundario);">Nenhum técnico localizado com os filtros aplicados.</td></tr>`;
        return;
    }

    lista.forEach(t => {
        const statusReal = t.status || "Ativo"; // Trata registros passados que continham apenas o nome
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
    const termoBusca = document.getElementById("buscaNome").value.toLowerCase().trim();
    const statusSelecionado = document.getElementById("filtroStatus").value;

    const listaFiltrada = cacheTecnicos.filter(t => {
        const statusReal = t.status || "Ativo";
        const matchesNome = t.nome.toLowerCase().includes(termoBusca);
        const matchesStatus = statusSelecionado === "TODOS" || statusReal === statusSelecionado;
        
        return matchesNome && matchesStatus;
    });

    renderizarTabela(listaFiltrada);
}

// Controle de Modais
function abrirModalCadastro() {
    document.getElementById("modalTitulo").innerText = "Adicionar Novo Técnico";
    document.getElementById("tecnicoId").value = "";
    document.getElementById("formNome").value = "";
    document.getElementById("formStatus").value = "Ativo";
    document.getElementById("formTelefone").value = "";
    document.getElementById("formEmail").value = "";
    document.getElementById("formVeiculo").value = "";
    document.getElementById("formPlaca").value = "";
    document.getElementById("modalTecnico").style.display = "flex";
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
    
    document.getElementById("modalTecnico").style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalTecnico").style.display = "none";
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

    if (!payload.nome) {
        alert("O preenchimento do campo Nome é obrigatório.");
        return;
    }

    try {
        const url = id ? `/api/tecnicos/${id}` : "/api/tecnicos";
        const metodo = id ? "PUT" : "POST";

        const res = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const dados = await res.json();

        if (!res.ok) {
            alert(dados.erro || "Ocorreu um erro operacional no servidor.");
            return;
        }

        fecharModal();
        await carregarTecnicos();
    } catch (err) {
        console.error("Falha ao salvar:", err);
        alert("Erro de conexão com o servidor backend.");
    }
}

async function deletarTecnico(id) {
    if (!confirm("Tem certeza absoluta que deseja remover este técnico permanentemente do sistema?")) return;

    try {
        const res = await fetch(`/api/tecnicos/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            await carregarTecnicos();
        } else {
            alert("Não foi possível excluir o técnico no momento.");
        }
    } catch (err) {
        console.error(err);
    }
}

// Função para navegar entre as telas mantendo a segurança do token na URL
function navegarSeguro(rota) {
    const tokenAtual = localStorage.getItem("token");
    window.location.href = `${rota}?token=${tokenAtual}`;
}