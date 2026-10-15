import { Router, Request, Response } from 'express';
import { dbStore, SAAS_PLANS } from '../db/billingStore.js';
import { handlePaymentWebhook } from '../webhooks/paymentWebhookHandler.js';

export const billingRouter = Router();

/**
 * 1. Endpoint do Webhook de Pagamentos
 * POST /api/webhooks/payment
 */
billingRouter.post('/webhooks/payment', handlePaymentWebhook);

/**
 * 2. Status Geral da Assinatura e Carência (Access Guard Check)
 * GET /api/billing/status
 */
billingRouter.get('/billing/status', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant-restaurante-01';
  const result = dbStore.checkSubscriptionAccess(tenantId);
  const plan = SAAS_PLANS.find((p) => p.id === result.subscription.plan_id);

  res.json({
    ...result,
    plan,
  });
});

/**
 * 3. Catálogo de Planos
 * GET /api/billing/plans
 */
billingRouter.get('/billing/plans', (_req: Request, res: Response) => {
  res.json({ plans: SAAS_PLANS });
});

/**
 * 4. Histórico de Faturas do Tenant
 * GET /api/billing/invoices
 */
billingRouter.get('/billing/invoices', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant-restaurante-01';
  const invoices = dbStore.getInvoicesByTenant(tenantId);
  res.json({ invoices });
});

/**
 * 5. Pagamento / Baixa Imediata da Fatura (PIX Instantâneo ou Cartão)
 * POST /api/billing/pay-invoice
 */
billingRouter.post('/billing/pay-invoice', (req: Request, res: Response) => {
  const { invoiceId, paymentMethod = 'pix' } = req.body;
  const tenantId = req.body.tenantId || 'tenant-restaurante-01';

  const sub = dbStore.getSubscriptionByTenant(tenantId);
  if (!sub) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }

  // Quita a fatura informada ou a pendente
  const targetInvoice = invoiceId
    ? dbStore.invoices.get(invoiceId)
    : dbStore.getPendingInvoice(sub.id);

  if (targetInvoice) {
    targetInvoice.status = 'paid';
    targetInvoice.paid_at = new Date().toISOString();
    targetInvoice.payment_method = paymentMethod;
    dbStore.invoices.set(targetInvoice.id, targetInvoice);
  }

  // Atualiza assinatura para 'active', próximo ciclo +30 dias, limpa carência
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  dbStore.updateSubscriptionStatus(sub.id, 'active', nextMonth, null);

  console.log(`[PAGAMENTO CONFIRMADO] Fatura liquidada. Assinatura ${sub.id} reativada com sucesso.`);

  res.json({
    success: true,
    message: 'Pagamento confirmado com sucesso! O acesso completo foi restaurado.',
    subscription: dbStore.getSubscriptionByTenant(tenantId),
    invoice: targetInvoice,
  });
});

/**
 * 6. Simulação de Cenários para Testes & Demonstração
 * POST /api/billing/simulate-scenario
 */
billingRouter.post('/billing/simulate-scenario', (req: Request, res: Response) => {
  const { scenario } = req.body; // 'active' | 'grace_period' | 'blocked' | 'canceled'
  if (!['active', 'grace_period', 'blocked', 'canceled'].includes(scenario)) {
    res.status(400).json({ error: 'Cenário inválido' });
    return;
  }

  dbStore.setSimulationScenario(scenario);
  const updatedStatus = dbStore.checkSubscriptionAccess('tenant-restaurante-01');

  res.json({
    success: true,
    message: `Cenário alterado para: ${scenario.toUpperCase()}`,
    currentStatus: updatedStatus,
  });
});

/**
 * 7. Disparo Simulado de Webhook do Gateway (para testes de integração)
 * POST /api/billing/simulate-webhook
 */
billingRouter.post('/billing/simulate-webhook', async (req: Request, res: Response) => {
  const { eventType, failureReason } = req.body; // 'payment_succeeded' | 'payment_failed' | 'subscription_canceled'

  // Simula payload emitido pelo Asaas / Stripe
  const syntheticPayload = {
    event: eventType || 'payment_succeeded',
    gateway: 'asaas',
    payment: {
      id: `pay_sim_${Date.now()}`,
      subscription: 'sub_gw_9941829471',
      customer: 'cus_asaas_00192847',
      value: 189.9,
      dueDate: new Date().toISOString(),
      refusalReason: failureReason || 'Cartão sem limite disponível',
    },
  };

  // Reencaminha internamente para o handlePaymentWebhook
  req.body = syntheticPayload;
  await handlePaymentWebhook(req, res);
});

/**
 * 8. Histórico de Notificações da Régua de Cobrança (Dunning Logs)
 * GET /api/billing/dunning-logs
 */
billingRouter.get('/billing/dunning-logs', (_req: Request, res: Response) => {
  res.json({
    logs: dbStore.dunningLogs,
    webhooks: dbStore.webhookLogs,
  });
});
