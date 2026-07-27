// js/pedidos.js

const API_BASE = "http://localhost:3000";

let pedidos = [];
let clientes = [];
let produtos = [];
let itensPedido = [];
let itensTemp = [];

// Paginação
const ITENS_POR_PAGINA = 10;
let paginaAtual = 1;
let listaFiltrada = [];

const modalPedido = new bootstrap.Modal(document.getElementById("modalPedido"));

document.addEventListener("DOMContentLoaded", () => {
  carregarTudo();
  configurarEventos();
});

/**
 * Liga os eventos da página.
 */
function configurarEventos() {
  const formPedido = document.getElementById("formPedido");
  const campoBusca = document.getElementById("campoBuscaPedido");
  const filtroStatus = document.getElementById("filtroStatusPedido");
  const btnNovoPedido = document.getElementById("btnNovoPedido");
  const btnAdicionarItem = document.getElementById("btnAdicionarItem");
  const produtoSelect = document.getElementById("produtoPedido");

  formPedido.addEventListener("submit", salvarPedido);

  campoBusca.addEventListener("input", () => {
    paginaAtual = 1;
    aplicarFiltros();
  });

  filtroStatus.addEventListener("change", () => {
    paginaAtual = 1;
    aplicarFiltros();
  });

  btnNovoPedido.addEventListener("click", () => {
    prepararFormularioNovo();
  });

  btnAdicionarItem.addEventListener("click", adicionarItemTemp);

  produtoSelect.addEventListener("change", (e) => {
    preencherPrecoProdutoSelecionado(e.target.value);
  });
}

/**
 * Carrega pedidos, clientes, produtos e itens.
 */
async function carregarTudo() {
  try {
    const [resPedidos, resClientes, resProdutos, resItens] = await Promise.all([
      fetch(`${API_BASE}/pedidos`),
      fetch(`${API_BASE}/clientes`),
      fetch(`${API_BASE}/produtos`),
      fetch(`${API_BASE}/itensPedido`)
    ]);

    if (!resPedidos.ok) throw new Error("Erro ao carregar dados");

    pedidos = await resPedidos.json();
    clientes = await resClientes.json();
    produtos = await resProdutos.json();
    itensPedido = await resItens.json();

    listaFiltrada = [...pedidos];
    paginaAtual = 1;

    renderizarPedidos();
    atualizarResumo(pedidos);
    atualizarTotalExibido(pedidos.length);
    preencherSelects();
  } catch (erro) {
    console.error("Erro ao carregar dados dos pedidos:", erro);

    Swal.fire({
      title: "Erro!",
      text: "Não foi possível carregar os dados. Verifique se o servidor está rodando.",
      icon: "error"
    });
  }
}

/**
 * Preenche os selects de cliente (apenas ativos) e produto.
 */
function preencherSelects() {
  const selectCliente = document.getElementById("clientePedido");
  const selectProduto = document.getElementById("produtoPedido");

  // Apenas clientes ativos
  if (selectCliente) {
    const clientesAtivos = clientes.filter(c => c.ativo === true || c.ativo === undefined);
    
    if (clientesAtivos.length === 0) {
      selectCliente.innerHTML = `<option value="">Nenhum cliente ativo cadastrado</option>`;
    } else {
      selectCliente.innerHTML = `<option value="">Selecione um cliente</option>` + clientesAtivos
        .map((cliente) => `<option value="${cliente.id}">${cliente.nome}</option>`)
        .join("");
    }
  }

  // Todos os produtos (apenas com estoque > 0)
  if (selectProduto) {
    const produtosComEstoque = produtos.filter(p => Number(p.estoque ?? 0) > 0);
    
    if (produtosComEstoque.length === 0) {
      selectProduto.innerHTML = `<option value="">Nenhum produto disponível</option>`;
    } else {
      selectProduto.innerHTML = `<option value="">Selecione um produto</option>` + produtosComEstoque
        .map((produto) => `<option value="${produto.id}">${produto.nome} - ${formatarMoeda(produto.preco)} (Estoque: ${produto.estoque})</option>`)
        .join("");
    }
  }
}

