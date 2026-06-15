const token = localStorage.getItem("token");
window.cacheFerramentas = [];
window.tecnicoSelecionado = "";
window.listaTecnicos = [];

// Funções de controle de Modal nativas do seu layout
window.abrirModal = (id) => { document.getElementById(id).style.display = 'flex'; };
window.fecharModal = (id) => { document.getElementById(id).style.display = 'none'; };
window.deslogar = () => { localStorage.clear(); window.location.href = "/login.html"; };
window.voltarParaDashboard = () => { window.location.href = "/index.html"; };

document.addEventListener("DOMContentLoaded", async () => {

    await carregarEstoque();

    await renderizarListaTecnicos();

    mostrarTelaInicial();

});

// =================================================================
// --- GERENCIAMENTO DE TÉCNICOS ---
// =================================================================
async function renderizarListaTecnicos() {

    try {

        const res = await fetch(
            "/api/tecnicos",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        window.listaTecnicos = await res.json();

        const listaEsq =
            document.getElementById("listaTecnicosEsq");

        const containerGerenciar =
            document.getElementById(
                "listaGerenciarTecnicosContainer"
            );

        listaEsq.innerHTML = "";
        containerGerenciar.innerHTML = "";

        window.listaTecnicos.forEach(t => {

            const li =
                document.createElement("li");

            li.className =
                `tecnico-item ${
                    window.tecnicoSelecionado === t.nome
                        ? "selecionado"
                        : ""
                }`;

            li.innerText = t.nome;

            li.onclick = () =>
                selecionarTecnico(t.nome);

            listaEsq.appendChild(li);

            containerGerenciar.innerHTML += `
                <div class="item-gerenciamento">
                    <span>${t.nome}</span>
                    <button
                        class="btn-mini"
                        style="background:#ef4444;"
                        onclick="removerTecnico('${t._id}')">
                        Excluir
                    </button>
                </div>
            `;
        });

    } catch (erro) {

        console.error(
            "Erro ao carregar técnicos:",
            erro
        );
    }
}
window.renderizarListaTecnicos = renderizarListaTecnicos;

function selecionarTecnico(nome) {

    window.tecnicoSelecionado = nome;

    document.getElementById(
        "logoCentro"
    ).style.display = "none";

    document.getElementById(
        "containerHistorico"
    ).style.display = "block";

    document.getElementById(
        "tituloHistoricoTecnico"
    ).innerText = `Histórico - ${nome}`;

    renderizarListaTecnicos();

    carregarLogs(nome);
}
window.selecionarTecnico = selecionarTecnico;

window.guardarTecnico = async () => {

    const input = document.getElementById("inputNomeTecnico");
    const nome = input.value.trim();

    if (!nome) return;

    try {

        const res = await fetch("/api/tecnicos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ nome })
        });

        const resultado = await res.json();

        if (!res.ok) {
            alert(resultado.erro || "Erro ao cadastrar técnico");
            return;
        }

        input.value = "";

        await renderizarListaTecnicos();

    } catch (erro) {

        console.error(erro);

        alert("Erro ao cadastrar técnico.");
    }
};

