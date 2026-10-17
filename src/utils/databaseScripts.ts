export type DatabaseEngine = 'mysql' | 'postgres' | 'sqlserver';

export interface SystemTableDefinition {
  name: string;
  label: string;
  description: string;
  category: 'core' | 'estoque' | 'compras' | 'conferencia' | 'financeiro';
}

export const SYSTEM_TABLES: SystemTableDefinition[] = [
  {
    name: 'tenants_companies',
    label: 'Empresas & Unidades (Multi-Tenant)',
    description: 'Armazena filiais, matrizes e informações de CNPJ com isolamento de dados.',
    category: 'core',
  },
  {
    name: 'system_users',
    label: 'Usuários & Permissões RBAC',
    description: 'Colaboradores, perfis (Administrador, Gerente, Compras, Conferente) e credenciais.',
    category: 'core',
  },
  {
    name: 'system_settings',
    label: 'Parametrização Sistêmica',
    description: 'Políticas de preço desatualizado, calendário de contagem e regras globais.',
    category: 'core',
  },
  {
    name: 'categories',
    label: 'Categorias de Produtos',
    description: 'Porcionamentos, petiscos, insumos de consumo, bebidas, limpeza e descartáveis.',
    category: 'estoque',
  },
  {
    name: 'suppliers',
    label: 'Cadastro de Fornecedores',
    description: 'Fornecedores com CNPJ, prazos de entrega, validade de preços e pedido mínimo.',
    category: 'compras',
  },
  {
    name: 'stock_items',
    label: 'Itens & Saldos de Estoque',
    description: 'Produtos com estoque mínimo, ideal, saldos em tempo real, custos e localização.',
    category: 'estoque',
  },
  {
    name: 'supplier_quotes',
    label: 'Cotações & Preços de Fornecedores',
    description: 'Histórico de cotações por fornecedor com vigência e prazos de validade.',
    category: 'compras',
  },
  {
    name: 'stock_movements',
    label: 'Movimentações de Estoque (Ledger)',
    description: 'Registro imutável de entradas por NF, saídas, quebras e ajustes com auditoria.',
    category: 'estoque',
  },
  {
    name: 'stock_count_sessions',
    label: 'Sessões de Contagem Física',
    description: 'Sessões periódicas abertas pelo conferente com auditoria e aprovação do supervisor.',
    category: 'conferencia',
  },
  {
    name: 'stock_count_entries',
    label: 'Apurações da Contagem Física',
    description: 'Quantidades contadas fisicamente, estoques teóricos anteriores e divergências.',
    category: 'conferencia',
  },
  {
    name: 'unlisted_count_items',
    label: 'Itens Não Cadastrados na Contagem',
    description: 'Produtos avulsos anotados pelo conferente aguardando validação de compras.',
    category: 'conferencia',
  },
  {
    name: 'loss_records',
    label: 'Apontamento de Perdas & CMV',
    description: 'Registros de produtos queimados, vencidos, quebras de garrafa e descarte.',
    category: 'financeiro',
  },
  {
    name: 'purchase_orders',
    label: 'Pedidos de Compra',
    description: 'Ordens de compra enviadas para fornecedores com status, frete e prazos.',
    category: 'compras',
  },
  {
    name: 'purchase_order_items',
    label: 'Itens do Pedido de Compra',
    description: 'Itens, quantidades compradas, custos unitários e conferência de recebimento.',
    category: 'compras',
  },
  {
    name: 'invoices_history',
    label: 'Notas Fiscais de Entrada (NF-e)',
    description: 'Histórico de importação de notas fiscais via chave de 44 dígitos ou QR Code.',
    category: 'compras',
  },
];

