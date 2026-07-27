// js/produtos.js

const API_BASE = "http://localhost:3000";

let produtos = [];
let produtosFiltrados = [];
let itensPedido = []; // Para verificar vínculo antes de excluir

const modalProduto = new bootstrap.Modal(document.getElementById("modalProduto"));

document.addEventListener("DOMContentLoaded", () => {
  carregarProdutos();
  configurarEventos();
});

/**
 * Liga os eventos da página.
 */
function configurarEventos() {
  const formProduto = document.getElementById("formProduto");
  const campoBusca = document.getElementById("campoBuscaProduto");
  const filtroEstoque = document.getElementById("filtroEstoqueProduto");
  const btnNovoProduto = document.getElementById("btnNovoProduto");

  formProduto.addEventListener("submit", salvarProduto);

  campoBusca.addEventListener("input", () => {
    aplicarFiltros();
  });

  filtroEstoque.addEventListener("change", () => {
    aplicarFiltros();
  });

  btnNovoProduto.addEventListener("click", () => {
    prepararFormularioNovo();
  });
}

/**
 * Busca todos os produtos e itens de pedido no json-server.
 */
async function carregarProdutos() {
  try {
    const [resProdutos, resItens] = await Promise.all([
      fetch(`${API_BASE}/produtos`),
      fetch(`${API_BASE}/itensPedido`)
    ]);

    if (!resProdutos.ok) throw new Error("Erro ao carregar produtos");

    produtos = await resProdutos.json();
    itensPedido = await resItens.json();
    produtosFiltrados = [...produtos];

    renderizarProdutos(produtosFiltrados);
    atualizarResumo(produtos);
    atualizarTotalExibido(produtosFiltrados.length);
  } catch (erro) {
    console.error("Erro ao carregar produtos:", erro);

    Swal.fire({
      title: "Erro!",
      text: "Não foi possível carregar os produtos.",
      icon: "error"
    });
  }
}

/**
 * Mostra os produtos na tabela.
 */
