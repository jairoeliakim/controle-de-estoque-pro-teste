# Sistema de Gestão & Auditoria de Estoque Gastronômico

Bem-vindo ao sistema de controle e auditoria de estoque para restaurantes, bares e estabelecimentos de alimentação fora do lar. Este guia contém todas as informações essenciais para o **Primeiro Acesso**, orientações sobre **quais acessos criar**, como **vincular o banco de dados relacional** e como o sistema alimenta automaticamente as tabelas do banco de dados.

---

## 1. Credenciais do Primeiro Acesso (Administrador Padrão)

O sistema e os scripts de criação do banco de dados inicializam com um único acesso de superusuário pré-configurado:

| Campo | Valor Padrão |
| :--- | :--- |
| **E-mail / Usuário** | `admin@sistema.com` *(ou simplesmente `admin`)* |
| **Nível de Acesso** | **Administrador do Sistema** |

> 🔒 **Dica de Segurança**: Após efetuar o primeiro acesso e parametrizar o sistema, recomendamos alterar a senha padrão e cadastrar os acessos individuais dos colaboradores de sua equipe.

---

## 2. Roteiro de Implantação e Primeiros Acessos a Criar

Para garantir a governança e o fluxo de trabalho seguro, siga esta ordem recomendada de configuração inicial:

### Passo 1: Vincular o Banco de Dados Relacional
1. Faça login como **Administrador** (`admin@sistema.com` / ).
2. Acesse o menu superior **Configurações do Sistema** (ícone de engrenagem) > **Aba 5: Vincular Banco de Dados**.
3. Selecione o motor do seu banco (**PostgreSQL**, **MySQL** ou **SQL Server**).
4. Informe o Host/IP, Porta, Nome do Banco, Usuário e Senha.
5. Clique em **"Vincular Banco de Dados"** para testar e validar o handshake.
6. Clique em **"Rodar Script & Criar Tabelas"**: o sistema executará as instruções DDL das 15 tabelas e criará a estrutura limpa no seu servidor.

---

### Passo 2: Cadastrar os Colaboradores (Acessos Individuais)
No menu superior do Administrador, acesse **Colaboradores** ou utilize a tela de login na opção **"Criar Acesso Individual"** para cadastrar os seguintes papéis fundamentais:

#### 1. Gerente Geral (`gerente`)
- **Responsabilidade**: Gerenciamento operacional, liberação de contagens fora dos dias padrão, auditoria de perdas e quebras, e aprovação de itens não cadastrados anotados pela equipe.
- **Exemplo de cadastro**:
  - Nome: *Carlos Mendonça*
  - E-mail: *gerente@seurestaurante.com.br*
  - Cargo: **Gerente Geral**
  - PIN/Senha: *Defina a senha do gerente*

#### 2. Setor de Compras (`compras`)
- **Responsabilidade**: Cadastro e homologação de fornecedores, registro de cotações periódicas, emissão de pedidos de reposição e importação de Notas Fiscais (NF-e via chave de 44 dígitos ou QR Code).
- **Exemplo de cadastro**:
  - Nome: *Roberto Almeida*
  - E-mail: *compras@seurestaurante.com.br*
  - Cargo: **Setor de Compras**
  - PIN/Senha: *Defina a senha do comprador*

#### 3. Conferente de Estoque (`conferente`)
- **Responsabilidade**: Contagens físicas periódicas às cegas ou guiadas, apontamento de lotes/validade e anotação de itens encontrados sem cadastro.
- **Barreira de Segurança**: O conferente possui visão restrita à contagem física. Ele **não visualiza** custos de compra, CMV, margens financeiras, faturamento ou parametrizações sistêmicas. Caso tente acessar rotas restritas, uma mensagem de *Acesso Não Permitido* é apresentada.
- **Exemplo de cadastro**:
  - Nome: *Lucas Santos*
  - E-mail: *conferente@seurestaurante.com.br*
  - Cargo: **Conferente de Estoque**
  - PIN/Senha: *Defina a senha do conferente*

---

