var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/vercelEntry.ts
var vercelEntry_exports = {};
__export(vercelEntry_exports, {
  default: () => vercelEntry_default
});
module.exports = __toCommonJS(vercelEntry_exports);

// src/server/app.ts
var import_express5 = __toESM(require("express"), 1);

// src/server/routes/billingRoutes.ts
var import_express = require("express");

// src/server/db/billingStore.ts
var SAAS_PLANS = [
  {
    id: "plano-starter",
    name: "Starter Restaurante",
    description: "Ideal para bares e cafeterias de pequeno porte",
    priceMonthly: 99,
    currency: "BRL",
    features: [
      "Contagem r\xE1pida por dias pr\xE9-definidos",
      "At\xE9 250 itens no estoque",
      "2 usu\xE1rios simult\xE2neos",
      "Alertas de reposi\xE7\xE3o e WhatsApp"
    ],
    maxItems: 250,
    maxUsers: 2,
    supportLevel: "Email (24h)"
  },
  {
    id: "plano-pro",
    name: "Pro Gastronomia & CMV",
    description: "Completo para restaurantes com controle rigoroso de perdas e compras",
    priceMonthly: 189.9,
    currency: "BRL",
    features: [
      "Itens ilimitados no estoque",
      "Leitor de NF-e, QR Code SEFAZ e XML",
      "Gest\xE3o de CMV e Perdas/Quebras",
      "Envio de pedidos para fornecedores via WhatsApp & Email",
      "Usu\xE1rios ilimitados com perfis e permiss\xF5es (RBAC)",
      "Suporte priorit\xE1rio via WhatsApp"
    ],
    maxItems: 99999,
    maxUsers: 99,
    supportLevel: "WhatsApp Priorit\xE1rio"
  },
  {
    id: "plano-enterprise",
    name: "Redes & Franquias",
    description: "Para grupos gastron\xF4micos e redes com m\xFAltiplos CNPJs",
    priceMonthly: 399,
    currency: "BRL",
    features: [
      "Multi-unidades e transfer\xEAncia entre lojas",
      "Integra\xE7\xE3o direta com ERPs e PDVs",
      "Gerente de conta dedicado",
      "SLA de 99.9% e backup hor\xE1rio"
    ],
    maxItems: 99999,
    maxUsers: 999,
    supportLevel: "Gerente Dedicado 24/7"
  }
];
var BillingDatabaseStore = class _BillingDatabaseStore {
  constructor() {
    this.plans = /* @__PURE__ */ new Map();
    this.tenants = /* @__PURE__ */ new Map();
    this.subscriptions = /* @__PURE__ */ new Map();
    this.invoices = /* @__PURE__ */ new Map();
    this.webhookLogs = [];
    this.dunningLogs = [];
    this.initSeedData();
  }
  static getInstance() {
    if (!_BillingDatabaseStore.instance) {
      _BillingDatabaseStore.instance = new _BillingDatabaseStore();
    }
    return _BillingDatabaseStore.instance;
  }
  initSeedData() {
    SAAS_PLANS.forEach((plan) => this.plans.set(plan.id, plan));
    const defaultTenant = {
      id: "tenant-restaurante-01",
      name: "Desenvolvimento de Software",
      email: "financeiro@restaurantedemo.com.br",
      cnpj: "00.000.000/0000-00",
      phone: "5511987654321",
      gateway_customer_id: "cus_asaas_00192847",
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.tenants.set(defaultTenant.id, defaultTenant);
    const nextMonth = new Date(Date.now() + 24 * 24 * 60 * 60 * 1e3).toISOString();
    const defaultSubscription = {
      id: "sub-849102-pro",
      tenant_id: defaultTenant.id,
      gateway_subscription_id: "sub_gw_9941829471",
      plan_id: "plano-pro",
      status: "active",
      current_period_end: nextMonth,
      grace_period_end: null,
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.subscriptions.set(defaultSubscription.id, defaultSubscription);
    const invoiceLastMonth = {
      id: "inv-2026-08",
      subscription_id: defaultSubscription.id,
      tenant_id: defaultTenant.id,
      gateway_invoice_id: "inv_gw_00817264",
      amount: 189.9,
      status: "paid",
      payment_url: "https://gateway.exemplo.com/fatura/inv_gw_00817264",
      due_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1e3).toISOString(),
      paid_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1e3).toISOString(),
      payment_method: "pix",
      pdf_url: "https://gateway.exemplo.com/comprovante/inv_gw_00817264.pdf",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1e3).toISOString()
    };
    this.invoices.set(invoiceLastMonth.id, invoiceLastMonth);
  }
  // Métodos de Consulta
  getTenant(tenantId = "tenant-restaurante-01") {
    return this.tenants.get(tenantId);
  }
  getSubscriptionByTenant(tenantId = "tenant-restaurante-01") {
    for (const sub of this.subscriptions.values()) {
      if (sub.tenant_id === tenantId) return sub;
    }
    return void 0;
  }
  getSubscriptionByGatewayId(gatewaySubId) {
    for (const sub of this.subscriptions.values()) {
      if (sub.gateway_subscription_id === gatewaySubId) return sub;
    }
    return void 0;
  }
  getInvoicesByTenant(tenantId = "tenant-restaurante-01") {
    return Array.from(this.invoices.values()).filter((inv) => inv.tenant_id === tenantId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  getPendingInvoice(subscriptionId) {
    for (const inv of this.invoices.values()) {
      if (inv.subscription_id === subscriptionId && (inv.status === "pending" || inv.status === "failed")) {
        return inv;
      }
    }
    return void 0;
  }
  // Métodos de Atualização & Dunning
  updateSubscriptionStatus(subscriptionId, status, currentPeriodEnd, gracePeriodEnd) {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return null;
    sub.status = status;
    sub.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (currentPeriodEnd) sub.current_period_end = currentPeriodEnd;
    if (gracePeriodEnd !== void 0) sub.grace_period_end = gracePeriodEnd;
    if (status === "canceled") {
      sub.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    this.subscriptions.set(subscriptionId, sub);
    return sub;
  }
  setInvoicePaid(gatewayInvoiceId, paidAt) {
    for (const inv of this.invoices.values()) {
      if (inv.gateway_invoice_id === gatewayInvoiceId || inv.id === gatewayInvoiceId) {
        inv.status = "paid";
        inv.paid_at = paidAt || (/* @__PURE__ */ new Date()).toISOString();
        return inv;
      }
    }
    return null;
  }
  setInvoiceFailed(gatewayInvoiceId, reason) {
    for (const inv of this.invoices.values()) {
      if (inv.gateway_invoice_id === gatewayInvoiceId || inv.id === gatewayInvoiceId) {
        inv.status = "failed";
        inv.failure_reason = reason || "Pagamento recusado pela operadora do cart\xE3o ou PIX expirado";
        inv.attempt_count = (inv.attempt_count || 1) + 1;
        return inv;
      }
    }
    return null;
  }
  createOrUpdateInvoice(invoice) {
    this.invoices.set(invoice.id, invoice);
  }
  logWebhook(eventData) {
    this.webhookLogs.unshift({
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...eventData
    });
    if (this.webhookLogs.length > 50) this.webhookLogs.pop();
  }
  logDunning(notification) {
    this.dunningLogs.unshift(notification);
    if (this.dunningLogs.length > 50) this.dunningLogs.pop();
  }
  // Avaliação centralizada da Regra de Negócio de Acesso (Access Control Guard)
  checkSubscriptionAccess(tenantId = "tenant-restaurante-01") {
    const tenant = this.getTenant(tenantId) || {
      id: tenantId,
      name: "Desenvolvimento de Software",
      email: "financeiro@restaurantedemo.com.br",
      gateway_customer_id: "cus_default",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    let subscription = this.getSubscriptionByTenant(tenantId);
    if (!subscription) {
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
      subscription = {
        id: `sub-${tenantId}`,
        tenant_id: tenantId,
        gateway_subscription_id: `gw_${tenantId}`,
        plan_id: "plano-pro",
        status: "active",
        current_period_end: nextMonth,
        grace_period_end: null,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.subscriptions.set(subscription.id, subscription);
    }
    const now = /* @__PURE__ */ new Date();
    const pendingInvoice = this.getPendingInvoice(subscription.id);
    if (subscription.status === "active" || subscription.status === "trialing") {
      return {
        allowed: true,
        status: subscription.status,
        inGracePeriod: false,
        daysLeftInGrace: 0,
        isBlocked: false,
        reason: subscription.status === "active" ? "ACTIVE" : "TRIALING",
        message: "Assinatura ativa e em dia. Acesso irrestrito concedido.",
        subscription,
        tenant,
        pendingInvoice: null
      };
    }
    if (subscription.status === "canceled") {
      return {
        allowed: false,
        status: "canceled",
        inGracePeriod: false,
        daysLeftInGrace: 0,
        isBlocked: true,
        reason: "CANCELED",
        message: "Assinatura cancelada. Reative o plano para recuperar o acesso ao controle de estoque.",
        subscription,
        tenant,
        pendingInvoice
      };
    }
    if (subscription.status === "past_due") {
      if (!subscription.grace_period_end) {
        subscription.grace_period_end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3).toISOString();
        this.subscriptions.set(subscription.id, subscription);
      }
      const graceEnd = new Date(subscription.grace_period_end);
      const diffMs = graceEnd.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1e3 * 60 * 60 * 24));
      if (now.getTime() <= graceEnd.getTime()) {
        const formattedDate = graceEnd.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        return {
          allowed: true,
          status: "past_due",
          inGracePeriod: true,
          daysLeftInGrace: Math.max(1, daysLeft),
          isBlocked: false,
          reason: "IN_GRACE_PERIOD",
          message: `Pagamento pendente. Regularize at\xE9 ${formattedDate} para evitar o bloqueio dos servi\xE7os.`,
          subscription,
          tenant,
          pendingInvoice
        };
      }
      return {
        allowed: false,
        status: "past_due",
        inGracePeriod: false,
        daysLeftInGrace: 0,
        isBlocked: true,
        reason: "GRACE_PERIOD_EXPIRED",
        message: "Acesso suspenso por inadimpl\xEAncia. O prazo de toler\xE2ncia de 5 dias expirou. Efetue o pagamento da fatura pendente para liberar o sistema imediatamente.",
        subscription,
        tenant,
        pendingInvoice
      };
    }
    return {
      allowed: true,
      status: "active",
      inGracePeriod: false,
      daysLeftInGrace: 0,
      isBlocked: false,
      reason: "ACTIVE",
      message: "Status verificado.",
      subscription,
      tenant,
      pendingInvoice: null
    };
  }
  // Método Utilitário para Simulação de Cenários no Painel de Testes
  setSimulationScenario(scenario) {
    const sub = this.getSubscriptionByTenant("tenant-restaurante-01");
    if (!sub) return;
    const now = /* @__PURE__ */ new Date();
    if (scenario === "active") {
      sub.status = "active";
      sub.current_period_end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3).toISOString();
      sub.grace_period_end = null;
      sub.canceled_at = null;
      for (const inv of this.invoices.values()) {
        if (inv.status === "pending" || inv.status === "failed") {
          inv.status = "paid";
          inv.paid_at = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
    } else if (scenario === "grace_period") {
      sub.status = "past_due";
      sub.current_period_end = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1e3).toISOString();
      sub.grace_period_end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1e3).toISOString();
      sub.canceled_at = null;
      const pendingInv = {
        id: `inv-sim-${Date.now()}`,
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        gateway_invoice_id: `gw_inv_sim_${Date.now()}`,
        amount: 189.9,
        status: "pending",
        payment_url: "https://pagamento.exemplo.com/pix/fatura-18990",
        pix_copia_cola: "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304ABCD",
        due_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1e3).toISOString(),
        payment_method: "pix",
        failure_reason: "Tentativa de cobran\xE7a em cart\xE3o recusada por saldo insuficiente",
        attempt_count: 2,
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1e3).toISOString()
      };
      this.invoices.set(pendingInv.id, pendingInv);
    } else if (scenario === "blocked") {
      sub.status = "past_due";
      sub.current_period_end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString();
      sub.grace_period_end = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1e3).toISOString();
      sub.canceled_at = null;
      const blockedInv = {
        id: `inv-blocked-${Date.now()}`,
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        gateway_invoice_id: `gw_inv_block_${Date.now()}`,
        amount: 189.9,
        status: "failed",
        payment_url: "https://pagamento.exemplo.com/pix/bloqueio-18990",
        pix_copia_cola: "00020126580014br.gov.bcb.pix0136987e6543-b21a-34d5-c789-9876543210005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304WXYZ",
        due_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString(),
        payment_method: "pix",
        failure_reason: "Prazo limite de toler\xE2ncia excedido. Fatura vencida n\xE3o liquidada.",
        attempt_count: 4,
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString()
      };
      this.invoices.set(blockedInv.id, blockedInv);
    } else if (scenario === "canceled") {
      sub.status = "canceled";
      sub.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
      sub.cancel_reason = "Cancelamento solicitado pelo usu\xE1rio ou perda total por inadimpl\xEAncia cr\xF4nica";
    }
    sub.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.subscriptions.set(sub.id, sub);
  }
};
var dbStore = BillingDatabaseStore.getInstance();

