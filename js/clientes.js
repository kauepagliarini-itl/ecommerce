// js/clientes.js

const API_BASE = "http://localhost:3000";

let clientes = [];
let clientesFiltrados = [];

const modalCliente = new bootstrap.Modal(document.getElementById("modalCliente"));

document.addEventListener("DOMContentLoaded", () => {
    carregarClientes();
    configurarEventos();
    configurarMascaraCPF();
});

/**
 * Liga os eventos da página.
 */
function configurarEventos() {
    const formCliente = document.getElementById("formCliente");
    const campoBusca = document.getElementById("campoBuscaCliente");
    const filtroSituacao = document.getElementById("filtroSituacaoCliente");
    const btnNovoCliente = document.getElementById("btnNovoCliente");

    formCliente.addEventListener("submit", salvarCliente);

    campoBusca.addEventListener("input", () => {
        aplicarFiltros();
    });

    filtroSituacao.addEventListener("change", () => {
        aplicarFiltros();
    });

    btnNovoCliente.addEventListener("click", () => {
        prepararFormularioNovo();
    });
}

/**
 * Aplica máscara de CPF no campo enquanto o usuário digita.
 */
function configurarMascaraCPF() {
    const campoCPF = document.getElementById("cpfCliente");
    if (!campoCPF) return;

    campoCPF.addEventListener("input", (e) => {
        let valor = e.target.value.replace(/\D/g, "");
        if (valor.length > 11) valor = valor.slice(0, 11);

        if (valor.length > 9) {
            valor = valor.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
        } else if (valor.length > 6) {
            valor = valor.replace(/^(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3");
        } else if (valor.length > 3) {
            valor = valor.replace(/^(\d{3})(\d{1,3})$/, "$1.$2");
        }

        e.target.value = valor;
    });
}

/**
 * Busca todos os clientes no json-server.
 */
async function carregarClientes() {
    try {
        const resposta = await fetch(`${API_BASE}/clientes`);
        if (!resposta.ok) throw new Error("Erro ao carregar clientes");
        clientes = await resposta.json();
        clientesFiltrados = [...clientes];
        renderizarClientes(clientesFiltrados);
        atualizarTotalClientes(clientesFiltrados.length);
    } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
        Swal.fire({
            title: "Erro!",
            text: "Não foi possível carregar os clientes.",
            icon: "error"
        });
    }
}

/**
 * Mostra os clientes na tabela.
 */
function renderizarClientes(lista) {
    const tbody = document.getElementById("tabelaClientes");
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          <i class="fa-solid fa-users-slash me-2"></i>
          Nenhum cliente encontrado.
        </td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = lista.map((cliente) => {
        const ativo = cliente.ativo === true || cliente.ativo === undefined;
        const situacao = ativo ? "Ativo" : "Inativo";
        const classeBadge = ativo ? "bg-success" : "bg-secondary";
        const botaoInativar = ativo
            ? `<button class="btn btn-sm btn-outline-warning" onclick="inativarCliente(${cliente.id})" title="Inativar">
                 <i class="fa-solid fa-user-slash"></i>
               </button>`
            : `<button class="btn btn-sm btn-outline-success" onclick="reativarCliente(${cliente.id})" title="Reativar">
                 <i class="fa-solid fa-user-check"></i>
               </button>`;

        return `
    <tr>
      <td>${cliente.nome || "-"}</td>
      <td>${cliente.cpf || "-"}</td>
      <td>${cliente.endereco || "-"}</td>
      <td>
        <span class="badge ${classeBadge}">
          ${situacao}
        </span>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-2" onclick="editarCliente(${cliente.id})" title="Editar">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        ${botaoInativar}
      </td>
    </tr>
  `;
    }).join("");
}

/**
 * Atualiza o número total de clientes exibido na tela.
 */
function atualizarTotalClientes(total) {
    const totalClientesPagina = document.getElementById("totalClientesPagina");
    if (totalClientesPagina) totalClientesPagina.textContent = total;
}

/**
 * Aplica os dois filtros: busca por texto + situação (Ativo/Inativo).
 */
function aplicarFiltros() {
    const termoBusca = document.getElementById("campoBuscaCliente")?.value || "";
    const situacao = document.getElementById("filtroSituacaoCliente")?.value || "";

    let resultado = [...clientes];

    // Filtra por texto (nome, e-mail, CPF, endereço)
    const termo = String(termoBusca).toLowerCase().trim();
    if (termo !== "") {
        resultado = resultado.filter((cliente) => {
            const nome = String(cliente.nome || "").toLowerCase();
            const email = String(cliente.email || "").toLowerCase();
            const cpf = String(cliente.cpf || "").toLowerCase();
            const endereco = String(cliente.endereco || "").toLowerCase();
            return nome.includes(termo) || email.includes(termo) || cpf.includes(termo) || endereco.includes(termo);
        });
    }

    // Filtra por situação
    if (situacao === "ativo") {
        resultado = resultado.filter(c => c.ativo === true || c.ativo === undefined);
    } else if (situacao === "inativo") {
        resultado = resultado.filter(c => c.ativo === false);
    }

    clientesFiltrados = resultado;
    renderizarClientes(clientesFiltrados);
    atualizarTotalClientes(clientesFiltrados.length);
}

/**
 * Filtra clientes (mantida para compatibilidade).
 */
function filtrarClientes(texto) {
    aplicarFiltros();
}

/**
 * Prepara o modal para um novo cliente.
 */
function prepararFormularioNovo() {
    document.getElementById("tituloModalCliente").textContent = "Novo cliente";
    document.getElementById("clienteId").value = "";
    document.getElementById("nomeCliente").value = "";
    document.getElementById("emailCliente").value = "";
    document.getElementById("cpfCliente").value = "";
    document.getElementById("enderecoCliente").value = "";
}

/**
 * Abre o formulário com os dados do cliente para edição.
 */
async function editarCliente(id) {
    try {
        const resposta = await fetch(`${API_BASE}/clientes/${id}`);
        if (!resposta.ok) throw new Error("Cliente não encontrado");
        const cliente = await resposta.json();

        document.getElementById("tituloModalCliente").textContent = "Editar cliente";
        document.getElementById("clienteId").value = cliente.id;
        document.getElementById("nomeCliente").value = cliente.nome || "";
        document.getElementById("emailCliente").value = cliente.email || "";
        document.getElementById("cpfCliente").value = cliente.cpf || "";
        document.getElementById("enderecoCliente").value = cliente.endereco || "";

        modalCliente.show();
    } catch (erro) {
        console.error("Erro ao carregar cliente para edição:", erro);
        Swal.fire({ title: "Erro!", text: "Não foi possível carregar os dados do cliente.", icon: "error" });
    }
}

function validarCPF(cpf) {
    return cpf.replace(/\D/g, "").length === 11;
}

function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cpfDuplicado(cpf, idIgnorar) {
    const cpfLimpo = cpf.replace(/\D/g, "");
    return clientes.some(cliente => {
        const cpfCliente = (cliente.cpf || "").replace(/\D/g, "");
        if (idIgnorar && Number(cliente.id) === Number(idIgnorar)) return false;
        return cpfCliente === cpfLimpo;
    });
}

function emailDuplicado(email, idIgnorar) {
    const emailLimpo = email.toLowerCase().trim();
    return clientes.some(cliente => {
        const emailCliente = (cliente.email || "").toLowerCase().trim();
        if (idIgnorar && Number(cliente.id) === Number(idIgnorar)) return false;
        return emailCliente === emailLimpo;
    });
}

async function salvarCliente(evento) {
    evento.preventDefault();

    const id = document.getElementById("clienteId").value;
    const nome = document.getElementById("nomeCliente").value.trim();
    const email = document.getElementById("emailCliente").value.trim();
    const cpf = document.getElementById("cpfCliente").value.trim();
    const endereco = document.getElementById("enderecoCliente").value.trim();

    if (!nome || !email || !cpf || !endereco) {
        Swal.fire({ title: "Atenção!", text: "Todos os campos são obrigatórios.", icon: "warning" }); return;
    }
    if (!validarCPF(cpf)) {
        Swal.fire({ title: "CPF inválido!", text: "O CPF deve conter exatamente 11 números.", icon: "warning" }); return;
    }
    if (!validarEmail(email)) {
        Swal.fire({ title: "E-mail inválido!", text: "Informe um e-mail no formato correto.", icon: "warning" }); return;
    }
    if (cpfDuplicado(cpf, id)) {
        Swal.fire({ title: "CPF duplicado!", text: "Já existe um cliente com este CPF.", icon: "warning" }); return;
    }
    if (emailDuplicado(email, id)) {
        Swal.fire({ title: "E-mail duplicado!", text: "Já existe um cliente com este e-mail.", icon: "warning" }); return;
    }

    const cliente = { nome, email, cpf, endereco, ativo: id ? undefined : true };
    if (id) delete cliente.ativo;

    const confirmacao = await Swal.fire({
        title: id ? "Confirmar atualização?" : "Confirmar cadastro?",
        text: id ? "Deseja realmente atualizar este cliente?" : "Deseja cadastrar este novo cliente?",
        icon: "question", showCancelButton: true, confirmButtonColor: "#198754", cancelButtonColor: "#6c757d",
        confirmButtonText: "Sim, salvar", cancelButtonText: "Cancelar"
    });
    if (!confirmacao.isConfirmed) return;

    try {
        if (id) {
            await fetch(`${API_BASE}/clientes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cliente) });
        } else {
            await fetch(`${API_BASE}/clientes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cliente) });
        }

        modalCliente.hide();
        await carregarClientes();
        Swal.fire({ title: id ? "Atualizado!" : "Cadastrado!", text: id ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.", icon: "success", timer: 2000, showConfirmButton: false });
    } catch (erro) {
        console.error("Erro ao salvar cliente:", erro);
        Swal.fire({ title: "Erro!", text: "Não foi possível salvar o cliente.", icon: "error" });
    }
}

async function inativarCliente(id) {
    const resultado = await Swal.fire({
        title: "Inativar cliente?", text: "O cliente ficará inativo e não poderá ser selecionado em novos pedidos.",
        icon: "question", showCancelButton: true, confirmButtonColor: "#ffc107", cancelButtonColor: "#6c757d",
        confirmButtonText: "Sim, inativar", cancelButtonText: "Cancelar"
    });
    if (!resultado.isConfirmed) return;

    try {
        await fetch(`${API_BASE}/clientes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: false }) });
        await carregarClientes();
        Swal.fire({ title: "Inativado!", text: "Cliente inativado com sucesso.", icon: "success", timer: 2000, showConfirmButton: false });
    } catch (erro) {
        Swal.fire({ title: "Erro!", text: "Não foi possível inativar o cliente.", icon: "error" });
    }
}

async function reativarCliente(id) {
    const resultado = await Swal.fire({
        title: "Reativar cliente?", text: "O cliente voltará a ficar ativo e poderá ser selecionado em novos pedidos.",
        icon: "question", showCancelButton: true, confirmButtonColor: "#198754", cancelButtonColor: "#6c757d",
        confirmButtonText: "Sim, reativar", cancelButtonText: "Cancelar"
    });
    if (!resultado.isConfirmed) return;

    try {
        await fetch(`${API_BASE}/clientes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: true }) });
        await carregarClientes();
        Swal.fire({ title: "Reativado!", text: "Cliente reativado com sucesso.", icon: "success", timer: 2000, showConfirmButton: false });
    } catch (erro) {
        Swal.fire({ title: "Erro!", text: "Não foi possível reativar o cliente.", icon: "error" });
    }
}