/* ================================================================
   RENDERIZAÇÃO DA TABELA COM PAGINAÇÃO
   ================================================================ */

function renderizarPedidos() {
  const tbody = document.getElementById("tabelaPedidos");
  if (!tbody) return;

  if (listaFiltrada.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          <i class="fa-solid fa-receipt me-2"></i>
          Nenhum pedido encontrado.
        </td>
      </tr>
    `;
    document.getElementById("paginacaoPedidos").innerHTML = "";
    document.getElementById("infoPagina").textContent = "";
    return;
  }

  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;
  const pagina = listaFiltrada.slice(inicio, fim);

  document.getElementById("infoPagina").textContent =
    `Exibindo ${inicio + 1} a ${Math.min(fim, listaFiltrada.length)} de ${listaFiltrada.length}`;

  tbody.innerHTML = pagina.map((pedido) => {
    const clienteNome = obterNomeCliente(pedido.clienteId);
    const total = Number(pedido.total || pedido.valorTotal || 0);
    const status = normalizarTexto(pedido.status);

    let botoes = "";

    if (status.includes("aguard")) {
      botoes = `
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarPedido('${pedido.id}')" title="Editar">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn btn-sm btn-outline-success me-1" onclick="avancarStatus('${pedido.id}')" title="Avançar status">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="cancelarPedido('${pedido.id}')" title="Cancelar">
          <i class="fa-solid fa-ban"></i>
        </button>
      `;
    } else if (status.includes("pago") && !status.includes("aguard")) {
      botoes = `
        <button class="btn btn-sm btn-outline-success me-1" onclick="avancarStatus('${pedido.id}')" title="Avançar status">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="cancelarPedido('${pedido.id}')" title="Cancelar">
          <i class="fa-solid fa-ban"></i>
        </button>
      `;
    } else if (status.includes("enviado") || status.includes("enviar")) {
      botoes = `
        <button class="btn btn-sm btn-outline-success" onclick="avancarStatus('${pedido.id}')" title="Avançar status">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;
    } else {
      botoes = `<small class="text-muted">—</small>`;
    }

    return `
      <tr>
        <td>#${pedido.id}</td>
        <td>${clienteNome}</td>
        <td>${formatarData(pedido.data || pedido.dataPedido)}</td>
        <td>
          <span class="badge ${obterClasseStatus(pedido.status)}">
            ${pedido.status || "Sem status"}
          </span>
        </td>
        <td>${formatarMoeda(total)}</td>
        <td class="text-end">
          ${botoes}
        </td>
      </tr>
    `;
  }).join("");

  renderizarPaginacao();
}