function renderizarProdutos(lista) {
  const tbody = document.getElementById("tabelaProdutos");

  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          <i class="fa-solid fa-box-open me-2"></i>
          Nenhum produto encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map((produto) => {
    const estoque = Number(produto.estoque ?? 0);

    let badgeEstoque = "";
    if (estoque === 0) {
      badgeEstoque = `<span class="badge bg-danger">Esgotado</span>`;
    } else if (estoque <= 5) {
      badgeEstoque = `<span class="badge bg-warning text-dark">${estoque}</span>`;
    } else {
      badgeEstoque = `<span class="badge bg-success">${estoque}</span>`;
    }

    const estiloLinha = estoque === 0 
      ? 'style="background-color: rgba(255, 130, 130, 0.10) !important;"' 
      : '';

    return `
      <tr ${estiloLinha}>
        <td>${produto.nome || "-"}</td>
        <td>${produto.categoria || "-"}</td>
        <td>${produto.tamanho || "-"}</td>
        <td>${formatarMoeda(produto.preco)}</td>
        <td>${badgeEstoque}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-2" onclick="editarProduto('${produto.id}')" title="Editar">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirProduto('${produto.id}')" title="Excluir">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * Atualiza os indicadores rápidos da página.
 */
function atualizarResumo(lista) {
  const totalProdutosPagina = document.getElementById("totalProdutosPagina");
  const produtosEmEstoque = document.getElementById("produtosEmEstoque");
  const produtosEstoqueBaixo = document.getElementById("produtosEstoqueBaixo");

  const total = lista.length;
  const emEstoque = lista.filter((produto) => Number(produto.estoque ?? 0) > 0).length;
  const baixo = lista.filter((produto) => Number(produto.estoque ?? 0) <= 5).length;

  if (totalProdutosPagina) totalProdutosPagina.textContent = total;
  if (produtosEmEstoque) produtosEmEstoque.textContent = emEstoque;
  if (produtosEstoqueBaixo) produtosEstoqueBaixo.textContent = baixo;
}

/**
 * Atualiza o total exibido após busca.
 */
function atualizarTotalExibido(total) {
  const totalExibidoProdutos = document.getElementById("totalExibidoProdutos");
  if (totalExibidoProdutos) {
    totalExibidoProdutos.textContent = total;
  }
}

/**
 * Aplica os dois filtros ao mesmo tempo: busca por nome + filtro por estoque.
 */
function aplicarFiltros() {
  const termoBusca = document.getElementById("campoBuscaProduto")?.value || "";
  const filtroEstoque = document.getElementById("filtroEstoqueProduto")?.value || "";

  let resultado = [...produtos];

  // Filtra por nome
  const termo = String(termoBusca).toLowerCase().trim();
  if (termo !== "") {
    resultado = resultado.filter((produto) => {
      const nome = String(produto.nome || "").toLowerCase();
      return nome.includes(termo);
    });
  }

  // Filtra por estoque
  if (filtroEstoque === "normal") {
    resultado = resultado.filter(p => Number(p.estoque ?? 0) > 5);
  } else if (filtroEstoque === "critico") {
    resultado = resultado.filter(p => {
      const estoque = Number(p.estoque ?? 0);
      return estoque >= 1 && estoque <= 5;
    });
  } else if (filtroEstoque === "esgotado") {
    resultado = resultado.filter(p => Number(p.estoque ?? 0) === 0);
  }

  produtosFiltrados = resultado;
  renderizarProdutos(produtosFiltrados);
  atualizarResumo(produtosFiltrados);
  atualizarTotalExibido(produtosFiltrados.length);
}

/**
 * Filtra produtos por nome (mantida para compatibilidade).
 */
function filtrarProdutos(texto) {
  aplicarFiltros();
}

/**
 * Prepara o modal para um novo produto.
 */
function prepararFormularioNovo() {
  document.getElementById("tituloModalProduto").textContent = "Novo produto";
  document.getElementById("produtoId").value = "";
  document.getElementById("nomeProduto").value = "";
  document.getElementById("categoriaProduto").value = "";
  document.getElementById("tamanhoProduto").value = "";
  document.getElementById("precoProduto").value = "";
  document.getElementById("estoqueProduto").value = "";
}

/**
 * Abre o formulário com os dados do produto para edição.
 */
async function editarProduto(id) {
  try {
    const resposta = await fetch(`${API_BASE}/produtos/${id}`);

    if (!resposta.ok) {
      throw new Error("Produto não encontrado");
    }

    const produto = await resposta.json();

    document.getElementById("tituloModalProduto").textContent = "Editar produto";
    document.getElementById("produtoId").value = produto.id;
    document.getElementById("nomeProduto").value = produto.nome || "";
    document.getElementById("categoriaProduto").value = produto.categoria || "";
    document.getElementById("tamanhoProduto").value = produto.tamanho || "";
    document.getElementById("precoProduto").value = produto.preco ?? "";
    document.getElementById("estoqueProduto").value = produto.estoque ?? 0;

    modalProduto.show();
  } catch (erro) {
    console.error("Erro ao carregar produto para edição:", erro);

    Swal.fire({
      title: "Erro!",
      text: "Não foi possível carregar os dados do produto.",
      icon: "error"
    });
  }
}

/**
 * Salva produto novo ou atualizado.
 */
async function salvarProduto(evento) {
  evento.preventDefault();

  const id = document.getElementById("produtoId").value;
  const nome = document.getElementById("nomeProduto").value.trim();
  const categoria = document.getElementById("categoriaProduto").value;
  const tamanho = document.getElementById("tamanhoProduto").value;
  const preco = Number(document.getElementById("precoProduto").value);
  const estoque = Number(document.getElementById("estoqueProduto").value);

  if (!nome) {
    Swal.fire({ title: "Atenção!", text: "O nome do produto é obrigatório.", icon: "warning" });
    return;
  }
  if (!categoria) {
    Swal.fire({ title: "Atenção!", text: "Selecione uma categoria.", icon: "warning" });
    return;
  }
  if (!tamanho) {
    Swal.fire({ title: "Atenção!", text: "Selecione um tamanho.", icon: "warning" });
    return;
  }
  if (Number.isNaN(preco) || preco <= 0) {
    Swal.fire({ title: "Atenção!", text: "O preço deve ser um número maior que zero.", icon: "warning" });
    return;
  }
  if (Number.isNaN(estoque) || estoque < 0 || !Number.isInteger(estoque)) {
    Swal.fire({ title: "Atenção!", text: "O estoque deve ser um número inteiro maior ou igual a zero.", icon: "warning" });
    return;
  }

  const produto = { nome, categoria, tamanho, preco, estoque };

  const confirmacao = await Swal.fire({
    title: id ? "Confirmar atualização?" : "Confirmar cadastro?",
    text: id ? "Deseja realmente atualizar este produto?" : "Deseja cadastrar este novo produto?",
    icon: "question", showCancelButton: true, confirmButtonColor: "#198754", cancelButtonColor: "#6c757d",
    confirmButtonText: "Sim, salvar", cancelButtonText: "Cancelar"
  });

  if (!confirmacao.isConfirmed) return;

  try {
    if (id) {
      await fetch(`${API_BASE}/produtos/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(produto)
      });
    } else {
      await fetch(`${API_BASE}/produtos`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(produto)
      });
    }

    modalProduto.hide();
    await carregarProdutos();

    Swal.fire({
      title: id ? "Atualizado!" : "Cadastrado!",
      text: id ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.",
      icon: "success", timer: 2000, showConfirmButton: false
    });
  } catch (erro) {
    console.error("Erro ao salvar produto:", erro);
    Swal.fire({ title: "Erro!", text: "Não foi possível salvar o produto.", icon: "error" });
  }
}

/**
 * Verifica se o produto está vinculado a algum item de pedido.
 */
function produtoTemVinculo(produtoId) {
  return itensPedido.some(item => Number(item.produtoId) === Number(produtoId));
}

/**
 * Exclui um produto, verificando antes se ele está vinculado a algum pedido.
 */
async function excluirProduto(id) {
  if (produtoTemVinculo(id)) {
    Swal.fire({
      title: "Exclusão bloqueada!",
      text: "Este produto não pode ser excluído porque está vinculado a um ou mais pedidos.",
      icon: "error"
    });
    return;
  }

  const resultado = await Swal.fire({
    title: "Tem certeza?",
    text: "Este produto será excluído permanentemente!",
    icon: "warning", showCancelButton: true, confirmButtonColor: "#dc3545", cancelButtonColor: "#6c757d",
    confirmButtonText: "Sim, excluir", cancelButtonText: "Cancelar"
  });

  if (!resultado.isConfirmed) return;

  try {
    await fetch(`${API_BASE}/produtos/${id}`, { method: "DELETE" });
    await carregarProdutos();
    Swal.fire({ title: "Excluído!", text: "Produto removido com sucesso.", icon: "success", timer: 2000, showConfirmButton: false });
  } catch (erro) {
    console.error("Erro ao excluir produto:", erro);
    Swal.fire({ title: "Erro!", text: "Não foi possível excluir o produto.", icon: "error" });
  }
}

/**
 * Formata valores em moeda brasileira.
 */
function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}