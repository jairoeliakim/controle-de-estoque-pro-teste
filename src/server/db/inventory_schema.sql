-- ==============================================================================
-- SCHEMA DE BANCO DE DADOS: SAAS CONTROLE DE ESTOQUE MULTI-TENANT
-- Compatibilidade: PostgreSQL 14+ / MySQL 8.0+
-- Arquitetura: 100% Online, Isolamento Estrito por tenant_id, Concorrência com Row-Level Lock
-- ==============================================================================

-- Habilita UUID caso PostgreSQL
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE TENANTS (Organizações / Empresas / Restaurantes Contratantes)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(20) NOT NULL UNIQUE, -- CNPJ ou CPF (com ou sem máscara)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_document ON tenants(document);

-- 2. TABELA DE USUÁRIOS (Operadores e Administradores isolados por Tenant)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operador')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- 3. TABELA DE CATEGORIAS (Classificação de itens do Tenant)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_categories_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- 4. TABELA DE PRODUTOS (Catálogo e Saldo Atual de Estoque)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    category_id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    barcode VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (current_stock >= 0), -- Garante no banco que o saldo nunca fica negativo
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT uq_products_tenant_sku UNIQUE (tenant_id, sku)
);

-- ÍNDICES OBRIGATÓRIOS CONFORME ESPECIFICAÇÃO DE PERFORMANCE & MULTI-TENANCY:
-- 1. Busca ultra-rápida por Código de Barras (EAN-13, QR Code, Code128) com filtro de Tenant
CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode);

-- 2. Busca e validação de unicidade de SKU por Tenant
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku ON products(tenant_id, sku);

-- 3. Listagem geral e busca por nome
CREATE INDEX IF NOT EXISTS idx_products_tenant_name ON products(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON products(tenant_id, category_id);

-- 5. TABELA DE MOVIMENTAÇÕES DE ESTOQUE (Ledger Imutável de Auditoria / Transações)
CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    previous_stock NUMERIC(12, 3) NOT NULL,
    new_stock NUMERIC(12, 3) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_movements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_movements_tenant_product ON stock_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_movements_tenant_created ON stock_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_tenant_user ON stock_movements(tenant_id, user_id);

-- ==============================================================================
-- POSTGRESQL ROW LEVEL SECURITY (RLS) - DEFESA EM PROFUNDIDADE (OPCIONAL/RECOMENDADO)
-- Permite que o próprio banco bloqueie qualquer vazamento acidental entre tenants
-- ==============================================================================
/*
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_products ON products
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_policy_movements ON stock_movements
    USING (tenant_id = current_setting('app.current_tenant_id', true));
*/