### Passo 3: Cadastrar Fornecedores e Produtos
1. **Fornecedores**: Acesse o painel de Compras > **Fornecedores** e cadastre seus parceiros com CNPJ, prazos de entrega e dias de validade de preço.
2. **Produtos**: Acesse **Estoque Geral** ou **Catálogo de Itens** > **Novo Item** e cadastre os insumos informando Estoque Mínimo, Ponto de Pedido, Custo Unitário e Categoria (Porcionamento, Petiscos, Carnes, Bebidas, etc.).
3. **Importação via NF-e**: Você também pode importar diretamente o arquivo XML ou chave de 44 dígitos da nota fiscal para cadastrar produtos e fornecedores de forma automatizada.

---

## 3. Alimentação Automática das Rotas do Banco de Dados

Todas as ações e cadastros efetuados no sistema alimentam automaticamente a API backend e a rota correspondente do banco de dados:

| Ação no Sistema | Rota da API Acionada | Tabela Alimentada |
| :--- | :--- | :--- |
| **Cadastro de Produtos** | `POST /api/database/insert/stock_items` | `stock_items` |
| **Cadastro de Funcionários** | `POST /api/database/insert/system_users` | `system_users` |
| **Cadastro de Fornecedores** | `POST /api/database/insert/suppliers` | `suppliers` |
| **Cadastro de Filiais/Empresas** | `POST /api/database/insert/tenants_companies` | `tenants_companies` |
| **Apontamento de Perdas (CMV)** | `POST /api/database/insert/loss_records` | `loss_records` |
| **Sessões de Contagem Física** | `POST /api/database/insert/stock_count_sessions` | `stock_count_sessions` |
| **Pedidos de Compra** | `POST /api/database/insert/purchase_orders` | `purchase_orders` |
| **Importação de NF-e** | `POST /api/database/insert/invoices_history` | `invoices_history` |
| **Itens Avulsos da Contagem** | `POST /api/database/insert/unlisted_count_items` | `unlisted_count_items` |
| **Parâmetros e Regras Globais** | `POST /api/database/insert/system_settings` | `system_settings` |

### Como verificar a alimentação em tempo real:
1. Acesse **Configurações do Sistema** > **Aba 5: Vincular Banco de Dados**.
2. No card inferior **"Alimentação Automática das Rotas do Banco"**, observe o contador de registros e clique no botão **"Logs SQL"**.
3. O sistema exibirá o histórico das instruções SQL (`INSERT`, `UPDATE`, `DELETE`) executadas na linguagem dialetal do motor configurado (**PostgreSQL**, **MySQL** ou **SQL Server**).

---

## 4. Portas e Tecnologias de Banco de Dados Suportadas

O sistema possui geradores nativos de DDL e sintaxes adaptadas para:

- 🐘 **PostgreSQL 14+ / 16+**: Porta padrão `5432` — Suporte a `JSONB`, `NUMERIC(12,3)` e `ON CONFLICT DO UPDATE`.
- 🐬 **MySQL 8.0+ / MariaDB**: Porta padrão `3306` — Engine `InnoDB`, charset `utf8mb4_unicode_ci` e `ON DUPLICATE KEY UPDATE`.
- 🏢 **Microsoft SQL Server 2019+ / 2022+ / Azure SQL**: Porta padrão `1433` — Tipos `NVARCHAR`, `DATETIMEOFFSET` e comandos `IF NOT EXISTS`.

---

## 5. Notificações Automáticas via WhatsApp

Para programar avisos automáticos de contagem para a equipe:
1. Abra o modal de agendamento em **Calendário de Contagem** ou nas **Configurações do Sistema > Aba 2**.
2. Ative a chave **Notificação via WhatsApp**.
3. Preencha o telefone ou número do grupo de estoque com DDD (ex: `5531988887777`).
4. Defina o horário do lembrete (ex: `18:00`) e visualize a mensagem formatada com envio direto via WhatsApp Web / App.

---

© 2026 Sistema de Gestão & Auditoria de Estoque. Todos os direitos reservados.
