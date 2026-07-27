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
  configurarFiltro();
});

/**
 * Configura o evento de mudança no filtro de categoria.
 * Quando o usuário seleciona uma categoria, os cálculos são refeitos.
 */
function configurarFiltro() {
  const filtro = document.getElementById("filtroCategoria");
  if (filtro) {
    filtro.addEventListener("change", () => {
      const categoriaSelecionada = filtro.value;
      // Recalcula tudo com base na categoria escolhida
      renderizarFaturamentoPorCategoria(categoriaSelecionada);
      renderizarRankingProdutos(categoriaSelecionada);
    });
  }
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

    // Guarda os dados para usar no filtro depois
    todosClientes = clientes;
    todosProdutos = produtos;
    todosPedidos = pedidos;
    todosItens = itens;

    fecharLoading();

    // Cards de contagem por status
    renderizarCardsStatus(pedidos);

    // Card de faturamento total (apenas entregues)
    renderizarFaturamentoTotal(pedidos);

    // Card de total de clientes
    document.getElementById("totalClientes").textContent = clientes.length;

    // Gráfico de pizza (status)
    renderizarGraficoStatus(pedidos);

    // Gráfico de barras (faturamento por categoria - apenas entregues)
    renderizarFaturamentoPorCategoria("");

    // Ranking de produtos mais vendidos (entregues + clientes ativos)
    renderizarRankingProdutos("");

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

/**
 * Renderiza os 5 cards com a contagem de pedidos por status.
 * Status esperados: aguardando pagamento, pago, enviado, entregue, cancelado
 */
function renderizarCardsStatus(pedidos) {
  // Inicializa o contador com 0 para cada status
  const contagem = {
    "aguardando pagamento": 0,
    "pago": 0,
    "enviado": 0,
    "entregue": 0,
    "cancelado": 0
  };

  // Conta cada pedido pelo status normalizado
  pedidos.forEach(pedido => {
    const status = normalizarTexto(pedido.status);
    // Mapeia variações para os status padrão
    if (status.includes("aguard")) contagem["aguardando pagamento"]++;
    else if (status.includes("pago") && !status.includes("aguard")) contagem["pago"]++;
    else if (status.includes("enviado") || status.includes("enviar")) contagem["enviado"]++;
    else if (status.includes("entreg")) contagem["entregue"]++;
    else if (status.includes("cancel")) contagem["cancelado"]++;
  });

  // Atualiza os elementos no HTML
  document.getElementById("cardAguardando").textContent = contagem["aguardando pagamento"];
  document.getElementById("cardPago").textContent = contagem["pago"];
  document.getElementById("cardEnviado").textContent = contagem["enviado"];
  document.getElementById("cardEntregue").textContent = contagem["entregue"];
  document.getElementById("cardCancelado").textContent = contagem["cancelado"];
}

/* ================================================================
   FATURAMENTO TOTAL (apenas entregues)
   ================================================================ */

/**
 * Calcula e exibe o faturamento total somando apenas pedidos com status "entregue".
 */
function renderizarFaturamentoTotal(pedidos) {
  const total = pedidos
    .filter(p => normalizarTexto(p.status).includes("entreg"))
    .reduce((soma, p) => soma + Number(p.valorTotal || p.total || 0), 0);

  document.getElementById("totalFaturamento").textContent = formatarMoeda(total);
}

/* ================================================================
   FATURAMENTO POR CATEGORIA (gráfico de barras)
   ================================================================ */

/**
 * Renderiza o gráfico de faturamento por categoria.
 * Considera apenas pedidos com status "entregue".
 * Se uma categoria for passada, filtra os itens por ela.
 */
function renderizarFaturamentoPorCategoria(categoriaFiltro) {
  const canvas = document.getElementById("graficoFaturamentoCategoria");
  const msgVazio = document.getElementById("msgGraficoCategoriaVazio");

  if (!canvas) return;

  // Pega apenas pedidos entregues
  const pedidosEntregues = todosPedidos.filter(p =>
    normalizarTexto(p.status).includes("entreg")
  );

  // Pega os IDs dos pedidos entregues
  const idsEntregues = pedidosEntregues.map(p => Number(p.id));

  // Filtra os itens desses pedidos
  let itensFiltrados = todosItens.filter(item =>
    idsEntregues.includes(Number(item.pedidoId))
  );

  // Mapeia cada item ao seu produto para saber a categoria
  // Agrupa faturamento por categoria do produto
  const faturamentoPorCategoria = {};

  itensFiltrados.forEach(item => {
    const produto = todosProdutos.find(p => Number(p.id) === Number(item.produtoId));
    if (!produto) return;

    const categoria = (produto.categoria || "sem categoria").toLowerCase();

    // Se tem filtro e a categoria não bate, pula
    if (categoriaFiltro && categoria !== categoriaFiltro.toLowerCase()) return;

    const subtotal = Number(item.subtotal) || (Number(item.quantidade) * Number(item.precoUnitario)) || 0;
    faturamentoPorCategoria[categoria] = (faturamentoPorCategoria[categoria] || 0) + subtotal;
  });

  const labels = Object.keys(faturamentoPorCategoria);
  const valores = Object.values(faturamentoPorCategoria);

  // Se não tem dados, mostra mensagem e esconde canvas
  if (labels.length === 0) {
    canvas.parentElement.style.display = "none";
    if (msgVazio) msgVazio.classList.remove("d-none");
    if (graficoFaturamentoCategoria) {
      graficoFaturamentoCategoria.destroy();
      graficoFaturamentoCategoria = null;
    }
    return;
  }

  // Mostra o canvas e esconde a mensagem
  canvas.parentElement.style.display = "block";
  if (msgVazio) msgVazio.classList.add("d-none");

  // Destroi gráfico anterior se existir
  if (graficoFaturamentoCategoria) graficoFaturamentoCategoria.destroy();

  // Cores por categoria
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
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "R$ " + value.toFixed(0);
            }
          }
        }
      }
    }
  });
}