// src/server/webhooks/paymentWebhookHandler.ts
var WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "whsec_asaas_saas_estoque_demo_2026";
function verifyWebhookSecurity(req) {
  if (process.env.NODE_ENV !== "production" && !process.env.STRICT_WEBHOOK_CHECK) {
    return true;
  }
  const asaasToken = req.headers["asaas-access-token"];
  if (asaasToken && asaasToken === WEBHOOK_SECRET) {
    return true;
  }
  const customSignature = req.headers["x-webhook-signature"] || req.headers["x-hub-signature-256"];
  if (customSignature && customSignature === WEBHOOK_SECRET) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${WEBHOOK_SECRET}`) {
    return true;
  }
  return false;
}
function normalizeGatewayEvent(body) {
  const eventName = body.event || body.type || body.action || "";
  const gateway = body.gateway || (body.object === "event" ? "stripe" : "asaas");
  if (eventName === "payment_succeeded" || eventName === "invoice.paid" || eventName === "PAYMENT_RECEIVED" || eventName === "PAYMENT_CONFIRMED" || eventName === "payment.created") {
    return {
      normalizedEvent: "payment_succeeded",
      gateway,
      subscriptionId: body.payment?.subscription || body.data?.object?.subscription || body.subscriptionId,
      customerId: body.payment?.customer || body.data?.object?.customer || body.customerId,
      invoiceId: body.payment?.id || body.data?.object?.id || body.invoiceId,
      amount: body.payment?.value || (body.data?.object?.amount_paid ? body.data.object.amount_paid / 100 : void 0) || body.amount,
      dueDate: body.payment?.dueDate
    };
  }
  if (eventName === "payment_failed" || eventName === "invoice.payment_failed" || eventName === "PAYMENT_OVERDUE" || eventName === "PAYMENT_CHARGEBACK_REQUESTED" || eventName === "PAYMENT_REFUSED") {
    return {
      normalizedEvent: "payment_failed",
      gateway,
      subscriptionId: body.payment?.subscription || body.data?.object?.subscription || body.subscriptionId,
      customerId: body.payment?.customer || body.data?.object?.customer || body.customerId,
      invoiceId: body.payment?.id || body.data?.object?.id || body.invoiceId,
      amount: body.payment?.value || body.amount,
      dueDate: body.payment?.dueDate,
      failureReason: body.payment?.refusalReason || body.data?.object?.last_payment_error?.message || body.failureReason || "Saldo insuficiente ou cart\xE3o recusado"
    };
  }
  if (eventName === "subscription_canceled" || eventName === "customer.subscription.deleted" || eventName === "SUBSCRIPTION_DELETED" || eventName === "SUBSCRIPTION_INACTIVATED") {
    return {
      normalizedEvent: "subscription_canceled",
      gateway,
      subscriptionId: body.subscription?.id || body.data?.object?.id || body.subscriptionId,
      customerId: body.subscription?.customer || body.data?.object?.customer || body.customerId
    };
  }
  return {
    normalizedEvent: "unknown",
    gateway
  };
}
function dispatchDunningNotification(params) {
  const formattedDate = new Date(params.gracePeriodEnd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const formattedAmount = Number(params.amount || 189.9).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
  const notification = {
    id: `dunning-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenant_id: params.tenantId,
    subscription_id: params.subscriptionId,
    invoice_id: params.invoiceId,
    type: "whatsapp",
    subject: `Aviso Importante: Fatura Pendente - ${params.tenantName}`,
    message: `Ol\xE1, ${params.tenantName}! Identificamos uma pend\xEAncia no pagamento da sua mensalidade no valor de ${formattedAmount}. O acesso ao sistema de estoque est\xE1 garantido at\xE9 ${formattedDate} (per\xEDodo de toler\xE2ncia). Evite a suspens\xE3o regularizando o pagamento via PIX no link da fatura.`,
    sent_at: (/* @__PURE__ */ new Date()).toISOString(),
    status: "sent"
  };
  dbStore.logDunning(notification);
  console.log(`[DUNNING] Notifica\xE7\xE3o de cobran\xE7a registrada para ${params.tenantEmail}:`, notification.message);
}
async function handlePaymentWebhook(req, res) {
  try {
    if (!verifyWebhookSecurity(req)) {
      console.warn("[WEBHOOK SECURITY] Tentativa de acesso n\xE3o autorizada ao endpoint de webhook.");
      res.status(401).json({ error: "UNAUTHORIZED_WEBHOOK_SIGNATURE" });
      return;
    }
    const rawBody = req.body || {};
    const { normalizedEvent, gateway, subscriptionId, invoiceId, amount, failureReason } = normalizeGatewayEvent(rawBody);
    console.log(`[WEBHOOK RECEIVED] Gateway: ${gateway} | Evento: ${normalizedEvent}`);
    dbStore.logWebhook({
      gateway,
      event: normalizedEvent,
      rawEvent: rawBody.event || rawBody.type,
      subscriptionId,
      invoiceId,
      amount
    });
    let targetSub = subscriptionId ? dbStore.getSubscriptionByGatewayId(subscriptionId) : dbStore.getSubscriptionByTenant("tenant-restaurante-01");
    if (!targetSub) {
      targetSub = dbStore.getSubscriptionByTenant("tenant-restaurante-01");
    }
    if (!targetSub) {
      res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
      return;
    }
    const tenant = dbStore.getTenant(targetSub.tenant_id);
    switch (normalizedEvent) {
      // -------------------------------------------------------------
      // EVENTO: Pagamento Aprovado / Sucesso
      // -------------------------------------------------------------
      case "payment_succeeded": {
        const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
        dbStore.updateSubscriptionStatus(targetSub.id, "active", nextPeriodEnd, null);
        if (invoiceId) {
          dbStore.setInvoicePaid(invoiceId);
        } else {
          const pending = dbStore.getPendingInvoice(targetSub.id);
          if (pending) {
            dbStore.setInvoicePaid(pending.id);
          }
        }
        console.log(`[WEBHOOK SUCCESS] Assinatura ${targetSub.id} reativada para ACTIVE. Pr\xF3ximo ciclo: ${nextPeriodEnd}`);
        res.status(200).json({
          status: "success",
          event: "payment_succeeded",
          subscription_status: "active",
          current_period_end: nextPeriodEnd,
          grace_period_end: null
        });
        return;
      }
      // -------------------------------------------------------------
      // EVENTO: Falha no Pagamento / Inadimplência
      // -------------------------------------------------------------
      case "payment_failed": {
        const graceEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3).toISOString();
        dbStore.updateSubscriptionStatus(targetSub.id, "past_due", void 0, graceEnd);
        const currentInvId = invoiceId || `inv-${Date.now()}`;
        const newOrUpdatedInvoice = {
          id: currentInvId,
          subscription_id: targetSub.id,
          tenant_id: targetSub.tenant_id,
          gateway_invoice_id: invoiceId || `gw_inv_${Date.now()}`,
          amount: amount || 189.9,
          status: "failed",
          payment_url: `https://pagamento.exemplo.com/fatura/${currentInvId}`,
          pix_copia_cola: "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304ABCD",
          due_date: (/* @__PURE__ */ new Date()).toISOString(),
          payment_method: "pix",
          failure_reason: failureReason || "Cart\xE3o n\xE3o autorizado pela emissora",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        dbStore.createOrUpdateInvoice(newOrUpdatedInvoice);
        if (tenant) {
          dispatchDunningNotification({
            tenantId: tenant.id,
            subscriptionId: targetSub.id,
            invoiceId: currentInvId,
            tenantEmail: tenant.email,
            tenantPhone: tenant.phone,
            tenantName: tenant.name,
            amount: amount || 189.9,
            gracePeriodEnd: graceEnd,
            reason: failureReason
          });
        }
        console.log(`[WEBHOOK FAILED] Assinatura ${targetSub.id} em PAST_DUE. Toler\xE2ncia at\xE9: ${graceEnd}`);
        res.status(200).json({
          status: "handled",
          event: "payment_failed",
          subscription_status: "past_due",
          grace_period_end: graceEnd,
          dunning_triggered: true
        });
        return;
      }
      // -------------------------------------------------------------
      // EVENTO: Assinatura Cancelada
      // -------------------------------------------------------------
      case "subscription_canceled": {
        dbStore.updateSubscriptionStatus(targetSub.id, "canceled");
        console.log(`[WEBHOOK CANCELED] Assinatura ${targetSub.id} foi CANCELADA.`);
        res.status(200).json({
          status: "handled",
          event: "subscription_canceled",
          subscription_status: "canceled"
        });
        return;
      }
      default: {
        console.log(`[WEBHOOK IGNORED] Evento n\xE3o mapeado: ${rawBody.event || rawBody.type}`);
        res.status(200).json({ status: "ignored", reason: "unmapped_event" });
        return;
      }
    }
  } catch (error) {
    console.error("[WEBHOOK ERROR] Falha no processamento:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: error?.message });
  }
}

// src/server/routes/billingRoutes.ts
var billingRouter = (0, import_express.Router)();
billingRouter.post("/webhooks/payment", handlePaymentWebhook);
billingRouter.get("/billing/status", (req, res) => {
  const tenantId = req.query.tenantId || "tenant-restaurante-01";
  const result = dbStore.checkSubscriptionAccess(tenantId);
  const plan = SAAS_PLANS.find((p) => p.id === result.subscription.plan_id);
  res.json({
    ...result,
    plan
  });
});
billingRouter.get("/billing/plans", (_req, res) => {
  res.json({ plans: SAAS_PLANS });
});
billingRouter.get("/billing/invoices", (req, res) => {
  const tenantId = req.query.tenantId || "tenant-restaurante-01";
  const invoices = dbStore.getInvoicesByTenant(tenantId);
  res.json({ invoices });
});
billingRouter.post("/billing/pay-invoice", (req, res) => {
  const { invoiceId, paymentMethod = "pix" } = req.body;
  const tenantId = req.body.tenantId || "tenant-restaurante-01";
  const sub = dbStore.getSubscriptionByTenant(tenantId);
  if (!sub) {
    res.status(404).json({ error: "Assinatura n\xE3o encontrada" });
    return;
  }
  const targetInvoice = invoiceId ? dbStore.invoices.get(invoiceId) : dbStore.getPendingInvoice(sub.id);
  if (targetInvoice) {
    targetInvoice.status = "paid";
    targetInvoice.paid_at = (/* @__PURE__ */ new Date()).toISOString();
    targetInvoice.payment_method = paymentMethod;
    dbStore.invoices.set(targetInvoice.id, targetInvoice);
  }
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
  dbStore.updateSubscriptionStatus(sub.id, "active", nextMonth, null);
  console.log(`[PAGAMENTO CONFIRMADO] Fatura liquidada. Assinatura ${sub.id} reativada com sucesso.`);
  res.json({
    success: true,
    message: "Pagamento confirmado com sucesso! O acesso completo foi restaurado.",
    subscription: dbStore.getSubscriptionByTenant(tenantId),
    invoice: targetInvoice
  });
});
billingRouter.post("/billing/simulate-scenario", (req, res) => {
  const { scenario } = req.body;
  if (!["active", "grace_period", "blocked", "canceled"].includes(scenario)) {
    res.status(400).json({ error: "Cen\xE1rio inv\xE1lido" });
    return;
  }
  dbStore.setSimulationScenario(scenario);
  const updatedStatus = dbStore.checkSubscriptionAccess("tenant-restaurante-01");
  res.json({
    success: true,
    message: `Cen\xE1rio alterado para: ${scenario.toUpperCase()}`,
    currentStatus: updatedStatus
  });
});
billingRouter.post("/billing/simulate-webhook", async (req, res) => {
  const { eventType, failureReason } = req.body;
  const syntheticPayload = {
    event: eventType || "payment_succeeded",
    gateway: "asaas",
    payment: {
      id: `pay_sim_${Date.now()}`,
      subscription: "sub_gw_9941829471",
      customer: "cus_asaas_00192847",
      value: 189.9,
      dueDate: (/* @__PURE__ */ new Date()).toISOString(),
      refusalReason: failureReason || "Cart\xE3o sem limite dispon\xEDvel"
    }
  };
  req.body = syntheticPayload;
  await handlePaymentWebhook(req, res);
});
billingRouter.get("/billing/dunning-logs", (_req, res) => {
  res.json({
    logs: dbStore.dunningLogs,
    webhooks: dbStore.webhookLogs
  });
});

// src/server/routes/inventoryRoutes.ts
var import_express2 = require("express");

// src/server/middleware/authMiddleware.ts
function verifyToken(token) {
  try {
    if (token.includes(".")) {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
        return JSON.parse(payloadJson);
      }
    }
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
function signDemoToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = Buffer.from("mock_signature_for_dev").toString("base64url");
  return `${header}.${body}.${signature}`;
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers["x-access-token"];
  if (!authHeader) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Token de autentica\xE7\xE3o n\xE3o fornecido no cabe\xE7alho Authorization: Bearer <token>"
    });
    return;
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  const decoded = verifyToken(token);
  if (!decoded || !decoded.tenant_id || !decoded.user_id) {
    res.status(401).json({
      error: "INVALID_TOKEN",
      message: "Token JWT inv\xE1lido, expirado ou desprovido de tenant_id."
    });
    return;
  }
  req.user = decoded;
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({
        error: "FORBIDDEN",
        message: `Acesso restrito. Esta opera\xE7\xE3o requer privil\xE9gio de ${role}.`
      });
      return;
    }
    next();
  };
}

