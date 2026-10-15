-- ==============================================================================
-- SCHEMA DE BANCO DE DADOS: SAAS BILLING, ASSINATURAS RECORRENTES & DUNNING
-- Compatibilidade: PostgreSQL 12+, SQLite 3, MySQL 8
-- ==============================================================================

-- 1. TABELA DE PLANOS (Catalógo de Planos de Assinatura)
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'BRL',
    features JSON,
    max_items INTEGER DEFAULT 1000,
    max_users INTEGER DEFAULT 10,
    support_level VARCHAR(50) DEFAULT 'padrao',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE TENANTS (Clientes / Restaurantes / Empresas Contratantes)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    cnpj VARCHAR(20),
    phone VARCHAR(30),
    gateway_customer_id VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_gateway_customer ON tenants(gateway_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);

-- 3. TABELA DE ASSINATURAS RECORRENTES (Subscriptions)
-- Controla ciclo atual, status de pagamento e a tolerância de atraso (dunning/grace period)
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_subscription_id VARCHAR(100) NOT NULL UNIQUE,
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
    status VARCHAR(30) NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    grace_period_end TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    canceled_at TIMESTAMP WITH TIME ZONE NULL,
    cancel_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway ON subscriptions(gateway_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_grace ON subscriptions(grace_period_end);

-- 4. TABELA DE FATURAS (Invoices)
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    subscription_id VARCHAR(64) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_invoice_id VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'canceled')),
    payment_url TEXT NOT NULL,
    pix_qrcode_base64 TEXT NULL,
    pix_copia_cola TEXT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE NULL,
    payment_method VARCHAR(30) DEFAULT 'pix',
    pdf_url TEXT NULL,
    attempt_count INTEGER DEFAULT 1,
    failure_reason TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_gateway ON invoices(gateway_invoice_id);

-- 5. TABELA DE AUDITORIA DE WEBHOOKS & NOTIFICAÇÕES (Régua de Cobrança / Dunning Logs)
CREATE TABLE IF NOT EXISTS webhook_events_log (
    id VARCHAR(64) PRIMARY KEY,
    gateway VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) DEFAULT 'success',
    error_message TEXT NULL
);

CREATE TABLE IF NOT EXISTS dunning_notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id VARCHAR(64) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('email', 'whatsapp', 'in_app')),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) DEFAULT 'sent'
);
