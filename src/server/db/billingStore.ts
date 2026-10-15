import {
  Invoice,
  Plan,
  Subscription,
  SubscriptionCheckResult,
  SubscriptionStatus,
  Tenant,
  DunningNotificationLog,
} from '../../types/billing.js';

// Catálogo de Planos do SaaS
export const SAAS_PLANS: Plan[] = [
  {
    id: 'plano-starter',
    name: 'Starter Restaurante',
    description: 'Ideal para bares e cafeterias de pequeno porte',
    priceMonthly: 99.0,
    currency: 'BRL',
    features: [
      'Contagem rápida por dias pré-definidos',
      'Até 250 itens no estoque',
      '2 usuários simultâneos',
      'Alertas de reposição e WhatsApp',
    ],
    maxItems: 250,
    maxUsers: 2,
    supportLevel: 'Email (24h)',
  },
  {
    id: 'plano-pro',
    name: 'Pro Gastronomia & CMV',
    description: 'Completo para restaurantes com controle rigoroso de perdas e compras',
    priceMonthly: 189.9,
    currency: 'BRL',
    features: [
      'Itens ilimitados no estoque',
      'Leitor de NF-e, QR Code SEFAZ e XML',
      'Gestão de CMV e Perdas/Quebras',
      'Envio de pedidos para fornecedores via WhatsApp & Email',
      'Usuários ilimitados com perfis e permissões (RBAC)',
      'Suporte prioritário via WhatsApp',
    ],
    maxItems: 99999,
    maxUsers: 99,
    supportLevel: 'WhatsApp Prioritário',
  },
  {
    id: 'plano-enterprise',
    name: 'Redes & Franquias',
    description: 'Para grupos gastronômicos e redes com múltiplos CNPJs',
    priceMonthly: 399.0,
    currency: 'BRL',
    features: [
      'Multi-unidades e transferência entre lojas',
      'Integração direta com ERPs e PDVs',
      'Gerente de conta dedicado',
      'SLA de 99.9% e backup horário',
    ],
    maxItems: 99999,
    maxUsers: 999,
    supportLevel: 'Gerente Dedicado 24/7',
  },
];

// Dados In-Memory com persistência de estado para execução contínua
export class BillingDatabaseStore {
  private static instance: BillingDatabaseStore;

  public plans: Map<string, Plan> = new Map();
  public tenants: Map<string, Tenant> = new Map();
  public subscriptions: Map<string, Subscription> = new Map();
  public invoices: Map<string, Invoice> = new Map();
  public webhookLogs: any[] = [];
  public dunningLogs: DunningNotificationLog[] = [];

  private constructor() {
    this.initSeedData();
  }

  public static getInstance(): BillingDatabaseStore {
    if (!BillingDatabaseStore.instance) {
      BillingDatabaseStore.instance = new BillingDatabaseStore();
    }
    return BillingDatabaseStore.instance;
  }

