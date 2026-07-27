// js/dashboard.js

const API_BASE = "http://localhost:3000";

// Variáveis globais para armazenar os dados após o carregamento
let todosClientes = [];
let todosProdutos = [];
let todosPedidos = [];
let todosItens = [];

// Variáveis dos gráficos (para destruir antes de recriar)
let graficoStatus = null;
let graficoFaturamentoCategoria = null;

document.addEventListener("DOMContentLoaded", () => {
  carregarDashboard();
  configurarFiltros();
});

/**
 * Configura os eventos de mudança nos filtros (categoria, mês, ano).
 * Qualquer alteração dispara o recálculo de todo o dashboard.
 */
function configurarFiltros() {
  const filtroCategoria = document.getElementById("filtroCategoria");
  const filtroMes = document.getElementById("filtroMes");
  const filtroAno = document.getElementById("filtroAno");

  if (filtroCategoria) filtroCategoria.addEventListener("change", recarregarComFiltros);
  if (filtroMes) filtroMes.addEventListener("change", recarregarComFiltros);
  if (filtroAno) filtroAno.addEventListener("change", recarregarComFiltros);
}

/**
 * Lê os valores atuais dos filtros e atualiza todo o dashboard.
 */
function recarregarComFiltros() {
  const categoria = document.getElementById("filtroCategoria")?.value || "";
  const mes = document.getElementById("filtroMes")?.value || "";
  const ano = document.getElementById("filtroAno")?.value || "";

  const pedidosFiltrados = aplicarFiltroData(todosPedidos, mes, ano);

  // Re-renderiza tudo com os dados filtrados
  renderizarCardsStatus(pedidosFiltrados);
  renderizarFaturamentoTotal(pedidosFiltrados);
  renderizarGraficoStatus(pedidosFiltrados);
  renderizarFaturamentoPorCategoria(categoria, mes, ano);
  renderizarRankingProdutos(categoria, mes, ano);
}

/**
 * Filtra pedidos por mês e ano.
 * Usa o campo "data" ou "dataPedido" do pedido.
 */
function aplicarFiltroData(pedidos, mes, ano) {
  return pedidos.filter(p => {
    const dataPedido = p.data || p.dataPedido;
    if (!dataPedido) return true; // sem data = mostra sempre

    const partes = dataPedido.split("-"); // formato "YYYY-MM-DD"
    const anoPedido = partes[0];
    const mesPedido = partes[1];

    if (ano && anoPedido !== ano) return false;
    if (mes && mesPedido !== mes) return false;
    return true;
  });
}

/**
 * Preenche o select de anos com base nos pedidos existentes.
 */
function preencherAnos() {
  const selectAno = document.getElementById("filtroAno");
  if (!selectAno) return;

  const anos = new Set();
  todosPedidos.forEach(p => {
    const data = p.data || p.dataPedido;
    if (data) {
      const ano = data.split("-")[0];
      if (ano) anos.add(ano);
    }
  });

  const anosOrdenados = [...anos].sort().reverse();

  selectAno.innerHTML = `<option value="">Todos</option>` +
    anosOrdenados.map(ano => `<option value="${ano}">${ano}</option>`).join("");
}

/**
 * Função principal do dashboard.
 * Busca todos os dados e renderiza as seções.
 */
async function carregarDashboard() {
  try {
    mostrarLoading();

    const [clientes, produtos, pedidos, itens] = await Promise.all([
      buscarDados("clientes"),
      buscarDados("produtos"),
      buscarDados("pedidos"),
      buscarDados("itensPedido"),
    ]);

    // Guarda os dados para usar nos filtros depois
    todosClientes = clientes;
    todosProdutos = produtos;
    todosPedidos = pedidos;
    todosItens = itens;

    fecharLoading();

    // Preenche o select de anos dinamicamente
    preencherAnos();

    // Cards de contagem por status
    renderizarCardsStatus(pedidos);

    // Card de faturamento total (apenas entregues)
    renderizarFaturamentoTotal(pedidos);

    // Card de total de clientes
    document.getElementById("totalClientes").textContent = clientes.length;

    // Gráfico de pizza (status)
    renderizarGraficoStatus(pedidos);

    // Gráfico de barras (faturamento por categoria - apenas entregues)
    renderizarFaturamentoPorCategoria("", "", "");

    // Ranking de produtos mais vendidos (entregues + clientes ativos)
    renderizarRankingProdutos("", "", "");

    // Tabela de estoque baixo
    renderizarEstoqueBaixo(produtos);

  } catch (erro) {
    console.error("Erro ao carregar o dashboard:", erro);

    Swal.fire({
      title: "Erro ao carregar dashboard",
      text: "Verifique se o JSON Server está rodando em " + API_BASE,
      icon: "error"
    });
  }
}