window.removerTecnico = async (id) => {

    if (
        !confirm(
            "Deseja excluir este técnico?"
        )
    ) return;

    try {

        await fetch(
            `/api/tecnicos/${id}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        await renderizarListaTecnicos();

    } catch (erro) {

        console.error(erro);

        alert(
            "Erro ao excluir técnico."
        );
    }
};

// =================================================================
// --- CONTROLE DE ESTOQUE (CRUD) ---
// =================================================================
async function carregarEstoque() {
    try {
        const res = await fetch("/api/estoque", { headers: { "Authorization": `Bearer ${token}` } });
        window.cacheFerramentas = await res.json();
        
        const corpo = document.getElementById("corpoTabelaEstoque");
        const select = document.getElementById("histItemVinculado");
        
        corpo.innerHTML = "";
        select.innerHTML = '<option value="">Nenhum item</option>';
        
        window.cacheFerramentas.forEach(f => {
            corpo.innerHTML += `<tr>
                <td>${f.codigo}</td>
                <td><strong>${f.nome}</strong></td>
                <td>${f.categoria || '-'}</td>
                <td>${f.localizacao || '-'}</td>
                <td>R$ ${parseFloat(f.preco || 0).toFixed(2)}</td>
                <td>${f.qtd}</td>
                <td>
                    <button class="btn-editar" onclick="prepararEdicao('${f._id}')">Editar</button>
                    <button class="btn-remover" onclick="deletarFerramenta('${f._id}')">Excluir</button>
                </td>
            </tr>`;
            
            select.innerHTML += `<option value="${f._id}">${f.nome}</option>`;
        });
    } catch (e) { 
        console.error("Erro ao carregar estoque:", e); 
    }
}
window.carregarEstoque = carregarEstoque;

window.salvarNovaFerramenta = async () => {
    const dados = {
        codigo: document.getElementById("addCodigo").value,
        nome: document.getElementById("addNome").value,
        categoria: document.getElementById("addCategoria").value,
        localizacao: document.getElementById("addLocal").value,
        preco: parseFloat(document.getElementById("addPreco").value || 0),
        qtd: parseInt(document.getElementById("addQtd").value || 0)
    };

    await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(dados)
    });
    window.fecharModal('modalFerramenta');
    carregarEstoque();
};

async function deletarFerramenta(id) {
    if (!confirm("Deseja realmente excluir este item permanentemente?")) return;
    await fetch(`/api/estoque/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
    carregarEstoque();
}
window.deletarFerramenta = deletarFerramenta;

window.abrirModalCadastro = () => {
    document.getElementById("addCodigo").value = "";
    document.getElementById("addNome").value = "";
    document.getElementById("addCategoria").value = "";
    document.getElementById("addLocal").value = "";
    document.getElementById("addPreco").value = "";
    document.getElementById("addQtd").value = "";
    window.abrirModal('modalFerramenta');
};

function prepararEdicao(id) {
    const item = window.cacheFerramentas.find(f => f._id === id);
    if (!item) return;
    document.getElementById("editId").value = item._id;
    document.getElementById("editCodigo").value = item.codigo;
    document.getElementById("editNome").value = item.nome;
    document.getElementById("editCategoria").value = item.categoria || "";
    document.getElementById("editLocal").value = item.localizacao || "";
    document.getElementById("editPreco").value = item.preco;
    document.getElementById("editQtd").value = item.qtd;
    window.abrirModal("modalEditarFerramenta");
}
window.prepararEdicao = prepararEdicao;

window.salvarEdicaoFerramenta = async () => {
    const id = document.getElementById("editId").value;
    const dados = {
        codigo: document.getElementById("editCodigo").value,
        nome: document.getElementById("editNome").value,
        categoria: document.getElementById("editCategoria").value,
        localizacao: document.getElementById("editLocal").value,
        preco: parseFloat(document.getElementById("editPreco").value || 0),
        qtd: parseInt(document.getElementById("editQtd").value || 0)
    };

    await fetch(`/api/estoque/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(dados)
    });
    window.fecharModal('modalEditarFerramenta');
    carregarEstoque();
};

// =================================================================
// --- LANÇAMENTO DE MOVIMENTAÇÕES E HISTÓRICO ---
// =================================================================
window.salvarLinhaHistorico = async () => {
    if (!window.tecnicoSelecionado) return alert("Por favor, selecione um técnico primeiro!");
    
    const itemId = document.getElementById("histItemVinculado").value;
    let itemNome = "Nenhum";
    
    if (itemId) {
        const itemEncontrado = window.cacheFerramentas.find(f => f._id === itemId);
        if (itemEncontrado) itemNome = itemEncontrado.nome;
    }

    const payload = {
        tecnico: window.tecnicoSelecionado,
        ferramentaId: itemId || null,
        ferramentaNome: itemNome,
        quantidade: parseInt(document.getElementById("histQtd").value || 1),
        tipoAcao: document.getElementById("histTipoAcao").value,
        observacao: document.getElementById("histTextoObs").value,
        data: new Date().toISOString()
    };

    try {
        const res = await fetch("/api/estoque/historico", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const resultado = await res.json();

        if (!res.ok || !resultado.ok) {
            alert(resultado.erro || "Erro ao gravar movimentação.");
            return;
        }

        alert("Histórico gravado com sucesso e estoque atualizado!");

        document.getElementById("histTextoObs").value = "";
        document.getElementById("histQtd").value = 1;

        await carregarEstoque();
        await carregarLogs(window.tecnicoSelecionado);

    } catch (erro) {
        console.error(erro);
        alert("Erro de conexão ao salvar histórico.");
    }
};

async function carregarLogs(nome) {
    try {
        const res = await fetch(`/api/estoque/historico/${encodeURIComponent(nome)}`, { headers: { "Authorization": `Bearer ${token}` } });
        const logs = await res.json();
        const corpo = document.getElementById("corpoTabelaLogs");
        corpo.innerHTML = "";

        logs.forEach(l => {
            let corTipo = "#f59e0b"; 
            if (l.tipoAcao === "Entrega") corTipo = "#10b981"; 
            if (l.tipoAcao === "Troca") corTipo = "#ef4444"; 
            if (l.tipoAcao === "Devolução" || l.tipoAcao === "Devolucao") corTipo = "#2563EB"; 

            corpo.innerHTML += `
                <tr>
                    <td>${new Date(l.data).toLocaleDateString('pt-BR')}</td>
                    <td><span style="color: ${corTipo}; font-weight: bold;">${l.tipoAcao}</span></td>
                    <td>${l.ferramentaNome || 'Nenhum'}</td>
                    <td>${l.quantidade || 1}</td>
                    <td>${l.observacao || '-'}</td>
                </tr>`;
        });
    } catch (e) { 
        console.error("Erro ao carregar logs:", e); 
    }
}
window.carregarLogs = carregarLogs;

// =================================================================
// --- EXTRAÇÃO DE RELATÓRIO PDF DESIGN MODERNO AUTOMÁTICO ---
// =================================================================
window.emitirPDFIndividual = () => {
    if (!window.tecnicoSelecionado) return alert("Selecione um técnico para extrair!");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configurações de Paleta de Cores do Index (Slate / Dark Professional)
    const corPrimaria = [15, 23, 42];    // #0F172A
    const corTextoSec = [148, 163, 184]; // #94A3B8
    const corLinhaPar = [241, 245, 249]; // Fundo cinza claro para zebrado
    
    // --- CABEÇALHO ---
    doc.setFillColor(...corPrimaria);
    doc.rect(0, 0, 220, 38, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NERI — CONTROLE DE ESTOQUE E CAUTELA", 14, 16);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(186, 230, 253); // azul claro
    doc.text(`TÉCNICO RESPONSÁVEL: ${window.tecnicoSelecionado.toUpperCase()}`, 14, 24);
    doc.text(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
    
    // --- CORPO / TABELA COMPACTA ---
    let y = 52;
    doc.setTextColor(...corPrimaria);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Histórico de Movimentações Ativas", 14, y);
    
    y += 6;
    
    // Desenhar Cabeçalho da Tabela estilizada
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.rect(14, y, 182, 8, "F");
    
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("DATA", 16, y + 5.5);
    doc.text("AÇÃO", 42, y + 5.5);
    doc.text("ITEM / FERRAMENTA", 72, y + 5.5);
    doc.text("QTD", 132, y + 5.5);
    doc.text("OBSERVAÇÕES", 147, y + 5.5);
    
    y += 8;
    
    let par = false;
    const linhas = document.querySelectorAll("#corpoTabelaLogs tr");
    
    if (linhas.length === 0) {
        doc.setFont("Helvetica", "italic");
        doc.setTextColor(...corTextoSec);
        doc.text("Nenhum registro encontrado para este técnico.", 16, y + 8);
    }

    linhas.forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 5) {
            // Quebra dinamicamente o texto da observação para caber em uma largura máxima de 48mm
            const obsTexto = tds[4].innerText || "-";
            const linhasObs = doc.splitTextToSize(obsTexto, 48);
            
            // Quebra o texto da ferramenta para caber em 55mm (evita invadir a coluna QTD)
            const ferramentaTexto = tds[2].innerText || "Nenhum";
            const linhasFerramenta = doc.splitTextToSize(ferramentaTexto, 55);
            
            // Calcula a altura necessária baseado em qual texto ficou maior
            const totalLinhas = Math.max(linhasObs.length, linhasFerramenta.length);
            const alturaLinha = totalLinhas > 1 ? (totalLinhas * 5) + 2 : 7;

            // Nova página se estourar o limite vertical seguro
            if (y + alturaLinha > 275) { 
                doc.addPage(); 
                y = 20; 
            }
            
            // Fundo zebrado simulando o layout
            if (par) {
                doc.setFillColor(...corLinhaPar);
                doc.rect(14, y, 182, alturaLinha, "F");
            }
            
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(51, 65, 85);
            
            // Imprime Data
            doc.text(tds[0].innerText, 16, y + 5);
            
            // Cor customizada para o tipo de Ação
            const acao = tds[1].innerText;
            if (acao.includes("Entrega")) doc.setTextColor(16, 185, 129); // Verde
            else if (acao.includes("Troca")) doc.setTextColor(239, 68, 68); // Vermelho
            else if (acao.includes("Devolu")) doc.setTextColor(37, 99, 235); // Azul
            else doc.setTextColor(245, 158, 11); // Laranja
            
            doc.setFont("Helvetica", "bold");
            doc.text(acao, 42, y + 5);
            
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(51, 65, 85);
            
            // Imprime Ferramenta (Multi-linha se necessário)
            doc.text(linhasFerramenta, 72, y + 5);
            
            // Imprime Quantidade
            doc.text(tds[3].innerText, 134, y + 5);
            
            // Imprime Observações completas sem cortes (Multi-linha se necessário)
            doc.text(linhasObs, 147, y + 5);
            
            y += alturaLinha;
            par = !par;
        }
    });
    
    // --- ASSINATURA DE CONTROLE ---
    y += 15;
    if (y > 260) { doc.addPage(); y = 30; }
    
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y, 90, y);
    doc.line(110, y, 196, y);
    
    doc.setFontSize(8);
    doc.setTextColor(...corTextoSec);
    doc.text("Assinatura do Técnico", 14, y + 4);
    doc.text("Almoxarifado / Responsável NERI", 110, y + 4);
    
    doc.save(`Relatorio_Cautela_${window.tecnicoSelecionado}.pdf`);
};

window.selecionarGeral = async () => {

    window.tecnicoSelecionado = "";

    document.getElementById(
        "containerHistorico"
    ).style.display = "block";

    document.getElementById(
        "tituloHistoricoTecnico"
    ).innerText = "Histórico Geral";

    try {

        const res = await fetch(
            "/api/estoque/historico",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const logs = await res.json();

        const corpo =
            document.getElementById("corpoTabelaLogs");

        corpo.innerHTML = "";

        logs.forEach(l => {

            let corTipo = "#f59e0b";

            if (l.tipoAcao === "Entrega")
                corTipo = "#10b981";

            if (l.tipoAcao === "Troca")
                corTipo = "#ef4444";

            if (
                l.tipoAcao === "Devolução" ||
                l.tipoAcao === "Devolucao"
            )
                corTipo = "#2563EB";

            corpo.innerHTML += `
            <tr>
                <td>${new Date(l.data).toLocaleDateString('pt-BR')}</td>
                <td>
                    <strong>${l.tecnico}</strong>
                </td>
                <td>
                    <span style="color:${corTipo};font-weight:bold;">
                        ${l.tipoAcao}
                    </span>
                </td>
                <td>${l.ferramentaNome || "-"}</td>
                <td>${l.quantidade || 1}</td>
                <td>${l.observacao || "-"}</td>
            </tr>`;
        });

    } catch (erro) {

        console.error(erro);

        alert(
            "Erro ao carregar histórico geral."
        );
    }
};

window.mostrarTelaInicial = () => {

    window.tecnicoSelecionado = "";

    document.getElementById(
        "containerHistorico"
    ).style.display = "none";

    document.getElementById(
        "logoCentro"
    ).style.display = "block";

    document
        .querySelectorAll(".tecnico-item")
        .forEach(el => el.classList.remove("selecionado"));
};