  private initSeedData() {
    // 1. Cadastra Planos
    SAAS_PLANS.forEach((plan) => this.plans.set(plan.id, plan));

    // 2. Tenant Padrão (Restaurante em produção)
    const defaultTenant: Tenant = {
      id: 'tenant-restaurante-01',
      name: 'Restaurante & Bar Gourmet',
      email: 'financeiro@restaurantedemo.com.br',
      cnpj: '12.345.678/0001-90',
      phone: '5511987654321',
      gateway_customer_id: 'cus_asaas_00192847',
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tenants.set(defaultTenant.id, defaultTenant);

    // 3. Assinatura Inicial (Ativa)
    const nextMonth = new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString();
    const defaultSubscription: Subscription = {
      id: 'sub-849102-pro',
      tenant_id: defaultTenant.id,
      gateway_subscription_id: 'sub_gw_9941829471',
      plan_id: 'plano-pro',
      status: 'active',
      current_period_end: nextMonth,
      grace_period_end: null,
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.subscriptions.set(defaultSubscription.id, defaultSubscription);

    // 4. Faturas Anteriores (Histórico)
    const invoiceLastMonth: Invoice = {
      id: 'inv-2026-08',
      subscription_id: defaultSubscription.id,
      tenant_id: defaultTenant.id,
      gateway_invoice_id: 'inv_gw_00817264',
      amount: 189.9,
      status: 'paid',
      payment_url: 'https://gateway.exemplo.com/fatura/inv_gw_00817264',
      due_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      paid_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      payment_method: 'pix',
      pdf_url: 'https://gateway.exemplo.com/comprovante/inv_gw_00817264.pdf',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.invoices.set(invoiceLastMonth.id, invoiceLastMonth);
  }

  // Métodos de Consulta
  public getTenant(tenantId = 'tenant-restaurante-01'): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  public getSubscriptionByTenant(tenantId = 'tenant-restaurante-01'): Subscription | undefined {
    for (const sub of this.subscriptions.values()) {
      if (sub.tenant_id === tenantId) return sub;
    }
    return undefined;
  }

  public getSubscriptionByGatewayId(gatewaySubId: string): Subscription | undefined {
    for (const sub of this.subscriptions.values()) {
      if (sub.gateway_subscription_id === gatewaySubId) return sub;
    }
    return undefined;
  }

  public getInvoicesByTenant(tenantId = 'tenant-restaurante-01'): Invoice[] {
    return Array.from(this.invoices.values())
      .filter((inv) => inv.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getPendingInvoice(subscriptionId: string): Invoice | undefined {
    for (const inv of this.invoices.values()) {
      if (inv.subscription_id === subscriptionId && (inv.status === 'pending' || inv.status === 'failed')) {
        return inv;
      }
    }
    return undefined;
  }

  // Métodos de Atualização & Dunning
  public updateSubscriptionStatus(
    subscriptionId: string,
    status: SubscriptionStatus,
    currentPeriodEnd?: string,
    gracePeriodEnd?: string | null
  ): Subscription | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return null;

    sub.status = status;
    sub.updated_at = new Date().toISOString();
    if (currentPeriodEnd) sub.current_period_end = currentPeriodEnd;
    if (gracePeriodEnd !== undefined) sub.grace_period_end = gracePeriodEnd;

    if (status === 'canceled') {
      sub.canceled_at = new Date().toISOString();
    }

    this.subscriptions.set(subscriptionId, sub);
    return sub;
  }

  public setInvoicePaid(gatewayInvoiceId: string, paidAt?: string): Invoice | null {
    for (const inv of this.invoices.values()) {
      if (inv.gateway_invoice_id === gatewayInvoiceId || inv.id === gatewayInvoiceId) {
        inv.status = 'paid';
        inv.paid_at = paidAt || new Date().toISOString();
        return inv;
      }
    }
    return null;
  }

  public setInvoiceFailed(gatewayInvoiceId: string, reason?: string): Invoice | null {
    for (const inv of this.invoices.values()) {
      if (inv.gateway_invoice_id === gatewayInvoiceId || inv.id === gatewayInvoiceId) {
        inv.status = 'failed';
        inv.failure_reason = reason || 'Pagamento recusado pela operadora do cartão ou PIX expirado';
        inv.attempt_count = (inv.attempt_count || 1) + 1;
        return inv;
      }
    }
    return null;
  }

  public createOrUpdateInvoice(invoice: Invoice): void {
    this.invoices.set(invoice.id, invoice);
  }

  public logWebhook(eventData: any) {
    this.webhookLogs.unshift({
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      receivedAt: new Date().toISOString(),
      ...eventData,
    });
    // Manter últimos 50
    if (this.webhookLogs.length > 50) this.webhookLogs.pop();
  }

  public logDunning(notification: DunningNotificationLog) {
    this.dunningLogs.unshift(notification);
    if (this.dunningLogs.length > 50) this.dunningLogs.pop();
  }

  // Avaliação centralizada da Regra de Negócio de Acesso (Access Control Guard)
  public checkSubscriptionAccess(tenantId = 'tenant-restaurante-01'): SubscriptionCheckResult {
    const tenant = this.getTenant(tenantId) || {
      id: tenantId,
      name: 'Restaurante & Bar Gourmet',
      email: 'financeiro@restaurantedemo.com.br',
      gateway_customer_id: 'cus_default',
      created_at: new Date().toISOString(),
    };

    let subscription = this.getSubscriptionByTenant(tenantId);
    if (!subscription) {
      // Cria assinatura padrão ativa caso inexistente
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      subscription = {
        id: `sub-${tenantId}`,
        tenant_id: tenantId,
        gateway_subscription_id: `gw_${tenantId}`,
        plan_id: 'plano-pro',
        status: 'active',
        current_period_end: nextMonth,
        grace_period_end: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.subscriptions.set(subscription.id, subscription);
    }

    const now = new Date();
    const pendingInvoice = this.getPendingInvoice(subscription.id);

    // CASO 1: Ativa ou em Período de Testes
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return {
        allowed: true,
        status: subscription.status,
        inGracePeriod: false,
        daysLeftInGrace: 0,
        isBlocked: false,
        reason: subscription.status === 'active' ? 'ACTIVE' : 'TRIALING',
        message: 'Assinatura ativa e em dia. Acesso irrestrito concedido.',
        subscription,
        tenant,
        pendingInvoice: null,
      };
    }

    // CASO 2: Cancelada
    if (subscription.status === 'canceled') {
      return {
        allowed: false,
        status: 'canceled',
        inGracePeriod: false,
        daysLeftInGrace: 0,
        isBlocked: true,
        reason: 'CANCELED',
        message: 'Assinatura cancelada. Reative o plano para recuperar o acesso ao controle de estoque.',
        subscription,
        tenant,
        pendingInvoice,
      };
    }

    // CASO 3: Inadimplente (past_due)
    if (subscription.status === 'past_due') {
      if (!subscription.grace_period_end) {
        // Se não tiver data limite, define 5 dias a partir de agora por segurança
        subscription.grace_period_end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        this.subscriptions.set(subscription.id, subscription);
      }

      const graceEnd = new Date(subscription.grace_period_end);
      const diffMs = graceEnd.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // SUB-CASO 3A: Dentro da tolerância de carência (now <= grace_period_end)
      if (now.getTime() <= graceEnd.getTime()) {
        const formattedDate = graceEnd.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          allowed: true,
          status: 'past_due',
          inGracePeriod: true,
          daysLeftInGrace: Math.max(1, daysLeft),
          isBlocked: false,
          reason: 'IN_GRACE_PERIOD',
          message: `Pagamento pendente. Regularize até ${formattedDate} para evitar o bloqueio dos serviços.`,
          subscription,
          tenant,
          pendingInvoice,
        };
      }

      // SUB-CASO 3B: Tolerância esgotada (now > grace_period_end) -> BLOQUEIO / PAYWALL
      return {
        allowed: false,
        status: 'past_due',
        inGracePeriod: false,
        daysLeftInGrace: 0,
        isBlocked: true,
        reason: 'GRACE_PERIOD_EXPIRED',
        message:
          'Acesso suspenso por inadimplência. O prazo de tolerância de 5 dias expirou. Efetue o pagamento da fatura pendente para liberar o sistema imediatamente.',
        subscription,
        tenant,
        pendingInvoice,
      };
    }

    return {
      allowed: true,
      status: 'active',
      inGracePeriod: false,
      daysLeftInGrace: 0,
      isBlocked: false,
      reason: 'ACTIVE',
      message: 'Status verificado.',
      subscription,
      tenant,
      pendingInvoice: null,
    };
  }

  // Método Utilitário para Simulação de Cenários no Painel de Testes
  public setSimulationScenario(scenario: 'active' | 'grace_period' | 'blocked' | 'canceled') {
    const sub = this.getSubscriptionByTenant('tenant-restaurante-01');
    if (!sub) return;

    const now = new Date();

    if (scenario === 'active') {
      sub.status = 'active';
      sub.current_period_end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      sub.grace_period_end = null;
      sub.canceled_at = null;

      // Quita faturas pendentes
      for (const inv of this.invoices.values()) {
        if (inv.status === 'pending' || inv.status === 'failed') {
          inv.status = 'paid';
          inv.paid_at = new Date().toISOString();
        }
      }
    } else if (scenario === 'grace_period') {
      // Inadimplente, mas faltam 3 dias para acabar o prazo de 5 dias
      sub.status = 'past_due';
      sub.current_period_end = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      sub.grace_period_end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
      sub.canceled_at = null;

      // Cria ou atualiza fatura pendente
      const pendingInv: Invoice = {
        id: `inv-sim-${Date.now()}`,
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        gateway_invoice_id: `gw_inv_sim_${Date.now()}`,
        amount: 189.9,
        status: 'pending',
        payment_url: 'https://pagamento.exemplo.com/pix/fatura-18990',
        pix_copia_cola:
          '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304ABCD',
        due_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        payment_method: 'pix',
        failure_reason: 'Tentativa de cobrança em cartão recusada por saldo insuficiente',
        attempt_count: 2,
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      };
      this.invoices.set(pendingInv.id, pendingInv);
    } else if (scenario === 'blocked') {
      // Inadimplente há mais de 5 dias (carência expirada)
      sub.status = 'past_due';
      sub.current_period_end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      sub.grace_period_end = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(); // Expirou ontem!
      sub.canceled_at = null;

      const blockedInv: Invoice = {
        id: `inv-blocked-${Date.now()}`,
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        gateway_invoice_id: `gw_inv_block_${Date.now()}`,
        amount: 189.9,
        status: 'failed',
        payment_url: 'https://pagamento.exemplo.com/pix/bloqueio-18990',
        pix_copia_cola:
          '00020126580014br.gov.bcb.pix0136987e6543-b21a-34d5-c789-9876543210005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304WXYZ',
        due_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        payment_method: 'pix',
        failure_reason: 'Prazo limite de tolerância excedido. Fatura vencida não liquidada.',
        attempt_count: 4,
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      this.invoices.set(blockedInv.id, blockedInv);
    } else if (scenario === 'canceled') {
      sub.status = 'canceled';
      sub.canceled_at = new Date().toISOString();
      sub.cancel_reason = 'Cancelamento solicitado pelo usuário ou perda total por inadimplência crônica';
    }

    sub.updated_at = new Date().toISOString();
    this.subscriptions.set(sub.id, sub);
  }
}

export const dbStore = BillingDatabaseStore.getInstance();