function renderizarPaginacao() {
  const container = document.getElementById("paginacaoPedidos");
  if (!container) return;

  const totalPaginas = Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA);
  if (totalPaginas <= 1) { container.innerHTML = ""; return; }

  let html = `<ul class="pagination pagination-sm mb-0">`;
  html += `<li class="page-item ${paginaAtual === 1 ? 'disabled' : ''}"><button class="page-link" onclick="mudarPagina(${paginaAtual - 1})">Anterior</button></li>`;
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<li class="page-item ${i === paginaAtual ? 'active' : ''}"><button class="page-link" onclick="mudarPagina(${i})">${i}</button></li>`;
  }
  html += `<li class="page-item ${paginaAtual === totalPaginas ? 'disabled' : ''}"><button class="page-link" onclick="mudarPagina(${paginaAtual + 1})">Próximo</button></li>`;
  html += `</ul>`;
  container.innerHTML = html;
}

function mudarPagina(numero) {
  const totalPaginas = Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA);
  if (numero < 1 || numero > totalPaginas) return;
  paginaAtual = numero;
  renderizarPedidos();
}

/* ================================================================
   FILTROS E RESUMOS
   ================================================================ */

function atualizarResumo(lista) {
  document.getElementById("totalPedidosPagina").textContent = lista.length;
  document.getElementById("pedidosAguardando").textContent = lista.filter(p => normalizarTexto(p.status).includes("aguard")).length;
  document.getElementById("pedidosPagos").textContent = lista.filter(p => normalizarTexto(p.status).includes("pago") && !normalizarTexto(p.status).includes("aguard")).length;
  document.getElementById("pedidosEntregues").textContent = lista.filter(p => normalizarTexto(p.status).includes("entreg")).length;
}

function atualizarTotalExibido(total) {
  const el = document.getElementById("totalExibidoPedidos");
  if (el) el.textContent = total;
}

/**
 * Aplica os dois filtros ao mesmo tempo: busca por nome + filtro por status.
 */
function aplicarFiltros() {
  const termoBusca = document.getElementById("campoBuscaPedido")?.value || "";
  const statusSelecionado = document.getElementById("filtroStatusPedido")?.value || "";

  let resultado = [...pedidos];

  // Filtra por nome do cliente
  const termo = String(termoBusca).toLowerCase().trim();
  if (termo !== "") {
    resultado = resultado.filter(p =>
      obterNomeCliente(p.clienteId).toLowerCase().includes(termo)
    );
  }

  // Filtra por status
  if (statusSelecionado !== "") {
    resultado = resultado.filter(p =>
      normalizarTexto(p.status).includes(normalizarTexto(statusSelecionado))
    );
  }

  listaFiltrada = resultado;
  renderizarPedidos();
  atualizarResumo(listaFiltrada);
  atualizarTotalExibido(listaFiltrada.length);
}

function filtrarPedidos(texto) {
  // Mantida por compatibilidade, mas agora usa aplicarFiltros()
  aplicarFiltros();
}

/* ================================================================
   FORMULÁRIO (NOVO E EDIÇÃO)
   ================================================================ */

function prepararFormularioNovo() {
  const clientesAtivos = clientes.filter(c => c.ativo === true || c.ativo === undefined);
  if (clientesAtivos.length === 0) {
    Swal.fire({ title: "Atenção!", text: "Não há clientes ativos cadastrados.", icon: "warning" });
    return;
  }
  document.getElementById("tituloModalPedido").textContent = "Novo pedido";
  document.getElementById("pedidoId").value = "";
  document.getElementById("clientePedido").value = "";
  document.getElementById("totalPedido").value = formatarMoeda(0);
  itensTemp = [];
  renderizarItensTemp();
  preencherPrecoProdutoSelecionado("");
  preencherSelects();
}

function adicionarItemTemp() {
  const produtoId = document.getElementById("produtoPedido").value;
  const quantidade = Number(document.getElementById("quantidadePedido").value);

  if (!produtoId) { Swal.fire({ title: "Atenção!", text: "Selecione um produto.", icon: "warning" }); return; }
  if (!quantidade || quantidade < 1 || !Number.isInteger(quantidade)) { Swal.fire({ title: "Atenção!", text: "Quantidade inválida.", icon: "warning" }); return; }

  const produto = produtos.find((item) => String(item.id) === String(produtoId));
  if (!produto) { Swal.fire({ title: "Erro!", text: "Produto não encontrado.", icon: "error" }); return; }

  const estoqueDisponivel = Number(produto.estoque ?? 0);
  const qtdJaAdicionada = itensTemp.filter(item => String(item.produtoId) === String(produtoId)).reduce((soma, item) => soma + Number(item.quantidade), 0);

  if (quantidade + qtdJaAdicionada > estoqueDisponivel) {
    Swal.fire({ title: "Estoque insuficiente!", text: `"${produto.nome}" tem apenas ${estoqueDisponivel} unidade(s).`, icon: "warning" });
    return;
  }

  const itemExistente = itensTemp.find((item) => String(item.produtoId) === String(produtoId));
  if (itemExistente) {
    itemExistente.quantidade += quantidade;
    itemExistente.subtotal = itemExistente.quantidade * itemExistente.precoUnitario;
  } else {
    itensTemp.push({
      produtoId: produtoId,
      nomeProduto: produto.nome,
      quantidade,
      precoUnitario: Number(produto.preco) || 0,
      subtotal: quantidade * (Number(produto.preco) || 0)
    });
  }

  renderizarItensTemp();
  atualizarTotalPedido();
  document.getElementById("produtoPedido").value = "";
  document.getElementById("quantidadePedido").value = 1;
  document.getElementById("precoUnitarioPedido").value = "";
  preencherSelects();
}

function renderizarItensTemp() {
  const tbody = document.getElementById("tabelaItensPedido");
  if (!tbody) return;
  if (itensTemp.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum item adicionado.</td></tr>`;
    return;
  }
  tbody.innerHTML = itensTemp.map((item, index) => `
    <tr>
      <td>${item.nomeProduto}</td>
      <td>${item.quantidade}</td>
      <td>${formatarMoeda(item.precoUnitario)}</td>
      <td>${formatarMoeda(item.subtotal)}</td>
      <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="removerItemTemp(${index})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join("");
}

function removerItemTemp(indice) {
  itensTemp.splice(indice, 1);
  renderizarItensTemp();
  atualizarTotalPedido();
  preencherSelects();
}

function atualizarTotalPedido() {
  const total = itensTemp.reduce((soma, item) => soma + Number(item.subtotal || 0), 0);
  document.getElementById("totalPedido").value = formatarMoeda(total);
}

function preencherPrecoProdutoSelecionado(produtoId) {
  const campo = document.getElementById("precoUnitarioPedido");
  if (!produtoId) { campo.value = ""; return; }
  const produto = produtos.find((item) => String(item.id) === String(produtoId));
  campo.value = produto ? formatarMoeda(produto.preco) : "";
}

async function editarPedido(id) {
  try {
    const pedido = pedidos.find((item) => String(item.id) === String(id));
    if (!pedido) { Swal.fire({ title: "Erro!", text: "Pedido não encontrado.", icon: "error" }); return; }

    if (!normalizarTexto(pedido.status).includes("aguard")) {
      Swal.fire({ title: "Ação não permitida!", text: "Apenas pedidos 'Aguardando pagamento' podem ser editados.", icon: "warning" });
      return;
    }

    const itensDoPedido = itensPedido.filter((item) => String(item.pedidoId) === String(id));

    document.getElementById("tituloModalPedido").textContent = "Editar pedido";
    document.getElementById("pedidoId").value = pedido.id;
    document.getElementById("clientePedido").value = String(pedido.clienteId);

    itensTemp = itensDoPedido.map((item) => {
      const produto = produtos.find((p) => String(p.id) === String(item.produtoId));
      return {
        produtoId: item.produtoId,
        nomeProduto: produto ? produto.nome : "Produto não encontrado",
        quantidade: Number(item.quantidade) || 0,
        precoUnitario: Number(item.precoUnitario) || 0,
        subtotal: Number(item.subtotal) || 0
      };
    });

    renderizarItensTemp();
    atualizarTotalPedido();
    preencherSelects();
    modalPedido.show();
  } catch (erro) {
    console.error("Erro ao carregar pedido para edição:", erro);
    Swal.fire({ title: "Erro!", text: "Não foi possível carregar o pedido.", icon: "error" });
  }
}

/* ================================================================
   SALVAR PEDIDO
   ================================================================ */

async function salvarPedido(evento) {
  evento.preventDefault();

  const id = document.getElementById("pedidoId").value;
  const clienteId = document.getElementById("clientePedido").value;
  const total = itensTemp.reduce((soma, item) => soma + Number(item.subtotal || 0), 0);

  if (!clienteId) { Swal.fire({ title: "Atenção!", text: "Selecione um cliente.", icon: "warning" }); return; }
  if (itensTemp.length === 0) { Swal.fire({ title: "Atenção!", text: "Adicione pelo menos um item.", icon: "warning" }); return; }

  const confirmacao = await Swal.fire({
    title: id ? "Confirmar atualização?" : "Confirmar pedido?",
    text: id ? "Deseja realmente atualizar este pedido?" : "Deseja criar este pedido?",
    icon: "question", showCancelButton: true, confirmButtonColor: "#198754", cancelButtonColor: "#6c757d",
    confirmButtonText: "Sim, salvar", cancelButtonText: "Cancelar"
  });
  if (!confirmacao.isConfirmed) return;

  try {
    if (id) {
      const itensAntigos = itensPedido.filter((item) => String(item.pedidoId) === String(id));
      await ajustarEstoque(itensAntigos, "devolver");
    }

    const pedido = {
      clienteId,
      data: new Date().toISOString().split("T")[0],
      status: id ? (pedidos.find(p => String(p.id) === String(id))?.status || "aguardando pagamento") : "aguardando pagamento",
      total
    };

    let pedidoSalvoId;

    if (id) {
      await fetch(`${API_BASE}/pedidos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido) });
      pedidoSalvoId = id;
      await removerItensDoPedido(id);
    } else {
      const resposta = await fetch(`${API_BASE}/pedidos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido) });
      const pedidoSalvo = await resposta.json();
      pedidoSalvoId = pedidoSalvo.id;
    }

    await salvarItensDoPedido(pedidoSalvoId);
    await ajustarEstoque(itensTemp, "reduzir");

    modalPedido.hide();
    await carregarTudo();

    Swal.fire({ title: id ? "Atualizado!" : "Pedido criado!", text: id ? "Pedido atualizado com sucesso." : "Pedido cadastrado com sucesso.", icon: "success", timer: 2000, showConfirmButton: false });
  } catch (erro) {
    console.error("Erro ao salvar pedido:", erro);
    Swal.fire({ title: "Erro!", text: "Não foi possível salvar o pedido.", icon: "error" });
  }
}

async function salvarItensDoPedido(pedidoId) {
  const promessas = itensTemp.map((item) => {
    return fetch(`${API_BASE}/itensPedido`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedidoId: pedidoId,
        produtoId: item.produtoId,
        nomeProduto: item.nomeProduto,
        quantidade: Number(item.quantidade),
        precoUnitario: Number(item.precoUnitario),
        subtotal: Number(item.subtotal)
      })
    });
  });
  await Promise.all(promessas);
}

async function removerItensDoPedido(pedidoId) {
  const itensParaExcluir = itensPedido.filter((item) => String(item.pedidoId) === String(pedidoId));
  await Promise.all(itensParaExcluir.map(item => fetch(`${API_BASE}/itensPedido/${item.id}`, { method: "DELETE" })));
}

async function ajustarEstoque(itens, acao) {
  const promessas = itens.map(async (item) => {
    const produtoId = item.produtoId;
    const quantidade = Number(item.quantidade);
    const resposta = await fetch(`${API_BASE}/produtos/${produtoId}`);
    if (!resposta.ok) return;
    const produto = await resposta.json();
    const estoqueAtual = Number(produto.estoque ?? 0);
    const novoEstoque = acao === "reduzir" ? Math.max(0, estoqueAtual - quantidade) : estoqueAtual + quantidade;
    return fetch(`${API_BASE}/produtos/${produtoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estoque: novoEstoque }) });
  });
  await Promise.all(promessas);
}