/* ================================================================
   CARDS DE STATUS
   ================================================================ */

function renderizarCardsStatus(pedidos) {
  const contagem = {
    "aguardando pagamento": 0,
    "pago": 0,
    "enviado": 0,
    "entregue": 0,
    "cancelado": 0
  };

  pedidos.forEach(pedido => {
    const status = normalizarTexto(pedido.status);
    if (status.includes("aguard")) contagem["aguardando pagamento"]++;
    else if (status.includes("pago") && !status.includes("aguard")) contagem["pago"]++;
    else if (status.includes("enviado") || status.includes("enviar")) contagem["enviado"]++;
    else if (status.includes("entreg")) contagem["entregue"]++;
    else if (status.includes("cancel")) contagem["cancelado"]++;
  });

  document.getElementById("cardAguardando").textContent = contagem["aguardando pagamento"];
  document.getElementById("cardPago").textContent = contagem["pago"];
  document.getElementById("cardEnviado").textContent = contagem["enviado"];
  document.getElementById("cardEntregue").textContent = contagem["entregue"];
  document.getElementById("cardCancelado").textContent = contagem["cancelado"];
}

/* ================================================================
   FATURAMENTO TOTAL (apenas entregues)
   ================================================================ */

function renderizarFaturamentoTotal(pedidos) {
  const total = pedidos
    .filter(p => normalizarTexto(p.status).includes("entreg"))
    .reduce((soma, p) => soma + Number(p.valorTotal || p.total || 0), 0);

  document.getElementById("totalFaturamento").textContent = formatarMoeda(total);
}

/* ================================================================
   FATURAMENTO POR CATEGORIA (gráfico de barras)
   ================================================================ */

function renderizarFaturamentoPorCategoria(categoriaFiltro, mes, ano) {
  const canvas = document.getElementById("graficoFaturamentoCategoria");
  const msgVazio = document.getElementById("msgGraficoCategoriaVazio");
  if (!canvas) return;

  // Aplica filtro de data
  const pedidosFiltrados = aplicarFiltroData(todosPedidos, mes, ano);

  // Pega apenas pedidos entregues
  const pedidosEntregues = pedidosFiltrados.filter(p =>
    normalizarTexto(p.status).includes("entreg")
  );

  const idsEntregues = pedidosEntregues.map(p => String(p.id));

  let itensFiltrados = todosItens.filter(item =>
    idsEntregues.includes(String(item.pedidoId))
  );

  const faturamentoPorCategoria = {};

  itensFiltrados.forEach(item => {
    const produto = todosProdutos.find(p => String(p.id) === String(item.produtoId));
    if (!produto) return;

    const categoria = (produto.categoria || "sem categoria").toLowerCase();
    if (categoriaFiltro && categoria !== categoriaFiltro.toLowerCase()) return;

    const subtotal = Number(item.subtotal) || (Number(item.quantidade) * Number(item.precoUnitario)) || 0;
    faturamentoPorCategoria[categoria] = (faturamentoPorCategoria[categoria] || 0) + subtotal;
  });

  const labels = Object.keys(faturamentoPorCategoria);
  const valores = Object.values(faturamentoPorCategoria);

  if (labels.length === 0) {
    canvas.parentElement.style.display = "none";
    if (msgVazio) msgVazio.classList.remove("d-none");
    if (graficoFaturamentoCategoria) { graficoFaturamentoCategoria.destroy(); graficoFaturamentoCategoria = null; }
    return;
  }

  canvas.parentElement.style.display = "block";
  if (msgVazio) msgVazio.classList.add("d-none");
  if (graficoFaturamentoCategoria) graficoFaturamentoCategoria.destroy();

  const cores = labels.map(cat => {
    if (cat.includes("masculino")) return "#0d6efd";
    if (cat.includes("feminino")) return "#d63384";
    if (cat.includes("infantil")) return "#ffc107";
    if (cat.includes("acess")) return "#198754";
    return "#6c757d";
  });

  graficoFaturamentoCategoria = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [{
        label: "Faturamento (R$)",
        data: valores,
        backgroundColor: cores,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: function(value) { return "R$ " + value.toFixed(0); } }
        }
      }
    }
  });
}

/* ================================================================
   RANKING DE PRODUTOS MAIS VENDIDOS
   ================================================================ */