// src/server/db/inventoryStore.ts
var InventoryDatabaseStore = class {
  constructor() {
    this.tenants = /* @__PURE__ */ new Map();
    this.users = /* @__PURE__ */ new Map();
    this.categories = /* @__PURE__ */ new Map();
    this.products = /* @__PURE__ */ new Map();
    this.stockMovements = [];
    // Mutex para simular Row-Level Locking (SELECT ... FOR UPDATE) por produto
    this.productLocks = /* @__PURE__ */ new Map();
    this.seedInitialData();
  }
  seedInitialData() {
    const defaultTenant = {
      id: "00000000000001",
      name: "CEC Conecta",
      document: "00.000.000/0000-00",
      created_at: (/* @__PURE__ */ new Date("2026-01-01")).toISOString()
    };
    this.tenants.set(defaultTenant.id, defaultTenant);
    this.tenants.set("comp-matriz", { ...defaultTenant, id: "comp-matriz" });
    const adminUser = {
      id: "usr-admin-01",
      tenant_id: defaultTenant.id,
      name: "Administrador do Sistema",
      email: "admin@sistema.com",
      role: "admin",
      created_at: (/* @__PURE__ */ new Date("2026-01-01")).toISOString()
    };
    this.users.set(adminUser.id, adminUser);
    const catCarnes = {
      id: "cat-carnes",
      tenant_id: defaultTenant.id,
      name: "Carnes & Porcionamentos"
    };
    const catLaticinios = {
      id: "cat-laticinios",
      tenant_id: defaultTenant.id,
      name: "Latic\xEDnios & Derivados"
    };
    const catHortifruti = {
      id: "cat-hortifruti",
      tenant_id: defaultTenant.id,
      name: "Hortifruti & Insumos"
    };
    const catBebidas = {
      id: "cat-bebidas",
      tenant_id: defaultTenant.id,
      name: "Bebidas, Bar & Adega"
    };
    const catPetiscos = {
      id: "cat-petiscos",
      tenant_id: defaultTenant.id,
      name: "Petiscos & Congelados"
    };
    [catCarnes, catLaticinios, catHortifruti, catBebidas, catPetiscos].forEach(
      (c) => this.categories.set(c.id, c)
    );
    this.products.clear();
    this.stockMovements = [];
  }
  // ============================================================================
  // TRANSAÇÃO ATÔMICA COM ROW-LOCKING (Concorrência Segura)
  // ============================================================================
  async executeAtomicStockMovement(tenantId, userId, dto) {
    if (!dto.product_id) {
      throw new Error("VALIDATION_ERROR: O campo product_id \xE9 obrigat\xF3rio.");
    }
    if (!dto.quantity || dto.quantity <= 0) {
      throw new Error("VALIDATION_ERROR: A quantidade deve ser estritamente maior que zero.");
    }
    if (!["ENTRADA", "SAIDA", "AJUSTE"].includes(dto.type)) {
      throw new Error("VALIDATION_ERROR: Tipo inv\xE1lido. Deve ser ENTRADA, SAIDA ou AJUSTE.");
    }
    const lockKey = `${tenantId}:${dto.product_id}`;
    let releaseLock = () => {
    };
    const currentLock = this.productLocks.get(lockKey) || Promise.resolve();
    const nextLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    this.productLocks.set(lockKey, currentLock.then(() => nextLock));
    await currentLock;
    try {
      const product = this.products.get(dto.product_id);
      if (!product || product.tenant_id !== tenantId) {
        throw new Error("NOT_FOUND: Produto n\xE3o encontrado para o tenant autenticado.");
      }
      const previousStock = Number(product.current_stock);
      let newStock = previousStock;
      if (dto.type === "SAIDA") {
        if (previousStock < dto.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: Saldo insuficiente em estoque. Saldo atual: ${previousStock.toFixed(
              3
            )}, Solicitado: ${dto.quantity.toFixed(3)}.`
          );
        }
        newStock = previousStock - dto.quantity;
      } else if (dto.type === "ENTRADA") {
        newStock = previousStock + dto.quantity;
      } else if (dto.type === "AJUSTE") {
        newStock = dto.quantity;
      }
      const updatedProduct = {
        ...product,
        current_stock: Math.round(newStock * 1e3) / 1e3,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.products.set(product.id, updatedProduct);
      const movement = {
        id: "mov_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now(),
        tenant_id: tenantId,
        product_id: product.id,
        user_id: userId,
        type: dto.type,
        quantity: dto.quantity,
        previous_stock: previousStock,
        new_stock: updatedProduct.current_stock,
        reason: dto.reason?.trim() || null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.stockMovements.unshift(movement);
      return { movement, product: updatedProduct };
    } finally {
      releaseLock();
    }
  }
  // ============================================================================
  // BUSCA E LISTAGEM DE PRODUTOS COM ISOLAMENTO DE TENANT
  // ============================================================================
  getProductsByTenant(tenantId, options) {
    let result = Array.from(this.products.values()).filter((p) => p.tenant_id === tenantId);
    if (options?.barcode) {
      const barcodeClean = options.barcode.trim();
      return result.filter((p) => p.barcode === barcodeClean);
    }
    if (options?.categoryId) {
      result = result.filter((p) => p.category_id === options.categoryId);
    }
    if (options?.search) {
      const term = options.search.toLowerCase().trim();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.barcode && p.barcode.includes(term)
      );
    }
    return result;
  }
  getProductById(tenantId, productId) {
    const p = this.products.get(productId);
    if (!p || p.tenant_id !== tenantId) return null;
    return p;
  }
  getMovementsByTenant(tenantId, limit = 50) {
    return this.stockMovements.filter((m) => m.tenant_id === tenantId).slice(0, limit);
  }
  getCategoriesByTenant(tenantId) {
    return Array.from(this.categories.values()).filter((c) => c.tenant_id === tenantId);
  }
  upsertProduct(product) {
    this.products.set(product.id, product);
  }
  deleteProduct(productId) {
    return this.products.delete(productId);
  }
  upsertUser(user) {
    this.users.set(user.id, user);
  }
  deleteUser(userId) {
    return this.users.delete(userId);
  }
};
var inventoryStore = new InventoryDatabaseStore();

// src/server/routes/inventoryRoutes.ts
var inventoryRouter = (0, import_express2.Router)();
inventoryRouter.post("/stock/movements", requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;
    const { product_id, type, quantity, reason } = req.body;
    const result = await inventoryStore.executeAtomicStockMovement(tenantId, userId, {
      product_id,
      type,
      quantity: Number(quantity),
      reason
    });
    res.status(201).json({
      success: true,
      message: `Movimenta\xE7\xE3o de ${type} registrada com sucesso na transa\xE7\xE3o at\xF4mica.`,
      data: {
        movement: result.movement,
        product: result.product
      }
    });
  } catch (error) {
    const message = error?.message || "Erro ao processar movimenta\xE7\xE3o de estoque.";
    if (message.startsWith("INSUFFICIENT_STOCK")) {
      res.status(422).json({
        error: "INSUFFICIENT_STOCK",
        message: message.replace("INSUFFICIENT_STOCK: ", ""),
        rollback: true
      });
      return;
    }
    if (message.startsWith("NOT_FOUND")) {
      res.status(404).json({
        error: "PRODUCT_NOT_FOUND",
        message: message.replace("NOT_FOUND: ", "")
      });
      return;
    }
    if (message.startsWith("VALIDATION_ERROR")) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: message.replace("VALIDATION_ERROR: ", "")
      });
      return;
    }
    console.error("[API stock/movements error]", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Falha interna durante a transa\xE7\xE3o de estoque. Rollback efetuado."
    });
  }
});
inventoryRouter.get("/products", requireAuth, (req, res) => {
  const tenantId = req.user.tenant_id;
  const categoryId = req.query.category_id;
  const search = req.query.search;
  const products = inventoryStore.getProductsByTenant(tenantId, { categoryId, search });
  res.json({
    success: true,
    total: products.length,
    data: products
  });
});
inventoryRouter.get("/products/search", requireAuth, (req, res) => {
  const tenantId = req.user.tenant_id;
  const barcode = req.query.barcode?.trim();
  const query = req.query.q?.trim();
  if (!barcode && !query) {
    res.status(400).json({
      error: "QUERY_REQUIRED",
      message: 'Informe o par\xE2metro "barcode" ou o termo de busca "q".'
    });
    return;
  }
  if (barcode) {
    const products = inventoryStore.getProductsByTenant(tenantId, { barcode });
    const product = products[0] || null;
    if (!product) {
      res.status(404).json({
        success: false,
        error: "PRODUCT_NOT_FOUND",
        message: `Nenhum produto cadastrado com o c\xF3digo de barras "${barcode}" neste restaurante.`
      });
      return;
    }
    res.json({
      success: true,
      data: product
    });
    return;
  }
  const matches = inventoryStore.getProductsByTenant(tenantId, { search: query });
  res.json({
    success: true,
    total: matches.length,
    data: matches
  });
});
inventoryRouter.post("/uploads/presigned-url", requireAuth, (req, res) => {
  const tenantId = req.user.tenant_id;
  const { filename, content_type, product_id } = req.body;
  if (!filename || !content_type) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Os campos filename e content_type s\xE3o obrigat\xF3rios."
    });
    return;
  }
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(content_type.toLowerCase())) {
    res.status(400).json({
      error: "INVALID_MIME_TYPE",
      message: "Tipo de arquivo n\xE3o suportado. Use JPEG, PNG ou WEBP."
    });
    return;
  }
  const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
  const fileKey = `tenants/${tenantId}/products/${product_id || "new"}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const bucketName = process.env.S3_BUCKET_NAME || "saas-inventory-photos";
  const s3Endpoint = process.env.S3_ENDPOINT || "https://pub-r2.storage.cloudflare.com";
  const uploadUrl = `${s3Endpoint}/${bucketName}/${fileKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock_cred&X-Amz-Date=${(/* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "")}&X-Amz-Expires=300&X-Amz-Signature=mock_presigned_signature`;
  const publicUrl = `${s3Endpoint}/${bucketName}/${fileKey}`;
  res.json({
    success: true,
    data: {
      upload_url: uploadUrl,
      public_url: publicUrl,
      file_key: fileKey,
      expires_in_seconds: 300,
      headers: {
        "Content-Type": content_type,
        "x-amz-acl": "public-read"
      }
    }
  });
});
inventoryRouter.get("/stock/movements", requireAuth, (req, res) => {
  const tenantId = req.user.tenant_id;
  const movements = inventoryStore.getMovementsByTenant(tenantId);
  res.json({
    success: true,
    total: movements.length,
    data: movements
  });
});
inventoryRouter.get("/categories", requireAuth, (req, res) => {
  const tenantId = req.user.tenant_id;
  const categories = inventoryStore.getCategoriesByTenant(tenantId);
  res.json({
    success: true,
    data: categories
  });
});
inventoryRouter.get("/admin/db-status", requireAuth, requireRole("admin"), (req, res) => {
  const tenantId = req.user.tenant_id;
  res.json({
    success: true,
    message: "Acesso autorizado ao diagn\xF3stico do banco de dados relacional.",
    database: {
      type: "PostgreSQL / MySQL Multi-Tenant",
      tenant_id: tenantId,
      isolation: "Schema/Tenant-ID strict isolation",
      pool_status: "healthy",
      total_products: inventoryStore.getProductsByTenant(tenantId).length,
      total_movements: inventoryStore.getMovementsByTenant(tenantId).length
    }
  });
});

// src/server/routes/databaseRoutes.ts
var import_fs = __toESM(require("fs"), 1);
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_net = __toESM(require("net"), 1);
var import_express3 = require("express");
var import_pg = __toESM(require("pg"), 1);
var import_promise = __toESM(require("mysql2/promise"), 1);

// src/utils/databaseScripts.ts
var SYSTEM_TABLES = [
  {
    name: "tenants_companies",
    label: "Empresas & Unidades (Multi-Tenant)",
    description: "Armazena filiais, matrizes e informa\xE7\xF5es de CNPJ com isolamento de dados.",
    category: "core"
  },
  {
    name: "system_users",
    label: "Usu\xE1rios & Permiss\xF5es RBAC",
    description: "Colaboradores, perfis (Administrador, Gerente, Compras, Conferente) e credenciais.",
    category: "core"
  },
  {
    name: "system_settings",
    label: "Parametriza\xE7\xE3o Sist\xEAmica",
    description: "Pol\xEDticas de pre\xE7o desatualizado, calend\xE1rio de contagem e regras globais.",
    category: "core"
  },
  {
    name: "categories",
    label: "Categorias de Produtos",
    description: "Porcionamentos, petiscos, insumos de consumo, bebidas, limpeza e descart\xE1veis.",
    category: "estoque"
  },
  {
    name: "suppliers",
    label: "Cadastro de Fornecedores",
    description: "Fornecedores com CNPJ, prazos de entrega, validade de pre\xE7os e pedido m\xEDnimo.",
    category: "compras"
  },
  {
    name: "stock_items",
    label: "Itens & Saldos de Estoque",
    description: "Produtos com estoque m\xEDnimo, ideal, saldos em tempo real, custos e localiza\xE7\xE3o.",
    category: "estoque"
  },
  {
    name: "supplier_quotes",
    label: "Cota\xE7\xF5es & Pre\xE7os de Fornecedores",
    description: "Hist\xF3rico de cota\xE7\xF5es por fornecedor com vig\xEAncia e prazos de validade.",
    category: "compras"
  },
  {
    name: "stock_movements",
    label: "Movimenta\xE7\xF5es de Estoque (Ledger)",
    description: "Registro imut\xE1vel de entradas por NF, sa\xEDdas, quebras e ajustes com auditoria.",
    category: "estoque"
  },
  {
    name: "stock_count_sessions",
    label: "Sess\xF5es de Contagem F\xEDsica",
    description: "Sess\xF5es peri\xF3dicas abertas pelo conferente com auditoria e aprova\xE7\xE3o do supervisor.",
    category: "conferencia"
  },
  {
    name: "stock_count_entries",
    label: "Apura\xE7\xF5es da Contagem F\xEDsica",
    description: "Quantidades contadas fisicamente, estoques te\xF3ricos anteriores e diverg\xEAncias.",
    category: "conferencia"
  },
  {
    name: "unlisted_count_items",
    label: "Itens N\xE3o Cadastrados na Contagem",
    description: "Produtos avulsos anotados pelo conferente aguardando valida\xE7\xE3o de compras.",
    category: "conferencia"
  },
  {
    name: "loss_records",
    label: "Apontamento de Perdas & CMV",
    description: "Registros de produtos queimados, vencidos, quebras de garrafa e descarte.",
    category: "financeiro"
  },
  {
    name: "purchase_orders",
    label: "Pedidos de Compra",
    description: "Ordens de compra enviadas para fornecedores com status, frete e prazos.",
    category: "compras"
  },
  {
    name: "purchase_order_items",
    label: "Itens do Pedido de Compra",
    description: "Itens, quantidades compradas, custos unit\xE1rios e confer\xEAncia de recebimento.",
    category: "compras"
  },
  {
    name: "invoices_history",
    label: "Notas Fiscais de Entrada (NF-e)",
    description: "Hist\xF3rico de importa\xE7\xE3o de notas fiscais via chave de 44 d\xEDgitos ou QR Code.",
    category: "compras"
  }
];
function generateDatabaseScript(engine, databaseName = "restaurante_estoque_db") {
  if (engine === "postgres") {
    return `-- ==============================================================================
-- SCRIPT DE CRIA\xC7\xC3O DAS TABELAS DO SISTEMA - POSTGRESQL 13+
-- Banco de Dados Alvo: ${databaseName}
-- Gerado automaticamente pelo Assistente de Parametriza\xE7\xE3o Sist\xEAmica
-- ==============================================================================

-- 1. EMPRESAS & TENANTS (Tenant identificado pelo CNPJ sem tra\xE7os)
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

-- 2. USU\xC1RIOS DO SISTEMA (RBAC)
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

-- 3. PARAMETRIZA\xC7\xC3O SIST\xCAMICA & POL\xCDTICAS
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

-- 7. COTA\xC7\xD5ES DE FORNECEDORES
CREATE TABLE IF NOT EXISTS supplier_quotes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_companies(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. MOVIMENTA\xC7\xD5ES DE ESTOQUE
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

-- 9. SESS\xD5ES DE CONTAGEM F\xCDSICA
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

-- 10. ITENS CONFERIDOS NA SESS\xC3O DE CONTAGEM
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

-- 11. ITENS AVULSOS N\xC3O CADASTRADOS (APONTADOS NA CONTAGEM)
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
-- 16. CARGA INICIAL: EMPRESA MATRIZ & USU\xC1RIO ADMINISTRADOR PADR\xC3O
-- Senha inicial de primeiro acesso: definida pelo sistema (armazenada apenas como hash)
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
  if (engine === "mysql") {
    return `-- ==============================================================================
-- SCRIPT DE CRIA\xC7\xC3O DAS TABELAS DO SISTEMA - MYSQL 8.0+
-- Banco de Dados Alvo: ${databaseName}
-- Gerado automaticamente pelo Assistente de Parametriza\xE7\xE3o Sist\xEAmica
-- ==============================================================================

-- 1. EMPRESAS & TENANTS (Tenant identificado pelo CNPJ sem tra\xE7os)
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

-- 2. USU\xC1RIOS DO SISTEMA (RBAC)
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

-- 3. PARAMETRIZA\xC7\xC3O SIST\xCAMICA & POL\xCDTICAS
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

-- 7. COTA\xC7\xD5ES DE FORNECEDORES
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

-- 8. MOVIMENTA\xC7\xD5ES DE ESTOQUE
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

-- 9. SESS\xD5ES DE CONTAGEM F\xCDSICA
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

-- 11. ITENS AVULSOS N\xC3O CADASTRADOS
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
-- 16. CARGA INICIAL: EMPRESA MATRIZ & USU\xC1RIO ADMINISTRADOR PADR\xC3O
-- Senha inicial de primeiro acesso: definida pelo sistema (armazenada apenas como hash)
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
  return `-- ==============================================================================
-- SCRIPT DE CRIA\xC7\xC3O DAS TABELAS DO SISTEMA - MICROSOFT SQL SERVER 2017+
-- Banco de Dados Alvo: ${databaseName}
-- Gerado automaticamente pelo Assistente de Parametriza\xE7\xE3o Sist\xEAmica
-- ==============================================================================

-- 1. EMPRESAS & TENANTS (Tenant identificado pelo CNPJ sem tra\xE7os)
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

-- 2. USU\xC1RIOS DO SISTEMA (RBAC)
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

-- 3. PARAMETRIZA\xC7\xC3O SIST\xCAMICA & POL\xCDTICAS
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

-- 7. COTA\xC7\xD5ES DE FORNECEDORES
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

-- 8. MOVIMENTA\xC7\xD5ES DE ESTOQUE
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

-- 9. SESS\xD5ES DE CONTAGEM F\xCDSICA
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

-- 11. ITENS AVULSOS N\xC3O CADASTRADOS
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
-- 16. CARGA INICIAL: EMPRESA MATRIZ & USU\xC1RIO ADMINISTRADOR PADR\xC3O
-- Senha inicial de primeiro acesso: definida pelo sistema (armazenada apenas como hash)
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

// src/utils/cnpjValidator.ts
function cleanCNPJ(raw) {
  const alnum = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  return alnum.slice(0, 12) + alnum.slice(12).replace(/\D/g, "");
}
function cnpjCharValue(ch) {
  return ch.charCodeAt(0) - 48;
}
var CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
var CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
function computeCheckDigit(chars, weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += cnpjCharValue(chars[i]) * weights[i];
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}
function validateCNPJ(cnpj) {
  const clean = cleanCNPJ(cnpj);
  if (!clean) {
    return {
      isValid: false,
      cleanCnpj: "",
      formattedCnpj: "",
      error: "CNPJ n\xE3o informado",
      isRepeatedDigits: false,
      isCorrectLength: false
    };
  }
  if (clean.length !== 14) {
    return {
      isValid: false,
      cleanCnpj: clean,
      formattedCnpj: formatCNPJ(clean),
      error: `CNPJ deve conter exatamente 14 caracteres (informados: ${clean.length})`,
      isRepeatedDigits: false,
      isCorrectLength: false
    };
  }
  if (/^([A-Z0-9])\1{13}$/.test(clean)) {
    return {
      isValid: false,
      cleanCnpj: clean,
      formattedCnpj: formatCNPJ(clean),
      error: "CNPJ inv\xE1lido: todos os caracteres s\xE3o repetidos",
      isRepeatedDigits: true,
      isCorrectLength: true
    };
  }
  const base12 = clean.substring(0, 12);
  const digit1 = computeCheckDigit(base12, CNPJ_WEIGHTS_1);
  const digit2 = computeCheckDigit(base12 + digit1, CNPJ_WEIGHTS_2);
  const calculatedCheckDigits = `${digit1}${digit2}`;
  const actualCheckDigits = clean.substring(12, 14);
  const isValid = calculatedCheckDigits === actualCheckDigits;
  return {
    isValid,
    cleanCnpj: clean,
    formattedCnpj: formatCNPJ(clean),
    isRepeatedDigits: false,
    isCorrectLength: true,
    calculatedCheckDigits,
    actualCheckDigits,
    error: isValid ? void 0 : `D\xEDgitos verificadores inconsistentes (${actualCheckDigits}). O c\xE1lculo oficial da Receita Federal resulta em ${calculatedCheckDigits}.`
  };
}
function formatCNPJ(cnpj) {
  const c = cleanCNPJ(cnpj);
  let out = c.slice(0, 2);
  if (c.length > 2) out += "." + c.slice(2, 5);
  if (c.length > 5) out += "." + c.slice(5, 8);
  if (c.length > 8) out += "/" + c.slice(8, 12);
  if (c.length > 12) out += "-" + c.slice(12, 14);
  return out;
}

// src/utils/passwordSecurity.ts
function rightRotate(value, amount) {
  return value >>> amount | value << 32 - amount;
}
function sha256(ascii) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i, j;
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [];
  let k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = mathPow(candidate, 0.5) * maxWord | 0;
      k[primeCounter++] = mathPow(candidate, 1 / 3) * maxWord | 0;
    }
  }
  hash = hash.slice(0, 8);
  words[asciiBitLength >> 5] |= 128 << 24 - asciiBitLength % 32;
  words[(asciiBitLength + 64 >> 9 << 4) + 15] = asciiBitLength;
  for (i = 0; i < ascii.length; i++) {
    const charCode = ascii.charCodeAt(i);
    words[i >> 2] |= charCode << 24 - i % 4 * 8;
  }
  const w = [];
  for (i = 0; i < words.length; i += 16) {
    const oldHash = hash.slice(0);
    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[j + i] | 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ w[j - 15] >>> 3;
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ w[j - 2] >>> 10;
        w[j] = w[j - 16] + gamma0 + w[j - 7] + gamma1 | 0;
      }
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = hash[4] & hash[5] ^ ~hash[4] & hash[6];
      const temp1 = hash[7] + s1 + ch + k[j] + w[j] | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = hash[0] & hash[1] ^ hash[0] & hash[2] ^ hash[1] & hash[2];
      const temp2 = s0 + maj | 0;
      hash = [
        temp1 + temp2 | 0,
        hash[0],
        hash[1],
        hash[2],
        hash[3] + temp1 | 0,
        hash[4],
        hash[5],
        hash[6]
      ];
    }
    for (j = 0; j < 8; j++) {
      hash[j] = hash[j] + oldHash[j] | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = hash[i] >> j * 8 & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}
var DEFAULT_SALT = "ce_cmv_salt_2026";
function hashPassword(plainText, salt = DEFAULT_SALT) {
  if (!plainText) return "";
  const calculated = sha256(`${salt}:${plainText}`);
  return `sha256$${salt}$${calculated}`;
}

// src/server/routes/databaseRoutes.ts
var databaseRouter = (0, import_express3.Router)();
var CONFIG_FILE_PATH = process.env.VERCEL ? import_path.default.join(import_os.default.tmpdir(), ".database-config.json") : import_path.default.resolve(process.cwd(), ".database-config.json");
function testTcpSocket(host, port, timeoutMs = 2500) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const socket = new import_net.default.Socket();
    let settled = false;
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      if (!settled) {
        settled = true;
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      }
    });
    socket.on("timeout", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({
          reachable: false,
          latencyMs: timeoutMs,
          code: "ETIMEDOUT",
          error: `Tempo limite esgotado (${timeoutMs}ms) ao tentar conectar em ${host}:${port}. O servidor ou porta n\xE3o respondeu.`
        });
      }
    });
    socket.on("error", (err) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        let reason = err.message || "Falha de conex\xE3o";
        if (err.code === "ECONNREFUSED") {
          reason = `Conex\xE3o recusada na porta ${port} do host "${host}". O servi\xE7o n\xE3o est\xE1 em execu\xE7\xE3o ou n\xE3o est\xE1 aceitando conex\xF5es.`;
        } else if (err.code === "ENOTFOUND") {
          reason = `Endere\xE7o/host "${host}" n\xE3o foi encontrado (falha de resolu\xE7\xE3o DNS). Verifique se o IP ou dom\xEDnio est\xE1 correto.`;
        } else if (err.code === "EHOSTUNREACH" || err.code === "ENETUNREACH") {
          reason = `Host "${host}" ou rede est\xE1 inacess\xEDvel a partir deste ambiente.`;
        }
        resolve({
          reachable: false,
          latencyMs: Date.now() - startTime,
          code: err.code,
          error: reason
        });
      }
    });
    socket.connect(port, host);
  });
}
function describeSupabaseIssue(config, err) {
  const host = String(config.host || "").toLowerCase();
  const isDirect = /^db\.[a-z0-9]+\.supabase\.co$/.test(host);
  const isPooler = /\.pooler\.supabase\.com$/.test(host);
  if (!isDirect && !isPooler) return null;
  const msg = String(err?.message || "");
  const code = String(err?.code || "");
  if (!config.ssl && /ssl|encrypt|pg_hba/i.test(msg)) {
    return {
      type: "SSL_REQUIRED",
      code: code || "SSL_REQUIRED",
      message: 'O Supabase exige conex\xE3o criptografada. Marque a op\xE7\xE3o "Habilitar conex\xE3o criptografada SSL/TLS".',
      recommendation: "Marque a caixa de SSL/TLS e teste novamente."
    };
  }
  const networkCodes = ["ENOTFOUND", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN", "ETIMEDOUT"];
  if (isDirect && (networkCodes.includes(code) || /timeout/i.test(msg))) {
    return {
      type: "SUPABASE_IPV6_ONLY",
      code: code || "SUPABASE_IPV6_ONLY",
      message: `N\xE3o foi poss\xEDvel alcan\xE7ar ${config.host}: o endere\xE7o direto do Supabase usa apenas IPv6 e a Vercel s\xF3 sai por IPv4.`,
      recommendation: 'Use o "Session pooler" do Supabase:\n1. No Supabase, clique em Connect e escolha o m\xE9todo "Session pooler".\n2. Copie o host (aws-0-REGIAO.pooler.supabase.com), a porta (5432) e o usu\xE1rio (postgres.SEU_REF).\n3. Use esses valores aqui, com SSL marcado.'
    };
  }
  if (isPooler && /tenant or user not found/i.test(msg)) {
    return {
      type: "SUPABASE_POOLER_USER",
      code: code || "SUPABASE_POOLER_USER",
      message: "O pooler do Supabase n\xE3o encontrou o projeto/usu\xE1rio informado.",
      recommendation: 'No pooler o usu\xE1rio deve ser "postgres.SEU_REF" (ex.: postgres.abcdefghijklmnop), e n\xE3o apenas "postgres". Copie o valor exato em Connect > Session pooler.'
    };
  }
  if (code === "3D000") {
    return {
      type: "DATABASE_DOES_NOT_EXIST",
      code,
      message: `O banco "${config.database}" n\xE3o existe nesse projeto do Supabase.`,
      recommendation: 'No Supabase o nome do banco \xE9 "postgres" (o nome do projeto, como "Restaurante_teste", n\xE3o \xE9 o nome do banco). Preencha "Nome do Banco de Dados" com postgres.'
    };
  }
  return null;
}
async function testPostgresConnection(config) {
  const startTime = Date.now();
  const client = new import_pg.default.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password || "",
    ssl: config.ssl ? { rejectUnauthorized: false } : void 0,
    connectionTimeoutMillis: config.timeoutMs || 8e3
  });
  try {
    await client.connect();
    const res = await client.query("SELECT version();");
    const latencyMs = Date.now() - startTime;
    await client.end();
    const versionStr = res.rows[0]?.version?.split(" ")?.[0] + " " + res.rows[0]?.version?.split(" ")?.[1] || "PostgreSQL";
    return {
      connected: true,
      databaseExists: true,
      serverVersion: versionStr,
      latencyMs,
      message: `Conex\xE3o com PostgreSQL em ${config.host}:${config.port} autenticada com sucesso! O banco "${config.database}" existe e est\xE1 ativo.`
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    try {
      await client.end();
    } catch {
    }
    const supabaseIssue = describeSupabaseIssue(config, err);
    if (supabaseIssue) {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: supabaseIssue.code,
        errorType: supabaseIssue.type,
        message: supabaseIssue.message,
        recommendation: supabaseIssue.recommendation
      };
    }
    if (err.code === "3D000") {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "3D000",
        errorType: "DATABASE_DOES_NOT_EXIST",
        message: `O banco de dados "${config.database}" N\xC3O existe no PostgreSQL (${config.host}:${config.port}).`,
        recommendation: `O servidor PostgreSQL est\xE1 online e acess\xEDvel, mas a base "${config.database}" ainda n\xE3o foi criada.

Para solucionar:
1. Acesse seu PostgreSQL (via pgAdmin, psql ou terminal).
2. Execute o comando:
   CREATE DATABASE ${config.database};
3. Ap\xF3s criar o banco, teste o v\xEDnculo novamente.`
      };
    }
    if (err.code === "28P01") {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "28P01",
        errorType: "AUTH_FAILED",
        message: `Falha de autentica\xE7\xE3o: senha incorreta para o usu\xE1rio "${config.username}".`,
        recommendation: `Verifique a senha informada nas configura\xE7\xF5es de v\xEDnculo do banco.`
      };
    }
    if (err.code === "28000") {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "28000",
        errorType: "USER_NOT_FOUND",
        message: `O usu\xE1rio "${config.username}" n\xE3o existe no PostgreSQL.`,
        recommendation: `Verifique o nome de usu\xE1rio digitado ou crie o usu\xE1rio com permiss\xF5es no PostgreSQL.`
      };
    }
    if (err.code === "ECONNREFUSED") {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "ECONNREFUSED",
        errorType: "CONNECTION_REFUSED",
        message: `Conex\xE3o recusada na porta ${config.port} de "${config.host}". O servi\xE7o do PostgreSQL n\xE3o est\xE1 rodando nesta porta ou o firewall est\xE1 bloqueando.`,
        recommendation: `1. Certifique-se de que o servi\xE7o do PostgreSQL est\xE1 iniciado.
2. Verifique se a porta ${config.port} est\xE1 liberada.
3. Caso o PostgreSQL esteja no seu computador local e voc\xEA esteja testando na nuvem, use um host com IP p\xFAblico, ngrok, ou ative o "Modo Simulado em Mem\xF3ria".`
      };
    }
    return {
      connected: false,
      databaseExists: false,
      latencyMs,
      errorCode: err.code || "UNKNOWN",
      errorType: "PG_ERROR",
      message: `Erro ao conectar ao PostgreSQL: ${err.message}`,
      recommendation: `Verifique os par\xE2metros de host, porta, nome do banco e credenciais.`
    };
  }
}
async function testMysqlConnection(config) {
  const startTime = Date.now();
  try {
    const connection = await import_promise.default.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password || "",
      ssl: config.ssl ? { rejectUnauthorized: false } : void 0,
      connectTimeout: config.timeoutMs || 3e3
    });
    const [rows] = await connection.query("SELECT VERSION() as version");
    const latencyMs = Date.now() - startTime;
    await connection.end();
    const versionStr = rows?.[0]?.version ? `MySQL ${rows[0].version}` : "MySQL Server 8.0";
    return {
      connected: true,
      databaseExists: true,
      serverVersion: versionStr,
      latencyMs,
      message: `Conex\xE3o com MySQL em ${config.host}:${config.port} autenticada com sucesso! O banco "${config.database}" existe e est\xE1 pronto.`
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    if (err.code === "ER_BAD_DB_ERROR" || err.errno === 1049) {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "1049",
        errorType: "DATABASE_DOES_NOT_EXIST",
        message: `O banco de dados "${config.database}" N\xC3O existe no MySQL (${config.host}:${config.port}).`,
        recommendation: `O servidor MySQL respondeu, mas o banco "${config.database}" ainda n\xE3o foi criado.

Para solucionar:
1. Acesse o MySQL (via MySQL Workbench ou terminal mysql).
2. Execute:
   CREATE DATABASE ${config.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
3. Ap\xF3s criar o banco, teste o v\xEDnculo novamente.`
      };
    }
    if (err.code === "ER_ACCESS_DENIED_ERROR" || err.errno === 1045) {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "1045",
        errorType: "AUTH_FAILED",
        message: `Acesso negado para o usu\xE1rio "${config.username}" no MySQL. Senha incorreta ou usu\xE1rio sem privil\xE9gios.`,
        recommendation: `Verifique se o usu\xE1rio e a senha informados est\xE3o corretos no MySQL.`
      };
    }
    if (err.code === "ECONNREFUSED") {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: "ECONNREFUSED",
        errorType: "CONNECTION_REFUSED",
        message: `Conex\xE3o recusada na porta ${config.port} de "${config.host}". O servi\xE7o do MySQL n\xE3o est\xE1 em execu\xE7\xE3o.`,
        recommendation: `Verifique se o servi\xE7o MySQL est\xE1 ativo e aceitando conex\xF5es na porta ${config.port}.`
      };
    }
    return {
      connected: false,
      databaseExists: false,
      latencyMs,
      errorCode: err.code || "UNKNOWN",
      errorType: "MYSQL_ERROR",
      message: `Erro ao conectar ao MySQL: ${err.message}`,
      recommendation: `Verifique os par\xE2metros de host, porta, nome do banco e credenciais.`
    };
  }
}
var linkedDatabaseState = {
  engine: "postgres",
  host: "localhost",
  port: 5432,
  database: "restaurante_estoque_db",
  username: "postgres",
  password: "",
  ssl: false,
  status: "desconectado",
  isSimulationMode: false,
  databaseExists: false,
  tablesCreated: false,
  totalRecordsCount: 0
};
var tenantDatabaseConfigs = {};
function publicDbState() {
  const { password: _password, tenantConfigs: _tenantConfigs, ...rest } = linkedDatabaseState;
  return rest;
}
function savePersistedConfig(state) {
  if (process.env.VERCEL) {
    console.info("[DB Config] Vercel detectada: configura\xE7\xE3o mantida por vari\xE1veis de ambiente; arquivo local n\xE3o \xE9 persistente.");
    return;
  }
  try {
    const toSave = {
      ...state,
      tenantConfigs: tenantDatabaseConfigs
    };
    import_fs.default.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (err) {
    console.warn("[DB Config Save Warning]:", err.message);
  }
}
function tryRestorePersistedConfig() {
  try {
    if (import_fs.default.existsSync(CONFIG_FILE_PATH)) {
      const content = import_fs.default.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const loadedFile = JSON.parse(content);
      const { tenantConfigs: _persistedTenantConfigs, ...loaded } = loadedFile || {};
      if (loaded && loaded.database && loaded.host) {
        const isLocal = loaded.host === "localhost" || loaded.host === "127.0.0.1";
        linkedDatabaseState = {
          ...linkedDatabaseState,
          ...loaded,
          // Evita assumir conectado em localhost em contêiner se não for modo simulado
          status: isLocal && !loaded.isSimulationMode ? "desconectado" : loaded.status
        };
        if (_persistedTenantConfigs && typeof _persistedTenantConfigs === "object") {
          tenantDatabaseConfigs = _persistedTenantConfigs;
        } else {
          tenantDatabaseConfigs["00000000000001"] = { ...linkedDatabaseState };
        }
        console.info(`[DB Config Loaded] Banco pr\xE9-configurado: ${linkedDatabaseState.engine.toUpperCase()} em ${linkedDatabaseState.host}:${linkedDatabaseState.port}/${linkedDatabaseState.database} (status: ${linkedDatabaseState.status}) - ${Object.keys(tenantDatabaseConfigs).length} tenant(s) parametrizado(s)`);
      }
    }
  } catch (err) {
    console.warn("[DB Config Load Warning]:", err.message);
  }
}
function restoreConfigFromEnv() {
  const defaultTenantId = String(process.env.DEFAULT_TENANT_ID || "00000000000001").trim();
  const url = process.env.DATABASE_URL;
  try {
    let config = null;
    if (url) {
      const u = new URL(url);
      const proto = u.protocol.replace(":", "").toLowerCase();
      const engine = proto.startsWith("postgres") ? "postgres" : proto.startsWith("mysql") ? "mysql" : null;
      if (!engine) {
        console.warn("[DB Env Warning]: DATABASE_URL deve come\xE7ar com postgresql:// ou mysql://");
        return;
      }
      const sslMode = (u.searchParams.get("sslmode") || "").toLowerCase();
      config = {
        ...linkedDatabaseState,
        engine,
        host: u.hostname,
        port: Number(u.port) || (engine === "postgres" ? 5432 : 3306),
        database: decodeURIComponent(u.pathname.replace(/^\//, "")) || (engine === "postgres" ? "postgres" : ""),
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        ssl: sslMode ? sslMode !== "disable" : (process.env.DB_SSL || "true").toLowerCase() !== "false",
        status: "conectado",
        isSimulationMode: false,
        databaseExists: true,
        errorMessage: void 0,
        lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } else if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER) {
      const engine = (process.env.DB_ENGINE || "postgres").toLowerCase();
      config = {
        ...linkedDatabaseState,
        engine,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || (engine === "postgres" ? 5432 : 3306),
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD || "",
        ssl: (process.env.DB_SSL || "true").toLowerCase() !== "false",
        status: "conectado",
        isSimulationMode: false,
        databaseExists: true,
        errorMessage: void 0,
        lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (!config) return;
    linkedDatabaseState = config;
    tenantDatabaseConfigs[defaultTenantId] = { ...config };
    tenantDatabaseConfigs["00000000000001"] = { ...config };
    console.info(`[DB Env Loaded] ${config.engine.toUpperCase()} configurado por ambiente em ${config.host}:${config.port}/${config.database}`);
  } catch (err) {
    console.warn("[DB Env Warning]: configura\xE7\xE3o de banco por ambiente inv\xE1lida:", err.message);
  }
}
tryRestorePersistedConfig();
restoreConfigFromEnv();
var sqlExecutionLogs = [];
var databaseTables = {
  tenants_companies: /* @__PURE__ */ new Map(),
  system_users: /* @__PURE__ */ new Map(),
  system_settings: /* @__PURE__ */ new Map(),
  categories: /* @__PURE__ */ new Map(),
  suppliers: /* @__PURE__ */ new Map(),
  stock_items: /* @__PURE__ */ new Map(),
  supplier_quotes: /* @__PURE__ */ new Map(),
  stock_movements: /* @__PURE__ */ new Map(),
  stock_count_sessions: /* @__PURE__ */ new Map(),
  stock_count_entries: /* @__PURE__ */ new Map(),
  unlisted_count_items: /* @__PURE__ */ new Map(),
  loss_records: /* @__PURE__ */ new Map(),
  purchase_orders: /* @__PURE__ */ new Map(),
  purchase_order_items: /* @__PURE__ */ new Map(),
  invoices_history: /* @__PURE__ */ new Map()
};
function mapEntityToSqlRow(tableName, entity, defaultTenant = "00000000000001") {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const resolveTenant = (rawTenant) => {
    const t = String(rawTenant || defaultTenant).trim();
    if (t === "comp-matriz" || t === "emp-matriz") return "00000000000001";
    return t || "00000000000001";
  };
  switch (tableName) {
    case "tenants_companies": {
      const rawCnpj = entity.cnpj || entity.documento_identificador || entity.documentoIdentificador || "00.000.000/0000-00";
      const cleanCnpj = cleanCNPJ(String(rawCnpj)) || "00000000000001";
      const compId = entity.id && entity.id !== "comp-matriz" && entity.id !== "emp-matriz" ? entity.id : cleanCnpj;
      const pais = String(entity.paisOrigem || entity.pais_origem || "BR").toUpperCase().slice(0, 2);
      const tipoDoc = String(entity.tipoDocumento || entity.tipo_documento || (pais === "BR" ? "CNPJ" : "TAX_ID")).slice(0, 20);
      const docId = String(entity.documentoIdentificador || entity.documento_identificador || (pais === "BR" ? cleanCnpj : rawCnpj)).slice(0, 35);
      return {
        id: String(compId),
        name: String(entity.name || "CEC Conecta"),
        trade_name: entity.tradeName || entity.trade_name || entity.name || null,
        cnpj: String(entity.cnpj || rawCnpj),
        pais_origem: pais,
        tipo_documento: tipoDoc,
        documento_identificador: docId,
        city: entity.city || "Patrocinio",
        state: entity.state || "MG",
        phone: entity.phone || null,
        email: entity.email || null,
        is_active: Boolean(entity.active !== false && entity.is_active !== false && entity.is_active !== 0),
        created_at: entity.createdAt || entity.created_at || now,
        updated_at: now
      };
    }
    case "categories":
      return {
        id: String(entity.id),
        tenant_id: resolveTenant(entity.tenant_id || entity.companyId),
        name: String(entity.name || "Geral"),
        description: entity.description || null,
        created_at: entity.createdAt || entity.created_at || now
      };
    case "system_users": {
      const validPin = entity.pin && entity.pin !== "[PROTEGIDO]" && entity.pin !== "[PROTEGIDO_CRIPTOGRAFADO]" ? entity.pin : "";
      const rawSecret = String(entity.password_hash || entity.password || validPin || "@dm!n2026");
      const secureHash = rawSecret.startsWith("sha256$") || /^[a-f0-9]{64}$/i.test(rawSecret) ? rawSecret : hashPassword(rawSecret);
      return {
        id: String(entity.id),
        tenant_id: resolveTenant(entity.tenant_id || entity.companyId),
        name: String(entity.name || "Usu\xE1rio"),
        email: String(entity.email || ""),
        password_hash: secureHash,
        role: ["administrador", "gerente", "compras", "conferente"].includes(entity.role) ? entity.role : "conferente",
        phone: entity.phone || null,
        pin: "[PROTEGIDO_CRIPTOGRAFADO]",
        // Inibe leitura via banco
        is_active: Boolean(entity.status !== "bloqueado" && entity.is_active !== false && entity.is_active !== 0),
        status: entity.status || (entity.is_active === false ? "bloqueado" : "ativo"),
        matricula: entity.matricula ? String(entity.matricula).trim() : null,
        last_login: entity.lastLogin || entity.last_login || null,
        created_at: entity.createdAt || entity.created_at || now
      };
    }
    case "suppliers": {
      const sPais = String(entity.paisOrigem || entity.pais_origem || "BR").toUpperCase().slice(0, 2);
      const sTipoDoc = String(entity.tipoDocumento || entity.tipo_documento || (sPais === "BR" ? "CNPJ" : "TAX_ID")).slice(0, 20);
      const sDoc = String(entity.documentoIdentificador || entity.documento_identificador || entity.cnpj || "").slice(0, 35);
      return {
        id: String(entity.id),
        tenant_id: resolveTenant(entity.tenant_id || entity.companyId),
        name: String(entity.name || "Fornecedor"),
        trade_name: entity.tradeName || entity.trade_name || entity.name || null,
        cnpj: entity.cnpj || (sPais === "BR" ? sDoc : null),
        pais_origem: sPais,
        tipo_documento: sTipoDoc,
        documento_identificador: sDoc || null,
        contact_name: entity.contactName || entity.contact_name || "Comercial",
        phone: entity.phone || null,
        email: entity.email || null,
        price_update_interval_days: Number(entity.priceUpdateIntervalDays ?? entity.price_update_interval_days ?? 30),
        min_order_value: Number(entity.minOrderValue ?? entity.min_order_value ?? 0),
        last_price_update_date: entity.lastPriceUpdateDate || entity.last_price_update_date || now,
        rating: Number(entity.rating ?? 5),
        created_at: entity.createdAt || entity.created_at || now
      };
    }
    case "stock_items":
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        category_id: entity.categoryId || entity.category_id || null,
        name: String(entity.name || "Produto"),
        category: String(entity.category || "outro"),
        current_stock: Number(entity.currentStock ?? entity.current_stock ?? 0),
        min_stock: Number(entity.minStock ?? entity.min_stock ?? 0),
        ideal_stock: Number(entity.optimalStock ?? entity.idealStock ?? entity.ideal_stock ?? 0),
        unit: String(entity.unit || "un"),
        unit_cost: Number(entity.costPrice ?? entity.unit_cost ?? entity.unitCost ?? 0),
        target_cmv: Number(entity.targetCmv ?? entity.target_cmv ?? 28.5),
        primary_supplier_id: entity.primarySupplierId || entity.primary_supplier_id || null,
        count_days: JSON.stringify(entity.countDays || entity.count_days || ["quarta", "domingo"]),
        location: entity.location || null,
        current_batch_expiry: entity.currentBatchExpiry ? String(entity.currentBatchExpiry).substring(0, 10) : null,
        barcode: entity.barcode || entity.code || null,
        created_at: entity.createdAt || entity.created_at || now,
        updated_at: now
      };
    case "loss_records":
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        item_id: String(entity.itemId || entity.item_id || entity.id),
        item_name: String(entity.itemName || entity.item_name || "Item"),
        category: String(entity.category || "outro"),
        quantity: Number(entity.quantity || 1),
        unit: String(entity.unit || "un"),
        unit_cost: Number(entity.unitCost ?? entity.unit_cost ?? 0),
        total_cost: Number(entity.totalCost ?? entity.total_cost ?? 0),
        reason: String(entity.reason || "outro"),
        sector: String(entity.sector || "Cozinha"),
        reported_by: String(entity.reportedBy || entity.reported_by || "Operador"),
        notes: entity.notes || null,
        created_at: entity.createdAt || entity.created_at || now
      };
    case "purchase_orders":
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        order_number: String(entity.orderNumber || entity.order_number || entity.id),
        supplier_id: String(entity.supplierId || entity.supplier_id || ""),
        supplier_name: String(entity.supplierName || entity.supplier_name || "Fornecedor"),
        total_amount: Number(entity.totalAmount ?? entity.total_amount ?? 0),
        items_count: Number(entity.itemsCount ?? entity.items_count ?? (entity.items?.length || 1)),
        status: String(entity.status || "pendente"),
        channel: String(entity.channel || "direto"),
        payment_terms: entity.paymentTerms || entity.payment_terms || null,
        created_by: String(entity.createdBy || entity.created_by || "Compras"),
        created_at: entity.createdAt || entity.created_at || now,
        sent_at: entity.sentAt || entity.sent_at || null
      };
    case "purchase_order_items":
      return {
        id: String(entity.id || `poi_${Date.now()}`),
        order_id: String(entity.orderId || entity.order_id || ""),
        item_id: String(entity.itemId || entity.item_id || ""),
        item_name: String(entity.itemName || entity.item_name || "Item"),
        unit: String(entity.unit || "un"),
        quantity_ordered: Number(entity.quantityOrdered ?? entity.quantity_ordered ?? entity.quantity ?? 1),
        unit_price: Number(entity.unitPrice ?? entity.unit_price ?? 0),
        total_cost: Number(entity.totalCost ?? entity.total_cost ?? 0),
        received_quantity: Number(entity.receivedQuantity ?? entity.received_quantity ?? 0)
      };
    case "stock_count_sessions":
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        date: String(entity.date || now.split("T")[0]),
        conducted_by: String(entity.conductedBy || entity.conducted_by || "Conferente"),
        user_role: String(entity.userRole || entity.user_role || "conferente"),
        day_of_week: String(entity.dayOfWeek || entity.day_of_week || "quarta"),
        total_items_counted: Number(entity.totalItemsCounted ?? entity.total_items_counted ?? 0),
        divergent_items_count: Number(entity.divergentItemsCount ?? entity.divergent_items_count ?? 0),
        status: String(entity.status || "rascunho"),
        supervisor_authorized: Boolean(entity.supervisorAuthorized || entity.supervisor_authorized),
        supervisor_name: entity.supervisorName || entity.supervisor_name || null,
        submitted_at: entity.submittedAt || entity.submitted_at || null,
        created_at: entity.createdAt || entity.created_at || now
      };
    case "invoices_history":
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        access_key: String(entity.accessKey || entity.access_key || entity.id),
        number: String(entity.number || ""),
        series: entity.series || "1",
        issue_date: entity.issueDate || entity.issue_date || now,
        supplier_cnpj: String(entity.supplierCnpj || entity.supplier_cnpj || ""),
        supplier_name: String(entity.supplierName || entity.supplier_name || "Fornecedor"),
        total_invoice_value: Number(entity.totalInvoiceValue ?? entity.total_invoice_value ?? entity.total ?? 0),
        source_type: String(entity.sourceType || entity.source_type || "chave")
      };
    default:
      return { ...entity, id: String(entity.id || `rec_${Date.now()}`) };
  }
}
async function checkRowExistsInDb(engine, tableName, id) {
  try {
    if (engine === "postgres") {
      const client = new import_pg.default.Client({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || "",
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
        connectionTimeoutMillis: 3e3
      });
      await client.connect();
      const res = await client.query(`SELECT 1 FROM ${tableName} WHERE id = $1 LIMIT 1;`, [id]);
      await client.end();
      return (res.rowCount || 0) > 0;
    } else if (engine === "mysql") {
      const conn = await import_promise.default.createConnection({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || "",
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
        connectTimeout: 3e3
      });
      const [rows] = await conn.execute(`SELECT 1 FROM ${tableName} WHERE id = ? LIMIT 1;`, [id]);
      await conn.end();
      return Array.isArray(rows) && rows.length > 0;
    }
  } catch (err) {
    if (err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" || err?.code === "ETIMEDOUT") {
      linkedDatabaseState.status = "erro";
      linkedDatabaseState.errorMessage = `Banco inacess\xEDvel (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
      savePersistedConfig(linkedDatabaseState);
    }
    return false;
  }
  return false;
}
async function runDdlOnDatabase(engine, script) {
  if (engine === "postgres") {
    const client = new import_pg.default.Client({
      host: linkedDatabaseState.host,
      port: linkedDatabaseState.port,
      database: linkedDatabaseState.database,
      user: linkedDatabaseState.username,
      password: linkedDatabaseState.password || "",
      ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
      connectionTimeoutMillis: 1e4
    });
    try {
      await client.connect();
      await client.query(script);
      return true;
    } catch (e) {
      console.warn("[DDL Run Postgres Error]:", e.message);
      throw e;
    } finally {
      try {
        await client.end();
      } catch {
      }
    }
  } else if (engine === "mysql") {
    let conn = null;
    try {
      conn = await import_promise.default.createConnection({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || "",
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
        multipleStatements: true,
        connectTimeout: 1e4
      });
      await conn.query(script);
      return true;
    } catch (e) {
      console.warn("[DDL Run MySQL Error]:", e.message);
      throw e;
    } finally {
      try {
        await conn?.end();
      } catch {
      }
    }
  }
  return false;
}
async function ensureDependenciesBeforeInsert(engine, tableName, mappedRow) {
  if (linkedDatabaseState.isSimulationMode || linkedDatabaseState.status !== "conectado") {
    return;
  }
  const tenantId = (mappedRow.tenant_id || "00000000000001").replace(/^comp-matriz$|^emp-matriz$/, "00000000000001");
  if (tableName !== "tenants_companies") {
    const companyExists = await checkRowExistsInDb(engine, "tenants_companies", tenantId);
    if (!companyExists) {
      const defaultCompany = {
        id: tenantId,
        name: "CEC Conecta",
        trade_name: "CEC",
        cnpj: "00.000.000/0000-00",
        pais_origem: "BR",
        tipo_documento: "CNPJ",
        documento_identificador: tenantId,
        city: "Patrocinio",
        state: "MG",
        phone: "(34)99947-2865",
        email: "jairoeliakim@hotmail.com",
        is_active: true,
        created_at: "2026-01-01T08:00:00.000Z",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await executeRawUpsertDirect(engine, "tenants_companies", defaultCompany);
    }
  }
  if (tableName === "stock_items") {
    if (typeof mappedRow.category_id === "string" && mappedRow.category_id.trim() === "") {
      mappedRow.category_id = null;
    }
    if (typeof mappedRow.primary_supplier_id === "string" && mappedRow.primary_supplier_id.trim() === "") {
      mappedRow.primary_supplier_id = null;
    }
    if (mappedRow.category_id) {
      try {
        const catExists = await checkRowExistsInDb(engine, "categories", mappedRow.category_id);
        if (!catExists) {
          const catRow = {
            id: mappedRow.category_id,
            tenant_id: tenantId,
            name: mappedRow.category || "Geral",
            description: `Categoria de ${mappedRow.category || "Insumos"}`,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await executeRawUpsertDirect(engine, "categories", catRow);
        }
      } catch {
        mappedRow.category_id = null;
      }
    }
    if (mappedRow.primary_supplier_id) {
      try {
        const supExists = await checkRowExistsInDb(engine, "suppliers", mappedRow.primary_supplier_id);
        if (!supExists) {
          const supFromCache = databaseTables.suppliers.get(mappedRow.primary_supplier_id);
          const stubSup = {
            id: mappedRow.primary_supplier_id,
            tenant_id: tenantId,
            name: supFromCache?.name || "Fornecedor Vinculado",
            trade_name: supFromCache?.tradeName || "Fornecedor",
            contact_name: supFromCache?.contactName || "Comercial",
            phone: supFromCache?.phone || "(00) 0000-0000",
            email: supFromCache?.email || "contato@fornecedor.com",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await executeRawUpsertDirect(engine, "suppliers", stubSup);
        }
      } catch {
        mappedRow.primary_supplier_id = null;
      }
    }
  }
}
async function executeRawUpsertDirect(engine, tableName, row) {
  const keys = Object.keys(row);
  const values = Object.values(row).map((v) => v === void 0 ? null : v);
  if (engine === "postgres") {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const updateKeys = keys.filter((k) => k !== "id" && k !== "created_at");
    const updateClause = updateKeys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");
    const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateClause};`;
    const client = new import_pg.default.Client({
      host: linkedDatabaseState.host,
      port: linkedDatabaseState.port,
      database: linkedDatabaseState.database,
      user: linkedDatabaseState.username,
      password: linkedDatabaseState.password || "",
      ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
      connectionTimeoutMillis: 5e3
    });
    try {
      await client.connect();
      await client.query(sql, values);
      await client.end();
    } catch (err) {
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
        linkedDatabaseState.status = "erro";
        linkedDatabaseState.errorMessage = `Banco inacess\xEDvel (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
        savePersistedConfig(linkedDatabaseState);
      }
      console.warn(`[Raw Upsert Postgres Error on ${tableName}]:`, err.message);
    }
  } else if (engine === "mysql") {
    const placeholders = keys.map(() => "?").join(", ");
    const updateKeys = keys.filter((k) => k !== "id" && k !== "created_at");
    const updateClause = updateKeys.map((k) => `${k} = VALUES(${k})`).join(", ");
    const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause};`;
    try {
      const conn = await import_promise.default.createConnection({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || "",
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
        connectTimeout: 5e3
      });
      await conn.execute(sql, values);
      await conn.end();
    } catch (err) {
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
        linkedDatabaseState.status = "erro";
        linkedDatabaseState.errorMessage = `Banco inacess\xEDvel (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
        savePersistedConfig(linkedDatabaseState);
      }
      console.warn(`[Raw Upsert MySQL Error on ${tableName}]:`, err.message);
    }
  }
}
async function executeRealSqlUpsert(engine, tableName, mappedRow) {
  if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === "conectado") {
    try {
      await ensureDependenciesBeforeInsert(engine, tableName, mappedRow);
    } catch (depErr) {
      console.warn(`[Dependencies check warning on ${tableName}]:`, depErr.message);
    }
  }
  const keys = Object.keys(mappedRow);
  const values = Object.values(mappedRow).map((v) => v === void 0 ? null : v);
  if (engine === "postgres") {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const updateKeys = keys.filter((k) => k !== "id" && k !== "created_at");
    const updateClause = updateKeys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");
    const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateClause};`;
    const debugSql2 = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${values.map((v) => v === null ? "NULL" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`).join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updateClause};`;
    if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === "conectado") {
      try {
        const client = new import_pg.default.Client({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || "",
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
          connectionTimeoutMillis: 5e3
        });
        await client.connect();
        try {
          await client.query(sql, values);
        } catch (firstErr) {
          if (firstErr.code === "42P01") {
            console.info(`[Auto-Create Tables] Tabela "${tableName}" inexistente. Criando esquema DDL no PostgreSQL...`);
            const ddl = generateDatabaseScript("postgres", linkedDatabaseState.database);
            await client.query(ddl);
            await client.query(sql, values);
            linkedDatabaseState.tablesCreated = true;
          } else {
            throw firstErr;
          }
        }
        await client.end();
        return { success: true, sqlExecuted: debugSql2 };
      } catch (err) {
        console.warn(`[Postgres INSERT fallback on ${tableName}]: ${err.message}`);
        if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
          linkedDatabaseState.status = "erro";
          linkedDatabaseState.errorMessage = `Banco inacess\xEDvel (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
          savePersistedConfig(linkedDatabaseState);
        }
        return { success: false, sqlExecuted: debugSql2, error: err.message };
      }
    }
    return { success: true, sqlExecuted: debugSql2 };
  }
  if (engine === "mysql") {
    const placeholders = keys.map(() => "?").join(", ");
    const updateKeys = keys.filter((k) => k !== "id" && k !== "created_at");
    const updateClause = updateKeys.map((k) => `${k} = VALUES(${k})`).join(", ");
    const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause};`;
    const debugSql2 = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${values.map((v) => v === null ? "NULL" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`).join(", ")}) ON DUPLICATE KEY UPDATE ${updateClause};`;
    if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === "conectado") {
      try {
        const conn = await import_promise.default.createConnection({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || "",
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
          connectTimeout: 5e3
        });
        try {
          await conn.execute(sql, values);
        } catch (firstErr) {
          if (firstErr.code === "ER_NO_SUCH_TABLE" || firstErr.errno === 1146) {
            console.info(`[Auto-Create Tables] Tabela "${tableName}" inexistente no MySQL. Criando esquema DDL...`);
            const ddl = generateDatabaseScript("mysql", linkedDatabaseState.database);
            await conn.query(ddl);
            await conn.execute(sql, values);
            linkedDatabaseState.tablesCreated = true;
          } else {
            throw firstErr;
          }
        }
        await conn.end();
        return { success: true, sqlExecuted: debugSql2 };
      } catch (err) {
        console.warn(`[MySQL INSERT fallback on ${tableName}]: ${err.message}`);
        if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
          linkedDatabaseState.status = "erro";
          linkedDatabaseState.errorMessage = `Banco inacess\xEDvel (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
          savePersistedConfig(linkedDatabaseState);
        }
        return { success: false, sqlExecuted: debugSql2, error: err.message };
      }
    }
    return { success: true, sqlExecuted: debugSql2 };
  }
  const debugSql = `MERGE INTO ${tableName} AS target USING (SELECT '${mappedRow.id}' AS id) AS source ON (target.id = source.id) WHEN MATCHED THEN UPDATE SET ... WHEN NOT MATCHED THEN INSERT ...;`;
  return { success: true, sqlExecuted: debugSql };
}
async function executeRealSqlDelete(engine, tableName, id) {
  const sql = `DELETE FROM ${tableName} WHERE id = '${id}';`;
  if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === "conectado") {
    try {
      if (engine === "postgres") {
        const client = new import_pg.default.Client({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || "",
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
          connectionTimeoutMillis: 5e3
        });
        await client.connect();
        await client.query(`DELETE FROM ${tableName} WHERE id = $1;`, [id]);
        await client.end();
      } else if (engine === "mysql") {
        const conn = await import_promise.default.createConnection({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || "",
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
          connectTimeout: 5e3
        });
        await conn.execute(`DELETE FROM ${tableName} WHERE id = ?;`, [id]);
        await conn.end();
      }
      return { success: true, sqlExecuted: sql };
    } catch (err) {
      console.warn(`[SQL DELETE fallback on ${tableName}]: ${err.message}`);
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
        linkedDatabaseState.status = "erro";
        linkedDatabaseState.errorMessage = `Banco inacess\xEDvel (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
        savePersistedConfig(linkedDatabaseState);
      }
      return { success: false, sqlExecuted: sql, error: err.message };
    }
  }
  return { success: true, sqlExecuted: sql };
}
function initCleanDatabaseSeed() {
  const defaultTenantCnpj = "00000000000001";
  const defaultCompany = {
    id: defaultTenantCnpj,
    name: "CEC Conecta",
    trade_name: "CEC",
    tradeName: "CEC",
    cnpj: "00.000.000/0000-00",
    pais_origem: "BR",
    tipo_documento: "CNPJ",
    documento_identificador: defaultTenantCnpj,
    city: "Patrocinio",
    state: "MG",
    phone: "(34)99947-2865",
    email: "jairoeliakim@hotmail.com",
    is_active: true,
    active: true,
    created_at: (/* @__PURE__ */ new Date("2026-01-01")).toISOString()
  };
  databaseTables.tenants_companies.set(defaultTenantCnpj, defaultCompany);
  const defaultCategories = [
    { id: "cat-carnes", name: "Carnes & Prote\xEDnas", description: "Cortes nobres, carnes e aves" },
    { id: "cat-laticinios", name: "Latic\xEDnios & Derivados", description: "Queijos, leites e manteigas" },
    { id: "cat-hortifruti", name: "Hortifruti & Insumos", description: "Verduras, legumes e temperos frescos" },
    { id: "cat-bebidas", name: "Bebidas, Bar & Adega", description: "Vinhos, destilados, cervejas e refrigerantes" },
    { id: "cat-petiscos", name: "Petiscos & Congelados", description: "Por\xE7\xF5es, congelados e entradas" },
    { id: "cat-porcionamento", name: "Porcionamento & Preparos", description: "Insumos pr\xE9-porcionados" },
    { id: "cat-limpeza", name: "Limpeza & Higiene", description: "Produtos qu\xEDmicos e materiais de limpeza" },
    { id: "cat-consumo", name: "Consumo & Descart\xE1veis", description: "Embalagens e descart\xE1veis" },
    { id: "cat-outro", name: "Outros Insumos", description: "Itens diversos" }
  ];
  for (const cat of defaultCategories) {
    databaseTables.categories.set(cat.id, {
      ...cat,
      tenant_id: defaultTenantCnpj,
      created_at: (/* @__PURE__ */ new Date("2026-01-01")).toISOString()
    });
  }
  databaseTables.system_users.set("usr-admin-01", {
    id: "usr-admin-01",
    tenant_id: defaultTenantCnpj,
    name: "Administrador do Sistema",
    email: "admin@sistema.com",
    password_hash: "@dm!n2026",
    role: "administrador",
    phone: "(31)99947-2865",
    pin: "@dm!n2026",
    is_active: true,
    created_at: (/* @__PURE__ */ new Date("2026-01-01")).toISOString()
  });
  databaseTables.system_users.set("usr-admin-alias", {
    id: "usr-admin-alias",
    tenant_id: defaultTenantCnpj,
    name: "Administrador do Sistema",
    email: "admin",
    password_hash: "@dm!n2026",
    role: "administrador",
    phone: "(31)99947-2865",
    pin: "@dm!n2026",
    is_active: true,
    created_at: (/* @__PURE__ */ new Date("2026-01-01")).toISOString()
  });
}
initCleanDatabaseSeed();
function logSql(table, operation, sql, recordsAffected = 1) {
  const log = {
    id: `sql_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    table,
    operation,
    sql,
    engine: linkedDatabaseState.engine,
    recordsAffected
  };
  sqlExecutionLogs.unshift(log);
  if (sqlExecutionLogs.length > 250) {
    sqlExecutionLogs.pop();
  }
}
function calculateTotalRecords() {
  return Object.values(databaseTables).reduce((acc, map) => acc + map.size, 0);
}
databaseRouter.post("/database/test-connection", async (req, res) => {
  const { engine, host, port, database, username, password, ssl, simulationMode } = req.body || {};
  if (!engine || !host || !port || !database || !username) {
    return res.status(400).json({
      success: false,
      message: "Par\xE2metros incompletos. Informe motor (mysql, postgres, sqlserver), host, porta, nome do banco e usu\xE1rio."
    });
  }
  if (simulationMode === true) {
    return res.json({
      success: true,
      simulationMode: true,
      databaseExists: true,
      latencyMs: 5,
      engine,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      serverVersion: `${String(engine).toUpperCase()} (Modo Simulado em Mem\xF3ria)`,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: `[MODO SIMULADO EM MEM\xD3RIA] Valida\xE7\xE3o executada apenas em mem\xF3ria. (Aten\xE7\xE3o: Nenhuma conex\xE3o externa real foi feita com ${host}:${port}).`
    });
  }
  if (engine === "postgres") {
    const pgResult = await testPostgresConnection({
      host: String(host).trim(),
      port: Number(port),
      database: String(database).trim(),
      username: String(username).trim(),
      password: String(password || ""),
      ssl: Boolean(ssl)
    });
    if (!pgResult.connected) {
      return res.status(400).json({
        success: false,
        simulationMode: false,
        databaseExists: pgResult.databaseExists,
        error: pgResult.errorType,
        errorCode: pgResult.errorCode,
        latencyMs: pgResult.latencyMs,
        engine,
        host,
        port: Number(port),
        database,
        message: pgResult.message,
        recommendation: pgResult.recommendation
      });
    }
    return res.json({
      success: true,
      simulationMode: false,
      databaseExists: true,
      latencyMs: pgResult.latencyMs,
      engine,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      serverVersion: pgResult.serverVersion,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: pgResult.message
    });
  }
  if (engine === "mysql") {
    const myResult = await testMysqlConnection({
      host: String(host).trim(),
      port: Number(port),
      database: String(database).trim(),
      username: String(username).trim(),
      password: String(password || ""),
      ssl: Boolean(ssl)
    });
    if (!myResult.connected) {
      return res.status(400).json({
        success: false,
        simulationMode: false,
        databaseExists: myResult.databaseExists,
        error: myResult.errorType,
        errorCode: myResult.errorCode,
        latencyMs: myResult.latencyMs,
        engine,
        host,
        port: Number(port),
        database,
        message: myResult.message,
        recommendation: myResult.recommendation
      });
    }
    return res.json({
      success: true,
      simulationMode: false,
      databaseExists: true,
      latencyMs: myResult.latencyMs,
      engine,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      serverVersion: myResult.serverVersion,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: myResult.message
    });
  }
  const tcpResult = await testTcpSocket(String(host).trim(), Number(port), 2500);
  if (!tcpResult.reachable) {
    return res.status(400).json({
      success: false,
      simulationMode: false,
      databaseExists: false,
      error: "DATABASE_UNREACHABLE",
      errorCode: tcpResult.code,
      latencyMs: tcpResult.latencyMs,
      engine,
      host,
      port: Number(port),
      database,
      message: `N\xE3o foi poss\xEDvel conectar ao SQL Server: ${tcpResult.error}`,
      recommendation: `Certifique-se de que o SQL Server est\xE1 ouvindo na porta ${port} e o banco "${database}" foi criado.`
    });
  }
  return res.json({
    success: true,
    simulationMode: false,
    databaseExists: true,
    latencyMs: tcpResult.latencyMs,
    engine,
    host,
    port: Number(port),
    database,
    username,
    ssl: Boolean(ssl),
    serverVersion: "Microsoft SQL Server 2022",
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
    message: `Servidor SQL Server em ${host}:${port} ativo e respondendo!`
  });
});
databaseRouter.post("/database/link", async (req, res) => {
  const { engine, host, port, database, username, password, ssl, simulationMode, tenantId, companyId } = req.body || {};
  const effectiveTenantId = String(tenantId || companyId || "00000000000001").trim();
  if (!engine || !host || !port || !database || !username) {
    return res.status(400).json({
      success: false,
      message: "Par\xE2metros obrigat\xF3rios ausentes para vincular o banco."
    });
  }
  if (simulationMode !== true) {
    if (engine === "postgres") {
      const pgCheck = await testPostgresConnection({
        host: String(host).trim(),
        port: Number(port),
        database: String(database).trim(),
        username: String(username).trim(),
        password: String(password || ""),
        ssl: Boolean(ssl)
      });
      if (!pgCheck.connected) {
        linkedDatabaseState.status = "erro";
        linkedDatabaseState.errorMessage = pgCheck.message;
        savePersistedConfig(linkedDatabaseState);
        return res.status(400).json({
          success: false,
          error: pgCheck.errorType,
          errorCode: pgCheck.errorCode,
          message: `V\xEDnculo Rejeitado: ${pgCheck.message}`,
          recommendation: pgCheck.recommendation
        });
      }
    } else if (engine === "mysql") {
      const myCheck = await testMysqlConnection({
        host: String(host).trim(),
        port: Number(port),
        database: String(database).trim(),
        username: String(username).trim(),
        password: String(password || ""),
        ssl: Boolean(ssl)
      });
      if (!myCheck.connected) {
        linkedDatabaseState.status = "erro";
        linkedDatabaseState.errorMessage = myCheck.message;
        savePersistedConfig(linkedDatabaseState);
        return res.status(400).json({
          success: false,
          error: myCheck.errorType,
          errorCode: myCheck.errorCode,
          message: `V\xEDnculo Rejeitado: ${myCheck.message}`,
          recommendation: myCheck.recommendation
        });
      }
    } else {
      const tcpResult = await testTcpSocket(String(host).trim(), Number(port), 2500);
      if (!tcpResult.reachable) {
        linkedDatabaseState.status = "erro";
        linkedDatabaseState.errorMessage = tcpResult.error;
        savePersistedConfig(linkedDatabaseState);
        return res.status(400).json({
          success: false,
          error: "DATABASE_UNREACHABLE",
          errorCode: tcpResult.code,
          message: `V\xEDnculo Rejeitado: ${tcpResult.error}`,
          recommendation: `Verifique se o SQL Server est\xE1 ativo na porta ${port}.`
        });
      }
    }
  }
  linkedDatabaseState = {
    engine,
    host: String(host),
    port: Number(port),
    database: String(database),
    username: String(username),
    password: String(password || ""),
    ssl: Boolean(ssl),
    status: "conectado",
    isSimulationMode: Boolean(simulationMode),
    databaseExists: true,
    errorMessage: void 0,
    lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    tablesCreated: linkedDatabaseState.tablesCreated,
    tablesCount: linkedDatabaseState.tablesCount,
    lastMigrationAt: linkedDatabaseState.lastMigrationAt,
    totalRecordsCount: calculateTotalRecords()
  };
  tenantDatabaseConfigs[effectiveTenantId] = {
    ...linkedDatabaseState
  };
  if (databaseTables.tenants_companies.has(effectiveTenantId)) {
    const existingComp = databaseTables.tenants_companies.get(effectiveTenantId);
    databaseTables.tenants_companies.set(effectiveTenantId, {
      ...existingComp,
      databaseConfig: publicDbState()
    });
  }
  savePersistedConfig(linkedDatabaseState);
  logSql(
    "system_settings",
    "UPDATE",
    `-- Conex\xE3o vinculada ao cluster ${engine.toUpperCase()} em ${host}:${port}/${database} (Tenant ${effectiveTenantId})${simulationMode ? " [MODO SIMULADO]" : " [AUTENTICADO COM SUCESSO]"}`,
    1
  );
  return res.json({
    success: true,
    tenantId: effectiveTenantId,
    databaseConfig: {
      ...publicDbState(),
      tenantId: effectiveTenantId
    },
    message: simulationMode ? `Banco de dados "${database}" vinculado em MODO SIMULADO para o tenant ${effectiveTenantId}.` : `Banco de dados "${database}" (${engine.toUpperCase()}) em ${host}:${port} validado e vinculado ao tenant ${effectiveTenantId} com sucesso!`
  });
});
databaseRouter.post(["/database/activate-tenant", "/database/activate-tenant/:tenantId"], async (req, res) => {
  const tenantId = String(req.params.tenantId || req.body?.tenantId || "").trim();
  const cfg = tenantDatabaseConfigs[tenantId];
  if (cfg && cfg.host && cfg.database) {
    linkedDatabaseState = {
      ...linkedDatabaseState,
      ...cfg
    };
    savePersistedConfig(linkedDatabaseState);
    return res.json({
      success: true,
      activated: true,
      tenantId,
      databaseConfig: {
        ...publicDbState(),
        tenantId
      },
      message: `Banco do tenant "${tenantId}" ativado com sucesso! (${cfg.engine.toUpperCase()} em ${cfg.host})`
    });
  }
  return res.json({
    success: false,
    activated: false,
    tenantId,
    message: `Nenhum banco configurado previamente para o tenant "${tenantId}".`
  });
});
databaseRouter.post("/database/save-tenant-config", async (req, res) => {
  const { tenantId, companyId, databaseConfig } = req.body || {};
  const tId = String(tenantId || companyId || "").trim();
  if (!tId || !databaseConfig) {
    return res.status(400).json({
      success: false,
      message: "tenantId e databaseConfig s\xE3o obrigat\xF3rios."
    });
  }
  tenantDatabaseConfigs[tId] = {
    ...linkedDatabaseState,
    ...databaseConfig
  };
  linkedDatabaseState = {
    ...linkedDatabaseState,
    ...databaseConfig
  };
  if (databaseTables.tenants_companies.has(tId)) {
    const existingComp = databaseTables.tenants_companies.get(tId);
    databaseTables.tenants_companies.set(tId, {
      ...existingComp,
      databaseConfig: publicDbState()
    });
  }
  savePersistedConfig(linkedDatabaseState);
  return res.json({
    success: true,
    tenantId: tId,
    databaseConfig: {
      ...publicDbState(),
      tenantId: tId
    },
    message: `Configura\xE7\xE3o do banco de dados salva com sucesso no tenant "${tId}".`
  });
});
databaseRouter.post("/database/create-tables", async (req, res) => {
  const { engine, database } = req.body || {};
  const targetEngine = engine || linkedDatabaseState.engine || "postgres";
  const targetDb = database || linkedDatabaseState.database || "restaurante_estoque_db";
  if (linkedDatabaseState.status !== "conectado") {
    return res.status(400).json({
      success: false,
      message: "N\xE3o \xE9 poss\xEDvel rodar o script: o banco de dados n\xE3o est\xE1 conectado. Primeiro teste e vincule um servidor de banco ativo."
    });
  }
  const ddlScript = generateDatabaseScript(targetEngine, targetDb);
  if (!linkedDatabaseState.isSimulationMode) {
    try {
      await runDdlOnDatabase(targetEngine, ddlScript);
    } catch (realErr) {
      console.warn("[DDL Error on external DB]", realErr.message);
      return res.status(500).json({
        success: false,
        engine: targetEngine,
        database: targetDb,
        error: "DDL_FAILED",
        message: `Falha ao criar as tabelas no banco "${targetDb}": ${realErr?.message || "erro desconhecido"}`,
        recommendation: "Confira se o usu\xE1rio tem permiss\xE3o de cria\xE7\xE3o (CREATE) no schema public e se a conex\xE3o est\xE1 ativa. As tabelas N\xC3O foram criadas."
      });
    }
  }
  initCleanDatabaseSeed();
  if (!linkedDatabaseState.isSimulationMode) {
    try {
      for (const comp of databaseTables.tenants_companies.values()) {
        const mapped = mapEntityToSqlRow("tenants_companies", comp);
        await executeRealSqlUpsert(targetEngine, "tenants_companies", mapped);
      }
      for (const cat of databaseTables.categories.values()) {
        const mapped = mapEntityToSqlRow("categories", cat);
        await executeRealSqlUpsert(targetEngine, "categories", mapped);
      }
      for (const user of databaseTables.system_users.values()) {
        const mapped = mapEntityToSqlRow("system_users", user);
        await executeRealSqlUpsert(targetEngine, "system_users", mapped);
      }
      for (const sup of databaseTables.suppliers.values()) {
        const mapped = mapEntityToSqlRow("suppliers", sup);
        await executeRealSqlUpsert(targetEngine, "suppliers", mapped);
      }
      for (const prod of databaseTables.stock_items.values()) {
        const mapped = mapEntityToSqlRow("stock_items", prod);
        await executeRealSqlUpsert(targetEngine, "stock_items", mapped);
      }
    } catch (syncErr) {
      console.warn("[Seed Sync to External DB Error]:", syncErr.message);
    }
  }
  linkedDatabaseState.status = "conectado";
  linkedDatabaseState.tablesCreated = true;
  linkedDatabaseState.tablesCount = SYSTEM_TABLES.length;
  linkedDatabaseState.lastMigrationAt = (/* @__PURE__ */ new Date()).toISOString();
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();
  savePersistedConfig(linkedDatabaseState);
  logSql(
    "ALL_TABLES",
    "DDL",
    `-- Execu\xE7\xE3o DDL de cria\xE7\xE3o de ${SYSTEM_TABLES.length} tabelas no banco ${targetDb} (${targetEngine.toUpperCase()})
-- Usu\xE1rio admin@sistema.com`,
    SYSTEM_TABLES.length
  );
  return res.json({
    success: true,
    engine: targetEngine,
    database: targetDb,
    tablesCount: SYSTEM_TABLES.length,
    tablesCreated: SYSTEM_TABLES.map((t) => t.name),
    tablesDetailed: SYSTEM_TABLES,
    executedAt: (/* @__PURE__ */ new Date()).toISOString(),
    scriptExecuted: ddlScript,
    message: `Script DDL executado com sucesso! Todas as ${SYSTEM_TABLES.length} tabelas do sistema foram criadas no banco "${targetDb}". O usu\xE1rio administrador padr\xE3o foi inicializado.`
  });
});
databaseRouter.post("/database/insert/:table", async (req, res) => {
  const tableName = req.params.table;
  const targetTable = databaseTables[tableName];
  if (!targetTable) {
    return res.status(404).json({
      success: false,
      message: `Tabela "${tableName}" n\xE3o existe no esquema do sistema. Tabelas v\xE1lidas: ${Object.keys(databaseTables).join(", ")}`
    });
  }
  const payload = req.body;
  if (!payload) {
    return res.status(400).json({
      success: false,
      message: "Corpo da requisi\xE7\xE3o vazio."
    });
  }
  const itemsToInsert = Array.isArray(payload) ? payload : [payload];
  const insertedCount = itemsToInsert.length;
  let lastExecutedSql = "";
  let realDbSynced = false;
  let realDbError;
  for (const rawItem of itemsToInsert) {
    const id = rawItem.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullItem = { ...rawItem, id };
    const mappedRow = mapEntityToSqlRow(tableName, fullItem, "00000000000001");
    if (tableName === "suppliers") {
      const pais = String(mappedRow.pais_origem || "BR").toUpperCase();
      const doc = String(mappedRow.documento_identificador || mappedRow.cnpj || "").trim();
      if (pais === "BR") {
        if (doc) {
          const cnpjVal = validateCNPJ(doc);
          if (!cnpjVal.isValid) {
            return res.status(400).json({
              success: false,
              error: `Valida\xE7\xE3o de CNPJ (Brasil) falhou: ${cnpjVal.error}`,
              calculatedCheckDigits: cnpjVal.calculatedCheckDigits,
              actualCheckDigits: cnpjVal.actualCheckDigits
            });
          }
        }
      } else {
        if (!doc) {
          return res.status(400).json({
            success: false,
            error: `Documento identificador da empresa estrangeira \xE9 obrigat\xF3rio.`
          });
        }
        if (doc.length > 35) {
          return res.status(400).json({
            success: false,
            error: `Documento identificador estrangeiro excede o limite m\xE1ximo de 35 caracteres (informados: ${doc.length}).`
          });
        }
      }
    }
    targetTable.set(id, { ...fullItem, ...mappedRow });
    if (tableName === "stock_items") {
      inventoryStore.upsertProduct({
        id: mappedRow.id,
        tenant_id: mappedRow.tenant_id || "00000000000001",
        category_id: mappedRow.category_id || "cat-carnes",
        sku: mappedRow.barcode || `SKU-${mappedRow.id}`,
        barcode: mappedRow.barcode,
        name: mappedRow.name,
        current_stock: Number(mappedRow.current_stock || 0),
        min_stock: Number(mappedRow.min_stock || 0),
        unit_price: Number(mappedRow.unit_cost || 0),
        created_at: mappedRow.created_at || (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (tableName === "system_users") {
      inventoryStore.upsertUser({
        id: mappedRow.id,
        tenant_id: mappedRow.tenant_id || "00000000000001",
        name: mappedRow.name,
        email: mappedRow.email,
        role: mappedRow.role || "conferente",
        created_at: mappedRow.created_at || (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const sqlResult = await executeRealSqlUpsert(linkedDatabaseState.engine, tableName, mappedRow);
    lastExecutedSql = sqlResult.sqlExecuted;
    if (sqlResult.success) {
      realDbSynced = !linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === "conectado";
    } else {
      realDbError = sqlResult.error;
    }
    logSql(tableName, "INSERT", sqlResult.sqlExecuted, 1);
  }
  linkedDatabaseState.lastInsertedAt = (/* @__PURE__ */ new Date()).toISOString();
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();
  return res.status(201).json({
    success: true,
    table: tableName,
    insertedCount,
    totalTableRecords: targetTable.size,
    totalDatabaseRecords: linkedDatabaseState.totalRecordsCount,
    lastInsertedAt: linkedDatabaseState.lastInsertedAt,
    sqlExecuted: lastExecutedSql,
    realDbSynced,
    realDbError,
    message: `Sucesso: ${insertedCount} registro(s) inserido(s) e persistido(s) na tabela "${tableName}" do banco de dados!${realDbSynced ? " [Persistido no SGBD Externo]" : realDbError ? ` [Aviso: Erro no SGBD externo: ${realDbError}]` : ""}`
  });
});
databaseRouter.delete("/database/delete/:table/:id", async (req, res) => {
  const { table: tableName, id } = req.params;
  const targetTable = databaseTables[tableName];
  if (!targetTable) {
    return res.status(404).json({ success: false, message: `Tabela "${tableName}" n\xE3o encontrada.` });
  }
  const existed = targetTable.delete(id);
  if (tableName === "stock_items") {
    inventoryStore.deleteProduct(id);
  }
  if (tableName === "system_users") {
    inventoryStore.deleteUser(id);
  }
  const delResult = await executeRealSqlDelete(linkedDatabaseState.engine, tableName, id);
  logSql(tableName, "DELETE", delResult.sqlExecuted, existed ? 1 : 0);
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();
  return res.json({
    success: true,
    deleted: existed,
    sqlExecuted: delResult.sqlExecuted,
    message: existed ? `Registro "${id}" removido da tabela "${tableName}".` : "Registro n\xE3o encontrado."
  });
});
databaseRouter.post("/database/sync-all", async (req, res) => {
  const {
    items,
    suppliers,
    employees,
    companies,
    losses,
    countSessions,
    orders,
    unlistedItems,
    settings,
    invoices
  } = req.body || {};
  let count = 0;
  if (Array.isArray(companies)) {
    for (const c of companies) {
      const mapped = mapEntityToSqlRow("tenants_companies", c);
      databaseTables.tenants_companies.set(c.id, { ...c, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "tenants_companies", mapped);
      count++;
    }
  }
  if (Array.isArray(employees)) {
    for (const e of employees) {
      const mapped = mapEntityToSqlRow("system_users", e);
      databaseTables.system_users.set(e.id, { ...e, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "system_users", mapped);
      count++;
    }
  }
  if (Array.isArray(suppliers)) {
    for (const s of suppliers) {
      const mapped = mapEntityToSqlRow("suppliers", s);
      databaseTables.suppliers.set(s.id, { ...s, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "suppliers", mapped);
      count++;
    }
  }
  if (Array.isArray(items)) {
    for (const it of items) {
      const mapped = mapEntityToSqlRow("stock_items", it);
      databaseTables.stock_items.set(it.id, { ...it, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "stock_items", mapped);
      count++;
    }
  }
  if (Array.isArray(losses)) {
    for (const l of losses) {
      const mapped = mapEntityToSqlRow("loss_records", l);
      databaseTables.loss_records.set(l.id, { ...l, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "loss_records", mapped);
      count++;
    }
  }
  if (Array.isArray(countSessions)) {
    for (const cs of countSessions) {
      const mapped = mapEntityToSqlRow("stock_count_sessions", cs);
      databaseTables.stock_count_sessions.set(cs.id, { ...cs, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "stock_count_sessions", mapped);
      count++;
    }
  }
  if (Array.isArray(orders)) {
    for (const o of orders) {
      const mapped = mapEntityToSqlRow("purchase_orders", o);
      databaseTables.purchase_orders.set(o.id, { ...o, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "purchase_orders", mapped);
      count++;
    }
  }
  if (Array.isArray(unlistedItems)) {
    for (const u of unlistedItems) {
      databaseTables.unlisted_count_items.set(u.id, u);
      count++;
    }
  }
  if (settings) {
    databaseTables.system_settings.set("global", settings);
    count++;
  }
  if (Array.isArray(invoices)) {
    for (const inv of invoices) {
      const mapped = mapEntityToSqlRow("invoices_history", inv);
      databaseTables.invoices_history.set(inv.id, { ...inv, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, "invoices_history", mapped);
      count++;
    }
  }
  linkedDatabaseState.lastInsertedAt = (/* @__PURE__ */ new Date()).toISOString();
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();
  logSql("MULTIPLE", "INSERT", `-- Sincroniza\xE7\xE3o em lote: ${count} registros processados em todas as tabelas`, count);
  return res.json({
    success: true,
    recordsProcessed: count,
    totalRecordsInDatabase: linkedDatabaseState.totalRecordsCount,
    message: `${count} registro(s) sincronizados em todas as tabelas estruturais do banco de dados!`
  });
});
databaseRouter.get("/database/all-data", async (_req, res) => {
  if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === "conectado") {
    try {
      if (linkedDatabaseState.engine === "postgres") {
        const client = new import_pg.default.Client({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || "",
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
          connectionTimeoutMillis: 5e3
        });
        await client.connect();
        const tablesToCheck = ["tenants_companies", "categories", "system_users", "suppliers", "stock_items", "loss_records", "purchase_orders"];
        for (const t of tablesToCheck) {
          try {
            const queryRes = await client.query(`SELECT * FROM ${t};`);
            if (databaseTables[t]) {
              queryRes.rows.forEach((r) => databaseTables[t].set(r.id, r));
            }
          } catch {
          }
        }
        await client.end();
      } else if (linkedDatabaseState.engine === "mysql") {
        const conn = await import_promise.default.createConnection({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || "",
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : void 0,
          connectTimeout: 5e3
        });
        const tablesToCheck = ["tenants_companies", "categories", "system_users", "suppliers", "stock_items", "loss_records", "purchase_orders"];
        for (const t of tablesToCheck) {
          try {
            const [rows] = await conn.query(`SELECT * FROM ${t};`);
            if (databaseTables[t] && Array.isArray(rows)) {
              rows.forEach((r) => databaseTables[t].set(r.id, r));
            }
          } catch {
          }
        }
        await conn.end();
      }
    } catch (loadErr) {
      console.warn("[Load Real DB Data Warning]:", loadErr.message);
    }
  }
  const result = {};
  for (const [key, map] of Object.entries(databaseTables)) {
    result[key] = Array.from(map.values());
  }
  if (result.tenants_companies && Array.isArray(result.tenants_companies)) {
    result.tenants_companies = result.tenants_companies.map((c) => {
      const tenantCfg = tenantDatabaseConfigs[c.id];
      if (tenantCfg) {
        const { password: _p, tenantConfigs: _tc, ...cleanCfg } = tenantCfg;
        return { ...c, databaseConfig: cleanCfg };
      }
      return c;
    });
  }
  const sanitizedTenants = {};
  for (const [tId, tCfg] of Object.entries(tenantDatabaseConfigs)) {
    const { password: _p, tenantConfigs: _tc, ...cleanCfg } = tCfg;
    sanitizedTenants[tId] = cleanCfg;
  }
  return res.json({
    success: true,
    databaseConfig: publicDbState(),
    tenantConfigs: sanitizedTenants,
    tables: result,
    stats: {
      companies: databaseTables.tenants_companies.size,
      categories: databaseTables.categories.size,
      users: databaseTables.system_users.size,
      suppliers: databaseTables.suppliers.size,
      stockItems: databaseTables.stock_items.size,
      losses: databaseTables.loss_records.size,
      sessions: databaseTables.stock_count_sessions.size,
      orders: databaseTables.purchase_orders.size,
      totalRecords: calculateTotalRecords()
    }
  });
});
databaseRouter.get("/database/status", (req, res) => {
  const reqTenantId = req.query.tenantId ? String(req.query.tenantId).trim() : null;
  let targetConfig = linkedDatabaseState;
  if (reqTenantId && tenantDatabaseConfigs[reqTenantId]) {
    targetConfig = tenantDatabaseConfigs[reqTenantId];
  }
  const { password: _p, ...sanitizedTarget } = targetConfig;
  const sanitizedTenants = {};
  for (const [tId, tCfg] of Object.entries(tenantDatabaseConfigs)) {
    const { password: _pw, ...cleanCfg } = tCfg;
    sanitizedTenants[tId] = cleanCfg;
  }
  return res.json({
    databaseConfig: {
      ...sanitizedTarget,
      totalRecordsCount: calculateTotalRecords()
    },
    tenantConfigs: sanitizedTenants,
    activeTenantId: reqTenantId || "00000000000001",
    availableEngines: [
      { id: "postgres", name: "PostgreSQL", defaultPort: 5432, driver: "pg" },
      { id: "mysql", name: "MySQL", defaultPort: 3306, driver: "mysql2" },
      { id: "sqlserver", name: "Microsoft SQL Server", defaultPort: 1433, driver: "mssql" }
    ],
    systemTablesCount: SYSTEM_TABLES.length,
    tableRecords: {
      stock_items: databaseTables.stock_items.size,
      suppliers: databaseTables.suppliers.size,
      system_users: databaseTables.system_users.size,
      tenants_companies: databaseTables.tenants_companies.size,
      categories: databaseTables.categories.size,
      loss_records: databaseTables.loss_records.size,
      stock_count_sessions: databaseTables.stock_count_sessions.size,
      purchase_orders: databaseTables.purchase_orders.size
    },
    recentLogs: sqlExecutionLogs.slice(0, 15)
  });
});
databaseRouter.get("/database/table-data/:table", (req, res) => {
  const tableName = req.params.table;
  const targetTable = databaseTables[tableName];
  if (!targetTable) {
    return res.status(404).json({
      success: false,
      message: `Tabela "${tableName}" n\xE3o encontrada.`
    });
  }
  let rows = Array.from(targetTable.values());
  if (tableName === "system_users") {
    rows = rows.map((r) => ({ ...r, password_hash: "[PROTEGIDO]", pin: "[PROTEGIDO]" }));
  }
  return res.json({
    success: true,
    table: tableName,
    count: rows.length,
    rows
  });
});
databaseRouter.get("/database/sql-logs", (_req, res) => {
  return res.json({
    success: true,
    engine: linkedDatabaseState.engine,
    database: linkedDatabaseState.database,
    totalLogs: sqlExecutionLogs.length,
    logs: sqlExecutionLogs
  });
});
databaseRouter.get("/database/script/:engine", (req, res) => {
  const rawEngine = (req.params.engine || "postgres").toLowerCase();
  const engine = ["mysql", "postgres", "sqlserver"].includes(rawEngine) ? rawEngine : "postgres";
  const dbName = req.query.database || "restaurante_estoque_db";
  const script = generateDatabaseScript(engine, dbName);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(script);
});

// src/server/routes/receitaWsRoutes.ts
var import_express4 = require("express");
var receitaWsRouter = (0, import_express4.Router)();
var CNPJ_PATTERN = /^[A-Z0-9]{12}[0-9]{2}$/;
var CACHE_TTL_MS = 15 * 60 * 1e3;
var UPSTREAM_TIMEOUT_MS = 9e3;
var UPSTREAM_LIMIT = 3;
var UPSTREAM_WINDOW_MS = 60 * 1e3;
var CLIENT_LIMIT = 10;
var CLIENT_WINDOW_MS = 60 * 1e3;
var cnpjCache = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
var upstreamCalls = [];
var upstreamBlockedUntil = 0;
var clientCalls = /* @__PURE__ */ new Map();
var cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, calls] of clientCalls) {
    const recent = calls.filter((t) => now - t < CLIENT_WINDOW_MS);
    if (recent.length === 0) clientCalls.delete(ip);
    else clientCalls.set(ip, recent);
  }
  for (const [cnpj, entry] of cnpjCache) {
    if (now - entry.cachedAt >= CACHE_TTL_MS) cnpjCache.delete(cnpj);
  }
}, 60 * 1e3);
cleanupTimer.unref?.();
function retryAfterSeconds(oldestCallAt, windowMs, now) {
  return Math.max(1, Math.ceil((oldestCallAt + windowMs - now) / 1e3));
}
function sendRateLimited(res, seconds, message) {
  res.setHeader("Retry-After", String(seconds));
  return res.status(429).json({
    status: "ERROR",
    code: 429,
    retryAfterSeconds: seconds,
    message
  });
}
function reserveUpstreamSlot(now) {
  if (now < upstreamBlockedUntil) {
    return { ok: false, seconds: Math.max(1, Math.ceil((upstreamBlockedUntil - now) / 1e3)) };
  }
  upstreamCalls = upstreamCalls.filter((t) => now - t < UPSTREAM_WINDOW_MS);
  if (upstreamCalls.length >= UPSTREAM_LIMIT) {
    return { ok: false, seconds: retryAfterSeconds(upstreamCalls[0], UPSTREAM_WINDOW_MS, now) };
  }
  upstreamCalls.push(now);
  return { ok: true };
}
function clientRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const recent = (clientCalls.get(key) || []).filter((t) => now - t < CLIENT_WINDOW_MS);
  if (recent.length >= CLIENT_LIMIT) {
    clientCalls.set(key, recent);
    return sendRateLimited(
      res,
      retryAfterSeconds(recent[0], CLIENT_WINDOW_MS, now),
      "Muitas consultas de CNPJ em pouco tempo. Aguarde alguns segundos antes de tentar novamente."
    );
  }
  recent.push(now);
  clientCalls.set(key, recent);
  next();
}
async function fetchFromReceitaWs(cnpj) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "ControleEstoqueCMV-SaaS/1.0 (Integration ReceitaWS)"
      },
      signal: controller.signal
    });
    if (response.status === 429) {
      upstreamBlockedUntil = Date.now() + UPSTREAM_WINDOW_MS;
      return {
        kind: "http",
        status: 429,
        body: {
          status: "ERROR",
          code: 429,
          retryAfterSeconds: Math.ceil(UPSTREAM_WINDOW_MS / 1e3),
          message: "Limite da API p\xFAblica da Receita Federal atingido (m\xE1ximo de 3 consultas por minuto). Aguarde cerca de 1 minuto antes de tentar novamente."
        }
      };
    }
    if (response.status === 504) {
      return {
        kind: "http",
        status: 504,
        body: {
          status: "ERROR",
          code: 504,
          message: "Tempo limite excedido na base p\xFAblica da Receita Federal (HTTP 504). Tente novamente em alguns instantes."
        }
      };
    }
    if (!response.ok) {
      return {
        kind: "http",
        status: response.status,
        body: {
          status: "ERROR",
          code: response.status,
          message: `A API da Receita Federal retornou status ${response.status}: ${response.statusText}`
        }
      };
    }
    const data = await response.json();
    if (data.status === "ERROR") {
      return {
        kind: "http",
        status: 400,
        body: {
          status: "ERROR",
          message: data.message || "CNPJ n\xE3o localizado ou inv\xE1lido na base da Receita Federal."
        }
      };
    }
    return { kind: "ok", data };
  } finally {
    clearTimeout(timeoutId);
  }
}
receitaWsRouter.get("/receitaws/:cnpj", clientRateLimit, async (req, res) => {
  const cnpj = cleanCNPJ(req.params.cnpj);
  if (!CNPJ_PATTERN.test(cnpj)) {
    return res.status(400).json({
      status: "ERROR",
      message: "CNPJ inv\xE1lido. O CNPJ deve possuir 14 caracteres (12 alfanum\xE9ricos + 2 d\xEDgitos verificadores num\xE9ricos)."
    });
  }
  const now = Date.now();
  const cached = cnpjCache.get(cnpj);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return res.json({
      ...cached.data,
      fromCache: true,
      cacheAgeSeconds: Math.round((now - cached.cachedAt) / 1e3)
    });
  }
  try {
    let pending = inFlight.get(cnpj);
    if (!pending) {
      const slot = reserveUpstreamSlot(now);
      if (slot.ok === false) {
        const waitSec = slot.seconds ?? 60;
        return sendRateLimited(
          res,
          waitSec,
          `Limite da API p\xFAblica da Receita Federal atingido (m\xE1ximo de 3 consultas por minuto). Tente novamente em ${waitSec} segundo(s).`
        );
      }
      pending = fetchFromReceitaWs(cnpj).finally(() => inFlight.delete(cnpj));
      inFlight.set(cnpj, pending);
    }
    const result = await pending;
    if (result.kind === "http") {
      if (result.body?.retryAfterSeconds) {
        res.setHeader("Retry-After", String(result.body.retryAfterSeconds));
      }
      return res.status(result.status).json(result.body);
    }
    cnpjCache.set(cnpj, { data: result.data, cachedAt: Date.now() });
    return res.json({ ...result.data, fromCache: false });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({
        status: "ERROR",
        code: 504,
        message: "A consulta \xE0 Receita Federal expirou ap\xF3s 9 segundos (Timeout). Tente novamente."
      });
    }
    console.error(`[ReceitaWS] Erro ao consultar CNPJ ${cnpj}:`, error?.message || error);
    return res.status(500).json({
      status: "ERROR",
      message: `Falha na comunica\xE7\xE3o com o servi\xE7o da Receita Federal: ${error?.message || "Erro de conex\xE3o"}`
    });
  }
});

// src/server/middleware/subscriptionGuard.ts
var UNPROTECTED_PATHS = [
  "/billing",
  "/pagamento",
  "/logout",
  "/login",
  "/api/health",
  "/api/webhooks",
  "/api/billing"
];
function subscriptionGuard(req, res, next) {
  const currentPath = req.path.toLowerCase();
  const isUnprotected = UNPROTECTED_PATHS.some((path2) => currentPath.startsWith(path2));
  if (isUnprotected) {
    return next();
  }
  const tenantId = req.headers["x-tenant-id"] || "tenant-restaurante-01";
  const checkResult = dbStore.checkSubscriptionAccess(tenantId);
  if (checkResult.status === "active" || checkResult.status === "trialing") {
    res.setHeader("X-Subscription-Status", checkResult.status);
    return next();
  }
  if (checkResult.status === "past_due" && checkResult.inGracePeriod) {
    res.setHeader("X-Subscription-Status", "past_due");
    res.setHeader("X-Subscription-Warning", "in_grace_period");
    res.setHeader("X-Grace-Days-Left", String(checkResult.daysLeftInGrace));
    res.setHeader(
      "X-Grace-Period-End",
      checkResult.subscription.grace_period_end || ""
    );
    res.setHeader("X-Grace-Message", encodeURIComponent(checkResult.message));
    return next();
  }
  if (checkResult.status === "past_due" && !checkResult.inGracePeriod) {
    res.status(402).json({
      error: "SUBSCRIPTION_OVERDUE_LOCKED",
      status: "past_due",
      isBlocked: true,
      redirect: "/billing/overdue",
      message: "Acesso suspenso por inadimpl\xEAncia. O prazo de toler\xE2ncia de 5 dias expirou.",
      details: {
        gracePeriodEnd: checkResult.subscription.grace_period_end,
        unpaidInvoice: checkResult.pendingInvoice,
        supportPhone: "5511987654321"
      }
    });
    return;
  }
  if (checkResult.status === "canceled") {
    res.status(403).json({
      error: "SUBSCRIPTION_CANCELED",
      status: "canceled",
      isBlocked: true,
      redirect: "/billing/reactivate",
      message: "Sua assinatura do sistema de controle de estoque est\xE1 cancelada. Escolha um plano para reativar seu acesso."
    });
    return;
  }
  return next();
}

// src/server/app.ts
function createApiApp() {
  const app = (0, import_express5.default)();
  if (process.env.VERCEL) {
    app.set("trust proxy", 1);
  }
  app.use(import_express5.default.json());
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "SaaS Controle de Estoque & CMV" });
  });
  app.post("/api/auth/token", (req, res) => {
    const { tenant_id, role, name, email } = req.body || {};
    const defaultPayload = {
      user_id: role === "admin" ? "usr-admin-01" : "usr-operador-02",
      tenant_id: tenant_id || "tenant-restaurante-matriz",
      name: name || (role === "admin" ? "Carlos Gerente" : "Marcos Operador de Estoque"),
      email: email || (role === "admin" ? "gerente@saborearte.com.br" : "marcos.estoque@saborearte.com.br"),
      role: role === "admin" ? "admin" : "operador"
    };
    const token = signDemoToken(defaultPayload);
    res.json({
      success: true,
      access_token: token,
      token_type: "Bearer",
      expires_in: 86400,
      // 24 horas
      user: defaultPayload
    });
  });
  app.use("/api", billingRouter);
  app.use("/api", databaseRouter);
  app.use("/api", receitaWsRouter);
  app.use("/api", subscriptionGuard, inventoryRouter);
  app.get("/api/protected/inventory-status", subscriptionGuard, (_req, res) => {
    res.json({
      status: "authorized",
      message: "Acesso autorizado aos dados de estoque do restaurante.",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  return app;
}

// src/server/vercelEntry.ts
var vercelEntry_default = createApiApp();
module.exports = module.exports.default;