/* ================================================================
   RANKING DE PRODUTOS MAIS VENDIDOS
   ================================================================ */

/**
 * Renderiza a tabela de ranking de produtos mais vendidos.
 * Considera apenas pedidos "entregues" e clientes "ativos".
 * Se uma categoria for passada, filtra por ela.
 */
function renderizarRankingProdutos(categoriaFiltro) {
  const tbody = document.getElementById("tabelaRankingProdutos");
  if (!tbody) return;

  // Clientes ativos (campo "ativo" = true OU campo "status" = "Ativo")
  const clientesAtivosIds = todosClientes
    .filter(c => c.ativo === true || c.status === "Ativo")
    .map(c => String(c.id));

  // Pedidos entregues cujo cliente é ativo
  const pedidosValidos = todosPedidos.filter(p => {
    const statusOk = normalizarTexto(p.status).includes("entreg");
    const clienteAtivo = clientesAtivosIds.includes(String(p.clienteId));
    return statusOk && clienteAtivo;
  });

  const idsPedidosValidos = pedidosValidos.map(p => String(p.id));

  // Itens desses pedidos
  let itensFiltrados = todosItens.filter(item =>
    idsPedidosValidos.includes(String(item.pedidoId))
  );

  // Agrupa por produto, somando quantidade vendida e valor total
  const ranking = {};

  itensFiltrados.forEach(item => {
    const produto = todosProdutos.find(p => String(p.id) === String(item.produtoId));
    if (!produto) return;

    // Se tem filtro de categoria, verifica se o produto bate
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

  // Converte para array e ordena por valor total (maior primeiro)
  const lista = Object.values(ranking).sort((a, b) => b.total - a.total);

  // Se não tem dados
  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          Nenhum dado disponível
        </td>
      </tr>
    `;
    return;
  }

  // Renderiza a tabela
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

/**
 * Renderiza o gráfico de pizza com a distribuição de pedidos por status.
 */
function renderizarGraficoStatus(pedidos) {
  const canvas = document.getElementById("graficoStatus");
  const msgVazio = document.getElementById("msgGraficoStatusVazio");

  if (!canvas) return;

  if (pedidos.length === 0) {
    canvas.parentElement.style.display = "none";
    if (msgVazio) msgVazio.classList.remove("d-none");
    if (graficoStatus) {
      graficoStatus.destroy();
      graficoStatus = null;
    }
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
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: cores,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

/* ================================================================
   ESTOQUE BAIXO
   ================================================================ */

/**
 * Renderiza a tabela de produtos com estoque menor ou igual a 5.
 */
function renderizarEstoqueBaixo(produtos) {
  const tbody = document.getElementById("tabelaEstoqueBaixo");
  if (!tbody) return;

  const lista = produtos
    .map(p => ({
      ...p,
      estoqueAtual: Number(p.estoque ?? 0)
    }))
    .filter(p => p.estoqueAtual <= 5)
    .sort((a, b) => a.estoqueAtual - b.estoqueAtual)
    .slice(0, 10);

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted py-4">
          Nenhum dado disponível
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td>${p.nome || "-"}</td>
      <td>${p.categoria || "-"}</td>
      <td>
        <span class="badge bg-danger">
          ${p.estoqueAtual}
        </span>
      </td>
    </tr>
  `).join("");
}

/* ================================================================
   UTILITÁRIOS
   ================================================================ */

/**
 * Loading com SweetAlert
 */
function mostrarLoading() {
  Swal.fire({
    title: "Carregando...",
    text: "Buscando dados do sistema",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

function fecharLoading() {
  Swal.close();
}

/**
 * Fetch genérico
 */
async function buscarDados(endpoint) {
  const resposta = await fetch(`${API_BASE}/${endpoint}`);

  if (!resposta.ok) {
    throw new Error(`Erro ao buscar ${endpoint} (status ${resposta.status})`);
  }

  return resposta.json();
}

/**
 * Formata moeda brasileira
 */
function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor) || 0);
}

/**
 * Normaliza texto para comparação (minúsculo, sem espaços extras)
 */
function normalizarTexto(texto) {
  return String(texto || "").toLowerCase().trim();
}