function renderizarRankingProdutos(categoriaFiltro, mes, ano) {
  const tbody = document.getElementById("tabelaRankingProdutos");
  if (!tbody) return;

  const clientesAtivosIds = todosClientes
    .filter(c => c.ativo === true || c.status === "Ativo")
    .map(c => String(c.id));

  // Aplica filtro de data
  const pedidosFiltrados = aplicarFiltroData(todosPedidos, mes, ano);

  const pedidosValidos = pedidosFiltrados.filter(p => {
    const statusOk = normalizarTexto(p.status).includes("entreg");
    const clienteAtivo = clientesAtivosIds.includes(String(p.clienteId));
    return statusOk && clienteAtivo;
  });

  const idsPedidosValidos = pedidosValidos.map(p => String(p.id));

  let itensFiltrados = todosItens.filter(item =>
    idsPedidosValidos.includes(String(item.pedidoId))
  );

  const ranking = {};

  itensFiltrados.forEach(item => {
    const produto = todosProdutos.find(p => String(p.id) === String(item.produtoId));
    if (!produto) return;

    if (categoriaFiltro && (produto.categoria || "").toLowerCase() !== categoriaFiltro.toLowerCase()) return;

    const produtoId = String(item.produtoId);
    if (!ranking[produtoId]) {
      ranking[produtoId] = {
        nome: produto.nome || "Sem nome",
        categoria: produto.categoria || "-",
        quantidade: 0,
        total: 0
      };
    }

    ranking[produtoId].quantidade += Number(item.quantidade) || 0;
    ranking[produtoId].total += Number(item.subtotal) || (Number(item.quantidade) * Number(item.precoUnitario)) || 0;
  });

  const lista = Object.values(ranking).sort((a, b) => b.total - a.total);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Nenhum dado disponível</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((item, index) => `
    <tr>
      <td><strong>${index + 1}º</strong></td>
      <td>${item.nome}</td>
      <td>${item.categoria}</td>
      <td>${item.quantidade}</td>
      <td>${formatarMoeda(item.total)}</td>
    </tr>
  `).join("");
}

/* ================================================================
   GRÁFICO DE STATUS (pizza)
   ================================================================ */

function renderizarGraficoStatus(pedidos) {
  const canvas = document.getElementById("graficoStatus");
  const msgVazio = document.getElementById("msgGraficoStatusVazio");
  if (!canvas) return;

  if (pedidos.length === 0) {
    canvas.parentElement.style.display = "none";
    if (msgVazio) msgVazio.classList.remove("d-none");
    if (graficoStatus) { graficoStatus.destroy(); graficoStatus = null; }
    return;
  }

  canvas.parentElement.style.display = "block";
  if (msgVazio) msgVazio.classList.add("d-none");

  const contagem = {};
  pedidos.forEach(p => {
    const status = p.status || "Sem status";
    contagem[status] = (contagem[status] || 0) + 1;
  });

  const labels = Object.keys(contagem);
  const valores = Object.values(contagem);
  const cores = labels.map(label => {
    const t = normalizarTexto(label);
    if (t.includes("entreg")) return "#0dcaf0";
    if (t.includes("pago") && !t.includes("aguard")) return "#198754";
    if (t.includes("enviado") || t.includes("enviar")) return "#0d6efd";
    if (t.includes("cancel")) return "#dc3545";
    if (t.includes("aguard")) return "#ffc107";
    return "#6c757d";
  });

  if (graficoStatus) graficoStatus.destroy();

  graficoStatus = new Chart(canvas, {
    type: "pie",
    data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderWidth: 1 }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

/* ================================================================
   ESTOQUE BAIXO
   ================================================================ */

function renderizarEstoqueBaixo(produtos) {
  const tbody = document.getElementById("tabelaEstoqueBaixo");
  if (!tbody) return;

  const lista = produtos
    .map(p => ({ ...p, estoqueAtual: Number(p.estoque ?? 0) }))
    .filter(p => p.estoqueAtual <= 5)
    .sort((a, b) => a.estoqueAtual - b.estoqueAtual)
    .slice(0, 10);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Nenhum dado disponível</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td>${p.nome || "-"}</td>
      <td>${p.categoria || "-"}</td>
      <td><span class="badge bg-danger">${p.estoqueAtual}</span></td>
    </tr>
  `).join("");
}

/* ================================================================
   UTILITÁRIOS
   ================================================================ */

function mostrarLoading() {
  Swal.fire({
    title: "Carregando...",
    text: "Buscando dados do sistema",
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });
}

function fecharLoading() {
  Swal.close();
}

async function buscarDados(endpoint) {
  const resposta = await fetch(`${API_BASE}/${endpoint}`);
  if (!resposta.ok) throw new Error(`Erro ao buscar ${endpoint} (status ${resposta.status})`);
  return resposta.json();
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

function normalizarTexto(texto) {
  return String(texto || "").toLowerCase().trim();
}