/* ================================================================
   AVANÇAR STATUS
   ================================================================ */

async function avancarStatus(id) {
  const pedido = pedidos.find((item) => String(item.id) === String(id));
  if (!pedido) { Swal.fire({ title: "Erro!", text: "Pedido não encontrado.", icon: "error" }); return; }

  const statusAtual = normalizarTexto(pedido.status);
  let novoStatus = "";
  if (statusAtual.includes("aguard")) novoStatus = "pago";
  else if (statusAtual.includes("pago") && !statusAtual.includes("aguard")) novoStatus = "enviado";
  else if (statusAtual.includes("enviado") || statusAtual.includes("enviar")) novoStatus = "entregue";
  else { Swal.fire({ title: "Ação não permitida!", text: "Este pedido não pode avançar.", icon: "warning" }); return; }

  const confirmacao = await Swal.fire({
    title: "Avançar status?", text: `#${pedido.id} → "${novoStatus}".`, icon: "question",
    showCancelButton: true, confirmButtonColor: "#198754", cancelButtonColor: "#6c757d",
    confirmButtonText: "Avançar", cancelButtonText: "Cancelar"
  });
  if (!confirmacao.isConfirmed) return;

  try {
    await fetch(`${API_BASE}/pedidos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: novoStatus }) });
    await carregarTudo();
    Swal.fire({ title: "Atualizado!", text: `Pedido #${pedido.id} → "${novoStatus}".`, icon: "success", timer: 2000, showConfirmButton: false });
  } catch (erro) {
    Swal.fire({ title: "Erro!", text: "Não foi possível avançar.", icon: "error" });
  }
}

/* ================================================================
   CANCELAR PEDIDO
   ================================================================ */

async function cancelarPedido(id) {
  const pedido = pedidos.find((item) => String(item.id) === String(id));
  if (!pedido) { Swal.fire({ title: "Erro!", text: "Pedido não encontrado.", icon: "error" }); return; }

  const statusAtual = normalizarTexto(pedido.status);
  if (!(statusAtual.includes("aguard") || (statusAtual.includes("pago") && !statusAtual.includes("aguard")))) {
    Swal.fire({ title: "Ação não permitida!", text: "Só 'Aguardando pagamento' ou 'Pago'.", icon: "warning" }); return;
  }

  const confirmacao = await Swal.fire({
    title: "Cancelar pedido?", text: `#${pedido.id} será cancelado e o estoque devolvido.`, icon: "warning",
    showCancelButton: true, confirmButtonColor: "#dc3545", cancelButtonColor: "#6c757d",
    confirmButtonText: "Cancelar pedido", cancelButtonText: "Voltar"
  });
  if (!confirmacao.isConfirmed) return;

  try {
    const itensDoPedido = itensPedido.filter((item) => String(item.pedidoId) === String(id));
    await ajustarEstoque(itensDoPedido, "devolver");
    await fetch(`${API_BASE}/pedidos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelado" }) });
    await carregarTudo();
    Swal.fire({ title: "Cancelado!", text: `Pedido #${pedido.id} cancelado.`, icon: "success", timer: 2500, showConfirmButton: false });
  } catch (erro) {
    Swal.fire({ title: "Erro!", text: "Não foi possível cancelar.", icon: "error" });
  }
}

/* ================================================================
   UTILITÁRIOS
   ================================================================ */

function obterNomeCliente(clienteId) {
  const cliente = clientes.find((item) => String(item.id) === String(clienteId));
  return cliente ? cliente.nome : "Cliente não encontrado";
}

function formatarData(valorData) {
  if (!valorData) return "-";
  const data = new Date(valorData);
  return isNaN(data.getTime()) ? "-" : data.toLocaleDateString("pt-BR");
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

function normalizarTexto(texto) {
  return String(texto || "").toLowerCase().trim();
}

function obterClasseStatus(status) {
  const texto = normalizarTexto(status);
  if (texto.includes("entreg")) return "bg-info text-white";
  if (texto.includes("pago") && !texto.includes("aguard")) return "bg-success text-white";
  if (texto.includes("enviado") || texto.includes("enviar")) return "bg-primary text-white";
  if (texto.includes("cancel")) return "bg-danger text-white";
  if (texto.includes("aguard")) return "bg-warning text-dark";
  return "bg-secondary text-white";
}