export function generateDatabaseScript(engine: DatabaseEngine, databaseName = 'restaurante_estoque_db'): string {
  if (engine === 'postgres') {
    return `-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DO SISTEMA - POSTGRESQL 13+
-- Banco de Dados Alvo: ${databaseName}
-- Gerado automaticamente pelo Assistente de Parametrização Sistêmica
-- ==============================================================================

-- 1. EMPRESAS & TENANTS (Tenant identificado pelo CNPJ sem traços)
CREATE TABLE IF NOT EXISTS tenants_companies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20) NOT NULL,
    pais_origem VARCHAR(2) DEFAULT 'BR',
    tipo_documento VARCHAR(20) DEFAULT 'CNPJ',
    documento_identificador VARCHAR(35),
    city VARCHAR(100),
    state VARCHAR(2),
    phone VARCHAR(30),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USUÁRIOS DO SISTEMA (RBAC)
CREATE TABLE IF NOT EXISTS system_users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('administrador', 'gerente', 'compras', 'conferente')),
    phone VARCHAR(30),
    pin VARCHAR(40),
    is_active BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) DEFAULT 'ativo',
    matricula VARCHAR(50),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email)
);

-- Garante tamanho e novas colunas em bancos criados anteriormente
ALTER TABLE system_users ALTER COLUMN pin TYPE VARCHAR(40);
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ativo';
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS matricula VARCHAR(50);

-- 3. PARAMETRIZAÇÃO SISTÊMICA & POLÍTICAS
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    outdated_price_policy VARCHAR(30) DEFAULT 'alertar' CHECK (outdated_price_policy IN ('bloquear', 'alertar', 'exigir_aprovacao')),
    default_price_validity_days INTEGER DEFAULT 30,
    notify_outdated_prices BOOLEAN DEFAULT TRUE,
    block_orders_below_min_supplier_value BOOLEAN DEFAULT FALSE,
    count_days JSONB DEFAULT '["quarta", "domingo"]'::jsonb,
    count_cutoff_time VARCHAR(10) DEFAULT '23:59',
    require_supervisor_auth_for_off_days BOOLEAN DEFAULT TRUE,
    divergence_tolerance_percent NUMERIC(5, 2) DEFAULT 3.0,
    blind_count_mode BOOLEAN DEFAULT FALSE,
    require_individual_login BOOLEAN DEFAULT TRUE,
    conferente_can_view_prices BOOLEAN DEFAULT FALSE,
    allow_conferente_register_unlisted BOOLEAN DEFAULT TRUE,
    target_cmv_percent NUMERIC(5, 2) DEFAULT 28.5,
    whatsapp_notification BOOLEAN DEFAULT FALSE,
    whatsapp_phone VARCHAR(50),
    whatsapp_reminder_time VARCHAR(10) DEFAULT '08:00',
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_settings_tenant UNIQUE (tenant_id)
);

-- 4. CATEGORIAS DE ITENS
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_categories_tenant_name UNIQUE (tenant_id, name)
);

-- 5. FORNECEDORES (Com modelagem globalizada de empresas)
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20),
    pais_origem VARCHAR(2) DEFAULT 'BR',
    tipo_documento VARCHAR(20) DEFAULT 'CNPJ',
    documento_identificador VARCHAR(35),
    contact_name VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(255),
    price_update_interval_days INTEGER DEFAULT 30,
    min_order_value NUMERIC(12, 2) DEFAULT 0.00,
    last_price_update_date TIMESTAMP WITH TIME ZONE,
    rating NUMERIC(3, 1) DEFAULT 5.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. ITENS DE ESTOQUE
CREATE TABLE IF NOT EXISTS stock_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    category_id VARCHAR(64) REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (current_stock >= 0),
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    ideal_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    unit VARCHAR(20) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    target_cmv NUMERIC(5, 2) DEFAULT 28.5,
    primary_supplier_id VARCHAR(64) REFERENCES suppliers(id) ON DELETE SET NULL,
    count_days JSONB DEFAULT '["quarta", "domingo"]'::jsonb,
    location VARCHAR(100),
    current_batch_expiry DATE,
    barcode VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_items_tenant ON stock_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(tenant_id, barcode);

-- 7. COTAÇÕES DE FORNECEDORES
CREATE TABLE IF NOT EXISTS supplier_quotes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA')),
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    previous_stock NUMERIC(12, 3) NOT NULL,
    new_stock NUMERIC(12, 3) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. SESSÕES DE CONTAGEM FÍSICA
CREATE TABLE IF NOT EXISTS stock_count_sessions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    conducted_by VARCHAR(255) NOT NULL,
    user_role VARCHAR(30) NOT NULL,
    day_of_week VARCHAR(30) NOT NULL,
    total_items_counted INTEGER DEFAULT 0,
    divergent_items_count INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'aprovada')),
    supervisor_authorized BOOLEAN DEFAULT FALSE,
    supervisor_name VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. ITENS CONFERIDOS NA SESSÃO DE CONTAGEM
CREATE TABLE IF NOT EXISTS stock_count_entries (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES stock_count_sessions(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    counted_stock NUMERIC(12, 3) NOT NULL,
    previous_stock NUMERIC(12, 3) NOT NULL,
    expiry_date DATE,
    observations TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'baixo', 'critico', 'sobra'))
);

-- 11. ITENS AVULSOS NÃO CADASTRADOS (APONTADOS NA CONTAGEM)
CREATE TABLE IF NOT EXISTS unlisted_count_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    expiry_date DATE,
    location VARCHAR(100),
    observations TEXT,
    recorded_by VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- 12. REGISTROS DE PERDAS & DESCARTE (CMV)
CREATE TABLE IF NOT EXISTS loss_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('queimou', 'venceu', 'derrubado_danificado', 'erro_preparo', 'descongelamento_inadequado', 'contaminacao', 'sobra_descarte', 'outro')),
    sector VARCHAR(50) NOT NULL,
    reported_by VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. PEDIDOS DE COMPRA
CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_name VARCHAR(255) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    items_count INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'aprovado', 'entregue', 'cancelado')),
    channel VARCHAR(30) DEFAULT 'direto',
    payment_terms VARCHAR(100),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- 14. ITENS DO PEDIDO DE COMPRA
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
    item_name VARCHAR(255) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quantity_ordered NUMERIC(12, 3) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL,
    received_quantity NUMERIC(12, 3) DEFAULT 0.000
);

-- 15. NOTAS FISCAIS IMPORTADAS (NF-E)
CREATE TABLE IF NOT EXISTS invoices_history (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    access_key VARCHAR(50) NOT NULL,
    number VARCHAR(50) NOT NULL,
    series VARCHAR(10),
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
    supplier_cnpj VARCHAR(20) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    total_invoice_value NUMERIC(12, 2) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('chave', 'qrcode', 'xml', 'digitada')),
    status VARCHAR(20) NOT NULL DEFAULT 'efetivado',
    linked_order_id VARCHAR(64) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    imported_by VARCHAR(255),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_access_key ON invoices_history(tenant_id, access_key);

-- ==============================================================================
-- 16. CARGA INICIAL: EMPRESA MATRIZ & USUÁRIO ADMINISTRADOR PADRÃO
-- Senha Inicial de Primeiro Acesso: ******
-- ==============================================================================
INSERT INTO tenants_companies (id, name, trade_name, cnpj, pais_origem, tipo_documento, documento_identificador, city, state, phone, email, is_active)
VALUES ('00000000000001', 'CEC Conecta', 'CEC', '00.000.000/0000-00', 'BR', 'CNPJ', '00000000000001', 'Patrocinio', 'MG', '(34)99947-2865', 'jairoeliakim@hotmail.com', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants_companies (id, name, trade_name, cnpj, pais_origem, tipo_documento, documento_identificador, city, state, phone, email, is_active)
VALUES ('comp-matriz', 'CEC Conecta', 'CEC', '00.000.000/0000-00', 'BR', 'CNPJ', '00000000000001', 'Patrocinio', 'MG', '(34)99947-2865', 'jairoeliakim@hotmail.com', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO system_users (id, tenant_id, name, email, password_hash, role, phone, pin, is_active)
VALUES ('usr-admin-01', '00000000000001', 'Administrador do Sistema', 'admin@sistema.com', 'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', 'administrador', '(31)99947-2865', '[PROTEGIDO]', TRUE)
ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash, pin = EXCLUDED.pin;

INSERT INTO system_users (id, tenant_id, name, email, password_hash, role, phone, pin, is_active)
VALUES ('usr-admin-alias', '00000000000001', 'Administrador do Sistema', 'admin', 'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', 'administrador', '(31)99947-2865', '[PROTEGIDO]', TRUE)
ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash, pin = EXCLUDED.pin;`;
  }

  if (engine === 'mysql') {
    return `-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DO SISTEMA - MYSQL 8.0+
-- Banco de Dados Alvo: ${databaseName}
-- Gerado automaticamente pelo Assistente de Parametrização Sistêmica
-- ==============================================================================

-- 1. EMPRESAS & TENANTS (Tenant identificado pelo CNPJ sem traços)
CREATE TABLE IF NOT EXISTS tenants_companies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20) NOT NULL,
    pais_origem VARCHAR(2) DEFAULT 'BR',
    tipo_documento VARCHAR(20) DEFAULT 'CNPJ',
    documento_identificador VARCHAR(35),
    city VARCHAR(100),
    state VARCHAR(2),
    phone VARCHAR(30),
    email VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USUÁRIOS DO SISTEMA (RBAC)
CREATE TABLE IF NOT EXISTS system_users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    phone VARCHAR(30),
    pin VARCHAR(40),
    is_active TINYINT(1) DEFAULT 1,
    status VARCHAR(30) DEFAULT 'ativo',
    matricula VARCHAR(50),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_tenant_email (tenant_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. PARAMETRIZAÇÃO SISTÊMICA & POLÍTICAS
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    outdated_price_policy VARCHAR(30) DEFAULT 'alertar',
    default_price_validity_days INT DEFAULT 30,
    notify_outdated_prices TINYINT(1) DEFAULT 1,
    block_orders_below_min_supplier_value TINYINT(1) DEFAULT 0,
    count_days JSON,
    count_cutoff_time VARCHAR(10) DEFAULT '23:59',
    require_supervisor_auth_for_off_days TINYINT(1) DEFAULT 1,
    divergence_tolerance_percent DECIMAL(5, 2) DEFAULT 3.00,
    blind_count_mode TINYINT(1) DEFAULT 0,
    require_individual_login TINYINT(1) DEFAULT 1,
    conferente_can_view_prices TINYINT(1) DEFAULT 0,
    allow_conferente_register_unlisted TINYINT(1) DEFAULT 1,
    target_cmv_percent DECIMAL(5, 2) DEFAULT 28.50,
    whatsapp_notification TINYINT(1) DEFAULT 0,
    whatsapp_phone VARCHAR(50),
    whatsapp_reminder_time VARCHAR(10) DEFAULT '08:00',
    updated_by VARCHAR(255),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_settings_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CATEGORIAS DE ITENS
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_cat_tenant_name (tenant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. FORNECEDORES (Com modelagem globalizada de empresas)
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20),
    pais_origem VARCHAR(2) DEFAULT 'BR',
    tipo_documento VARCHAR(20) DEFAULT 'CNPJ',
    documento_identificador VARCHAR(35),
    contact_name VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(255),
    price_update_interval_days INT DEFAULT 30,
    min_order_value DECIMAL(12, 2) DEFAULT 0.00,
    last_price_update_date DATETIME,
    rating DECIMAL(3, 1) DEFAULT 5.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sup_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ITENS DE ESTOQUE
CREATE TABLE IF NOT EXISTS stock_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    category_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    min_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    ideal_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    target_cmv DECIMAL(5, 2) DEFAULT 28.50,
    primary_supplier_id VARCHAR(64),
    count_days JSON,
    location VARCHAR(100),
    current_batch_expiry DATE,
    barcode VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_supplier FOREIGN KEY (primary_supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    INDEX idx_items_barcode (tenant_id, barcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. COTAÇÕES DE FORNECEDORES
CREATE TABLE IF NOT EXISTS supplier_quotes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    supplier_id VARCHAR(64) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    is_primary TINYINT(1) DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quote_item FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    type VARCHAR(20) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    previous_stock DECIMAL(12, 3) NOT NULL,
    new_stock DECIMAL(12, 3) NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mov_item FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. SESSÕES DE CONTAGEM FÍSICA
CREATE TABLE IF NOT EXISTS stock_count_sessions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    conducted_by VARCHAR(255) NOT NULL,
    user_role VARCHAR(30) NOT NULL,
    day_of_week VARCHAR(30) NOT NULL,
    total_items_counted INT DEFAULT 0,
    divergent_items_count INT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    supervisor_authorized TINYINT(1) DEFAULT 0,
    supervisor_name VARCHAR(255),
    submitted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_count_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. ITENS CONFERIDOS NA CONTAGEM
CREATE TABLE IF NOT EXISTS stock_count_entries (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    counted_stock DECIMAL(12, 3) NOT NULL,
    previous_stock DECIMAL(12, 3) NOT NULL,
    expiry_date DATE,
    observations TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ok',
    CONSTRAINT fk_entry_session FOREIGN KEY (session_id) REFERENCES stock_count_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_entry_item FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. ITENS AVULSOS NÃO CADASTRADOS
CREATE TABLE IF NOT EXISTS unlisted_count_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    expiry_date DATE,
    location VARCHAR(100),
    observations TEXT,
    recorded_by VARCHAR(255) NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    approved_by VARCHAR(255),
    approved_at DATETIME,
    CONSTRAINT fk_unlisted_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. REGISTROS DE PERDAS & DESCARTE (CMV)
CREATE TABLE IF NOT EXISTS loss_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    sector VARCHAR(50) NOT NULL,
    reported_by VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loss_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_loss_item FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. PEDIDOS DE COMPRA
CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id VARCHAR(64) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    items_count INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    channel VARCHAR(30) DEFAULT 'direto',
    payment_terms VARCHAR(100),
    created_by VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    CONSTRAINT fk_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. ITENS DO PEDIDO DE COMPRA
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quantity_ordered DECIMAL(12, 3) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    received_quantity DECIMAL(12, 3) DEFAULT 0.000,
    CONSTRAINT fk_poi_order FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_item FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. NOTAS FISCAIS IMPORTADAS
CREATE TABLE IF NOT EXISTS invoices_history (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    access_key VARCHAR(50) NOT NULL,
    number VARCHAR(50) NOT NULL,
    series VARCHAR(10),
    issue_date DATETIME NOT NULL,
    supplier_cnpj VARCHAR(20) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    total_invoice_value DECIMAL(12, 2) NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'efetivado',
    linked_order_id VARCHAR(64),
    imported_by VARCHAR(255),
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_tenant FOREIGN KEY (tenant_id) REFERENCES tenants_companies(id) ON DELETE CASCADE,
    INDEX idx_inv_key (tenant_id, access_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 16. CARGA INICIAL: EMPRESA MATRIZ & USUÁRIO ADMINISTRADOR PADRÃO
-- Senha Inicial de Primeiro Acesso: ******
-- ==============================================================================
INSERT IGNORE INTO tenants_companies (id, name, trade_name, cnpj, pais_origem, tipo_documento, documento_identificador, city, state, phone, email, is_active)
VALUES ('00000000000001', 'CEC Conecta', 'CEC', '00.000.000/0000-00', 'BR', 'CNPJ', '00000000000001', 'Patrocinio', 'MG', '(34)99947-2865', 'jairoeliakim@hotmail.com', 1);

INSERT IGNORE INTO tenants_companies (id, name, trade_name, cnpj, pais_origem, tipo_documento, documento_identificador, city, state, phone, email, is_active)
VALUES ('comp-matriz', 'CEC Conecta', 'CEC', '00.000.000/0000-00', 'BR', 'CNPJ', '00000000000001', 'Patrocinio', 'MG', '(34)99947-2865', 'jairoeliakim@hotmail.com', 1);

INSERT INTO system_users (id, tenant_id, name, email, password_hash, role, phone, pin, is_active)
VALUES ('usr-admin-01', '00000000000001', 'Administrador do Sistema', 'admin@sistema.com', 'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', 'administrador', '(31)99947-2865', '[PROTEGIDO]', 1)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), pin = VALUES(pin);

INSERT INTO system_users (id, tenant_id, name, email, password_hash, role, phone, pin, is_active)
VALUES ('usr-admin-alias', '00000000000001', 'Administrador do Sistema', 'admin', 'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', 'administrador', '(31)99947-2865', '[PROTEGIDO]', 1)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), pin = VALUES(pin);`;
  }

  // Engine: sqlserver
  return `-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DO SISTEMA - MICROSOFT SQL SERVER 2017+
-- Banco de Dados Alvo: ${databaseName}
-- Gerado automaticamente pelo Assistente de Parametrização Sistêmica
-- ==============================================================================

-- 1. EMPRESAS & TENANTS (Tenant identificado pelo CNPJ sem traços)
IF OBJECT_ID('dbo.tenants_companies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tenants_companies (
        id NVARCHAR(64) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        trade_name NVARCHAR(255),
        cnpj NVARCHAR(20) NOT NULL,
        pais_origem NVARCHAR(2) DEFAULT 'BR',
        tipo_documento NVARCHAR(20) DEFAULT 'CNPJ',
        documento_identificador NVARCHAR(35),
        city NVARCHAR(100),
        state NVARCHAR(2),
        phone NVARCHAR(30),
        email NVARCHAR(255),
        is_active BIT DEFAULT 1,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- 2. USUÁRIOS DO SISTEMA (RBAC)
IF OBJECT_ID('dbo.system_users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.system_users (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(30) NOT NULL,
        phone NVARCHAR(30),
        pin NVARCHAR(40),
        is_active BIT DEFAULT 1,
        status NVARCHAR(30) DEFAULT N'ativo',
        matricula NVARCHAR(50),
        last_login DATETIMEOFFSET,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email)
    );
END;

-- 3. PARAMETRIZAÇÃO SISTÊMICA & POLÍTICAS
IF OBJECT_ID('dbo.system_settings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.system_settings (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        outdated_price_policy NVARCHAR(30) DEFAULT 'alertar',
        default_price_validity_days INT DEFAULT 30,
        notify_outdated_prices BIT DEFAULT 1,
        block_orders_below_min_supplier_value BIT DEFAULT 0,
        count_days NVARCHAR(MAX),
        count_cutoff_time NVARCHAR(10) DEFAULT '23:59',
        require_supervisor_auth_for_off_days BIT DEFAULT 1,
        divergence_tolerance_percent DECIMAL(5, 2) DEFAULT 3.00,
        blind_count_mode BIT DEFAULT 0,
        require_individual_login BIT DEFAULT 1,
        conferente_can_view_prices BIT DEFAULT 0,
        allow_conferente_register_unlisted BIT DEFAULT 1,
        target_cmv_percent DECIMAL(5, 2) DEFAULT 28.50,
        whatsapp_notification BIT DEFAULT 0,
        whatsapp_phone NVARCHAR(50),
        whatsapp_reminder_time NVARCHAR(10) DEFAULT '08:00',
        updated_by NVARCHAR(255),
        updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT uq_settings_tenant UNIQUE (tenant_id)
    );
END;

-- 4. CATEGORIAS DE ITENS
IF OBJECT_ID('dbo.categories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(MAX),
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT uq_categories_tenant_name UNIQUE (tenant_id, name)
    );
END;

-- 5. FORNECEDORES (Com modelagem globalizada de empresas)
IF OBJECT_ID('dbo.suppliers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.suppliers (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        name NVARCHAR(255) NOT NULL,
        trade_name NVARCHAR(255),
        cnpj NVARCHAR(20),
        pais_origem NVARCHAR(2) DEFAULT 'BR',
        tipo_documento NVARCHAR(20) DEFAULT 'CNPJ',
        documento_identificador NVARCHAR(35),
        contact_name NVARCHAR(150),
        phone NVARCHAR(30),
        email NVARCHAR(255),
        price_update_interval_days INT DEFAULT 30,
        min_order_value DECIMAL(12, 2) DEFAULT 0.00,
        last_price_update_date DATETIMEOFFSET,
        rating DECIMAL(3, 1) DEFAULT 5.0,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- 6. ITENS DE ESTOQUE
IF OBJECT_ID('dbo.stock_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stock_items (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        category_id NVARCHAR(64) FOREIGN KEY REFERENCES dbo.categories(id),
        name NVARCHAR(255) NOT NULL,
        category NVARCHAR(50) NOT NULL,
        current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
        min_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
        ideal_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
        unit NVARCHAR(20) NOT NULL,
        unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        target_cmv DECIMAL(5, 2) DEFAULT 28.50,
        primary_supplier_id NVARCHAR(64) FOREIGN KEY REFERENCES dbo.suppliers(id),
        count_days NVARCHAR(MAX),
        location NVARCHAR(100),
        current_batch_expiry DATE,
        barcode NVARCHAR(64),
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
    CREATE NONCLUSTERED INDEX idx_stock_items_barcode ON dbo.stock_items(tenant_id, barcode);
END;

-- 7. COTAÇÕES DE FORNECEDORES
IF OBJECT_ID('dbo.supplier_quotes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_quotes (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        item_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.stock_items(id) ON DELETE CASCADE,
        supplier_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.suppliers(id) ON DELETE CASCADE,
        price DECIMAL(12, 2) NOT NULL,
        is_primary BIT DEFAULT 0,
        last_updated DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- 8. MOVIMENTAÇÕES DE ESTOQUE
IF OBJECT_ID('dbo.stock_movements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stock_movements (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        item_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.stock_items(id) ON DELETE CASCADE,
        user_id NVARCHAR(64) FOREIGN KEY REFERENCES dbo.system_users(id),
        type NVARCHAR(20) NOT NULL,
        quantity DECIMAL(12, 3) NOT NULL,
        previous_stock DECIMAL(12, 3) NOT NULL,
        new_stock DECIMAL(12, 3) NOT NULL,
        reason NVARCHAR(MAX),
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- 9. SESSÕES DE CONTAGEM FÍSICA
IF OBJECT_ID('dbo.stock_count_sessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stock_count_sessions (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        conducted_by NVARCHAR(255) NOT NULL,
        user_role NVARCHAR(30) NOT NULL,
        day_of_week NVARCHAR(30) NOT NULL,
        total_items_counted INT DEFAULT 0,
        divergent_items_count INT DEFAULT 0,
        status NVARCHAR(30) NOT NULL DEFAULT 'rascunho',
        supervisor_authorized BIT DEFAULT 0,
        supervisor_name NVARCHAR(255),
        submitted_at DATETIMEOFFSET,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- 10. ITENS CONFERIDOS NA CONTAGEM
IF OBJECT_ID('dbo.stock_count_entries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stock_count_entries (
        id NVARCHAR(64) PRIMARY KEY,
        session_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.stock_count_sessions(id) ON DELETE CASCADE,
        item_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.stock_items(id) ON DELETE CASCADE,
        counted_stock DECIMAL(12, 3) NOT NULL,
        previous_stock DECIMAL(12, 3) NOT NULL,
        expiry_date DATE,
        observations NVARCHAR(MAX),
        status NVARCHAR(20) NOT NULL DEFAULT 'ok'
    );
END;

-- 11. ITENS AVULSOS NÃO CADASTRADOS
IF OBJECT_ID('dbo.unlisted_count_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.unlisted_count_items (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        name NVARCHAR(255) NOT NULL,
        category NVARCHAR(50) NOT NULL,
        quantity DECIMAL(12, 3) NOT NULL,
        unit NVARCHAR(20) NOT NULL,
        expiry_date DATE,
        location NVARCHAR(100),
        observations NVARCHAR(MAX),
        recorded_by NVARCHAR(255) NOT NULL,
        recorded_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        status NVARCHAR(20) NOT NULL DEFAULT 'pendente',
        approved_by NVARCHAR(255),
        approved_at DATETIMEOFFSET
    );
END;

-- 12. REGISTROS DE PERDAS & DESCARTE (CMV)
IF OBJECT_ID('dbo.loss_records', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.loss_records (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        item_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.stock_items(id) ON DELETE CASCADE,
        item_name NVARCHAR(255) NOT NULL,
        category NVARCHAR(50) NOT NULL,
        quantity DECIMAL(12, 3) NOT NULL,
        unit NVARCHAR(20) NOT NULL,
        unit_cost DECIMAL(12, 2) NOT NULL,
        total_cost DECIMAL(12, 2) NOT NULL,
        reason NVARCHAR(50) NOT NULL,
        sector NVARCHAR(50) NOT NULL,
        reported_by NVARCHAR(255) NOT NULL,
        notes NVARCHAR(MAX),
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- 13. PEDIDOS DE COMPRA
IF OBJECT_ID('dbo.purchase_orders', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchase_orders (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        order_number NVARCHAR(50) NOT NULL UNIQUE,
        supplier_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.suppliers(id),
        supplier_name NVARCHAR(255) NOT NULL,
        total_amount DECIMAL(12, 2) NOT NULL,
        items_count INT NOT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'pendente',
        channel NVARCHAR(30) DEFAULT 'direto',
        payment_terms NVARCHAR(100),
        created_by NVARCHAR(255) NOT NULL,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        sent_at DATETIMEOFFSET
    );
END;

-- 14. ITENS DO PEDIDO DE COMPRA
IF OBJECT_ID('dbo.purchase_order_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchase_order_items (
        id NVARCHAR(64) PRIMARY KEY,
        order_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.purchase_orders(id) ON DELETE CASCADE,
        item_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.stock_items(id),
        item_name NVARCHAR(255) NOT NULL,
        unit NVARCHAR(20) NOT NULL,
        quantity_ordered DECIMAL(12, 3) NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_cost DECIMAL(12, 2) NOT NULL,
        received_quantity DECIMAL(12, 3) DEFAULT 0.000
    );
END;

-- 15. NOTAS FISCAIS IMPORTADAS
IF OBJECT_ID('dbo.invoices_history', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.invoices_history (
        id NVARCHAR(64) PRIMARY KEY,
        tenant_id NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.tenants_companies(id) ON DELETE CASCADE,
        access_key NVARCHAR(50) NOT NULL,
        number NVARCHAR(50) NOT NULL,
        series NVARCHAR(10),
        issue_date DATETIMEOFFSET NOT NULL,
        supplier_cnpj NVARCHAR(20) NOT NULL,
        supplier_name NVARCHAR(255) NOT NULL,
        total_invoice_value DECIMAL(12, 2) NOT NULL,
        source_type NVARCHAR(20) NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'efetivado',
        linked_order_id NVARCHAR(64),
        imported_by NVARCHAR(255),
        imported_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
    CREATE NONCLUSTERED INDEX idx_inv_key ON dbo.invoices_history(tenant_id, access_key);
END;

-- ==============================================================================
-- 16. CARGA INICIAL: EMPRESA MATRIZ & USUÁRIO ADMINISTRADOR PADRÃO
-- Senha Inicial de Primeiro Acesso: ******
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.tenants_companies WHERE id = '00000000000001')
BEGIN
    INSERT INTO dbo.tenants_companies (id, name, trade_name, cnpj, pais_origem, tipo_documento, documento_identificador, city, state, phone, email, is_active)
    VALUES ('00000000000001', N'CEC Conecta', N'CEC', N'00.000.000/0000-00', N'BR', N'CNPJ', N'00000000000001', N'Patrocinio', N'MG', N'(34)99947-2865', N'jairoeliakim@hotmail.com', 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.tenants_companies WHERE id = 'comp-matriz')
BEGIN
    INSERT INTO dbo.tenants_companies (id, name, trade_name, cnpj, pais_origem, tipo_documento, documento_identificador, city, state, phone, email, is_active)
    VALUES ('comp-matriz', N'CEC Conecta', N'CEC', N'00.000.000/0000-00', N'BR', N'CNPJ', N'00000000000001', N'Patrocinio', N'MG', N'(34)99947-2865', N'jairoeliakim@hotmail.com', 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.system_users WHERE email = 'admin@sistema.com')
BEGIN
    INSERT INTO dbo.system_users (id, tenant_id, name, email, password_hash, role, phone, pin, is_active)
    VALUES ('usr-admin-01', '00000000000001', N'Administrador do Sistema', N'admin@sistema.com', N'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', N'administrador', N'(31)99947-2865', N'[PROTEGIDO]', 1);
END
ELSE
BEGIN
    UPDATE dbo.system_users SET password_hash = N'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', pin = N'[PROTEGIDO]' WHERE email = 'admin@sistema.com';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.system_users WHERE email = 'admin')
BEGIN
    INSERT INTO dbo.system_users (id, tenant_id, name, email, password_hash, role, phone, pin, is_active)
    VALUES ('usr-admin-alias', '00000000000001', N'Administrador do Sistema', N'admin', N'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', N'administrador', N'(31)99947-2865', N'[PROTEGIDO]', 1);
END
ELSE
BEGIN
    UPDATE dbo.system_users SET password_hash = N'sha256$ce_cmv_salt_2026$abddd00398b080c4ec8b922cb993aaf26c54d56a637ef896d504cd012079dd20', pin = N'[PROTEGIDO]' WHERE email = 'admin';
END;`;
}
