# 🛍️ E-Commerce - Sistema de Gestão de Loja de Roupas

Sistema web completo para gerenciamento de uma loja de roupas, desenvolvido como projeto de avaliação do programa **IT Lindos** da empresa **IT Lean**.

---

## 📋 Funcionalidades

### 📊 Dashboard
- Cards de contagem de pedidos por status (aguardando pagamento, pago, enviado, entregue, cancelado)
- Faturamento total considerando apenas pedidos entregues
- Faturamento detalhado por categoria de produto
- Ranking dos produtos mais vendidos (pedidos entregues + clientes ativos)
- Lista de produtos com estoque baixo (≤ 5 unidades)
- Filtro por categoria que recalcula faturamento e ranking
- Gráfico de pizza com distribuição de status
- Gráfico de barras com faturamento por categoria

### 👥 Clientes
- Listagem com nome, CPF, endereço e situação (ativo/inativo)
- Busca por nome, e-mail, CPF ou endereço
- Cadastro e edição com validações
- Máscara de CPF (000.000.000-00)
- Validação de CPF único e e-mail único
- Clientes inativos não podem ser excluídos (apenas inativados/reativados)
- Clientes inativos não aparecem para seleção em novos pedidos

### 👕 Produtos
- Listagem com nome, categoria, tamanho, preço e estoque
- Busca por nome do produto
- Categorias fixas: Masculino, Feminino, Infantil, Acessórios
- Tamanhos fixos: PP, P, M, G, GG, Único
- Destaque visual para produtos esgotados (estoque = 0)
- Validação de estoque (número inteiro ≥ 0)
- Validação de preço (número > 0)
- Bloqueio de exclusão para produtos vinculados a pedidos

### 📦 Pedidos
- Listagem com paginação de 10 registros por página
- Busca por nome do cliente
- Status seguem o ciclo: Aguardando pagamento → Pago → Enviado → Entregue
- Cancelamento permitido apenas nos status Aguardando pagamento ou Pago
- Ao cancelar, o estoque dos produtos é devolvido automaticamente
- Ao criar pedido, o estoque é reduzido automaticamente
- Validação de quantidade (não pode exceder estoque disponível)
- Seleção apenas de clientes ativos
- Preço unitário registrado no momento da adição do item
- Pedidos entregues ou cancelados são somente leitura (sem ações)

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Finalidade |
|------------|------------|
| **HTML5** | Estrutura das páginas |
| **CSS3** | Estilização e responsividade |
| **JavaScript (Vanilla)** | Lógica, manipulação do DOM, fetch API |
| **JSON Server** | API REST mockada (banco de dados local) |
| **Bootstrap 5.3** | Grid, componentes, modais e responsividade |
| **Chart.js** | Gráficos do dashboard (pizza e barras) |
| **SweetAlert2** | Alertas e confirmações visuais |
| **Font Awesome 6** | Ícones em toda a interface |

