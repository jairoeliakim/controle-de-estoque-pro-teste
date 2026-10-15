import { Request, Response } from 'express';
import { dbStore } from '../db/billingStore.js';
import { DunningNotificationLog, Invoice, WebhookEventPayload } from '../../types/billing.js';

// Segredo do Webhook (configurável via ENV)
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_asaas_saas_estoque_demo_2026';

/**
 * Validação de Assinatura / Token de Segurança do Webhook
 */
export function verifyWebhookSecurity(req: Request): boolean {
  // 1. Em desenvolvimento ou testes, se não houver segredo estrito configurado, autoriza
  if (process.env.NODE_ENV !== 'production' && !process.env.STRICT_WEBHOOK_CHECK) {
    return true;
  }

  // 2. Asaas envia o token no header 'asaas-access-token'
  const asaasToken = req.headers['asaas-access-token'];
  if (asaasToken && asaasToken === WEBHOOK_SECRET) {
    return true;
  }

  // 3. Padrão Stripe / Generic Signature: 'x-webhook-signature' ou 'authorization'
  const customSignature = req.headers['x-webhook-signature'] || req.headers['x-hub-signature-256'];
  if (customSignature && customSignature === WEBHOOK_SECRET) {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${WEBHOOK_SECRET}`) {
    return true;
  }

  return false;
}

/**
 * Normaliza eventos de diferentes gateways (Asaas, Stripe, Mercado Pago)
 * para uma estrutura canônica
 */
export function normalizeGatewayEvent(body: any): {
  normalizedEvent: 'payment_succeeded' | 'payment_failed' | 'subscription_canceled' | 'unknown';
  gateway: string;
  subscriptionId?: string;
  customerId?: string;
  invoiceId?: string;
  amount?: number;
  dueDate?: string;
  failureReason?: string;
} {
  const eventName = body.event || body.type || body.action || '';
  const gateway = body.gateway || (body.object === 'event' ? 'stripe' : 'asaas');

  // Mapeamento de Pagamento Confirmado
  if (
    eventName === 'payment_succeeded' ||
    eventName === 'invoice.paid' ||
    eventName === 'PAYMENT_RECEIVED' ||
    eventName === 'PAYMENT_CONFIRMED' ||
    eventName === 'payment.created'
  ) {
    return {
      normalizedEvent: 'payment_succeeded',
      gateway,
      subscriptionId: body.payment?.subscription || body.data?.object?.subscription || body.subscriptionId,
      customerId: body.payment?.customer || body.data?.object?.customer || body.customerId,
      invoiceId: body.payment?.id || body.data?.object?.id || body.invoiceId,
      amount: body.payment?.value || (body.data?.object?.amount_paid ? body.data.object.amount_paid / 100 : undefined) || body.amount,
      dueDate: body.payment?.dueDate,
    };
  }

  // Mapeamento de Falha / Inadimplência
  if (
    eventName === 'payment_failed' ||
    eventName === 'invoice.payment_failed' ||
    eventName === 'PAYMENT_OVERDUE' ||
    eventName === 'PAYMENT_CHARGEBACK_REQUESTED' ||
    eventName === 'PAYMENT_REFUSED'
  ) {
    return {
      normalizedEvent: 'payment_failed',
      gateway,
      subscriptionId: body.payment?.subscription || body.data?.object?.subscription || body.subscriptionId,
      customerId: body.payment?.customer || body.data?.object?.customer || body.customerId,
      invoiceId: body.payment?.id || body.data?.object?.id || body.invoiceId,
      amount: body.payment?.value || body.amount,
      dueDate: body.payment?.dueDate,
      failureReason: body.payment?.refusalReason || body.data?.object?.last_payment_error?.message || body.failureReason || 'Saldo insuficiente ou cartão recusado',
    };
  }

  // Mapeamento de Cancelamento
  if (
    eventName === 'subscription_canceled' ||
    eventName === 'customer.subscription.deleted' ||
    eventName === 'SUBSCRIPTION_DELETED' ||
    eventName === 'SUBSCRIPTION_INACTIVATED'
  ) {
    return {
      normalizedEvent: 'subscription_canceled',
      gateway,
      subscriptionId: body.subscription?.id || body.data?.object?.id || body.subscriptionId,
      customerId: body.subscription?.customer || body.data?.object?.customer || body.customerId,
    };
  }

  return {
    normalizedEvent: 'unknown',
    gateway,
  };
}

/**
 * Disparador de Notificação da Régua de Cobrança (Dunning Notification Dispatcher)
 */
function dispatchDunningNotification(params: {
  tenantId: string;
  subscriptionId: string;
  invoiceId: string;
  tenantEmail: string;
  tenantPhone?: string;
  tenantName: string;
  amount: number;
  gracePeriodEnd: string;
  reason?: string;
}) {
  const formattedDate = new Date(params.gracePeriodEnd).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedAmount = Number(params.amount || 189.9).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const notification: DunningNotificationLog = {
    id: `dunning-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenant_id: params.tenantId,
    subscription_id: params.subscriptionId,
    invoice_id: params.invoiceId,
    type: 'whatsapp',
    subject: `Aviso Importante: Fatura Pendente - ${params.tenantName}`,
    message: `Olá, ${params.tenantName}! Identificamos uma pendência no pagamento da sua mensalidade no valor de ${formattedAmount}. O acesso ao sistema de estoque está garantido até ${formattedDate} (período de tolerância). Evite a suspensão regularizando o pagamento via PIX no link da fatura.`,
    sent_at: new Date().toISOString(),
    status: 'sent',
  };

  dbStore.logDunning(notification);
  console.log(`[DUNNING] Notificação de cobrança registrada para ${params.tenantEmail}:`, notification.message);
}

/**
 * Controlador Principal do Webhook de Pagamentos
 * Endpoint: POST /api/webhooks/payment
 */
export async function handlePaymentWebhook(req: Request, res: Response): Promise<void> {
  try {
    // 1. Validação de Segurança
    if (!verifyWebhookSecurity(req)) {
      console.warn('[WEBHOOK SECURITY] Tentativa de acesso não autorizada ao endpoint de webhook.');
      res.status(401).json({ error: 'UNAUTHORIZED_WEBHOOK_SIGNATURE' });
      return;
    }

    const rawBody = req.body || {};
    const { normalizedEvent, gateway, subscriptionId, invoiceId, amount, failureReason } = normalizeGatewayEvent(rawBody);

    console.log(`[WEBHOOK RECEIVED] Gateway: ${gateway} | Evento: ${normalizedEvent}`);

    // Registra auditoria
    dbStore.logWebhook({
      gateway,
      event: normalizedEvent,
      rawEvent: rawBody.event || rawBody.type,
      subscriptionId,
      invoiceId,
      amount,
    });

    // Encontra a assinatura no sistema
    let targetSub = subscriptionId
      ? dbStore.getSubscriptionByGatewayId(subscriptionId)
      : dbStore.getSubscriptionByTenant('tenant-restaurante-01');

    if (!targetSub) {
      // Fallback para o tenant de demonstração caso não encontre pelo ID do gateway
      targetSub = dbStore.getSubscriptionByTenant('tenant-restaurante-01');
    }

    if (!targetSub) {
      res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
      return;
    }

    const tenant = dbStore.getTenant(targetSub.tenant_id);

    // 2. Processamento dos Eventos
    switch (normalizedEvent) {
      // -------------------------------------------------------------
      // EVENTO: Pagamento Aprovado / Sucesso
      // -------------------------------------------------------------
      case 'payment_succeeded': {
        const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // - Atualizar status da assinatura para 'active'
        // - Atualizar current_period_end para o próximo ciclo (+30 dias)
        // - Limpar qualquer restrição de carência (grace_period_end = null)
        dbStore.updateSubscriptionStatus(targetSub.id, 'active', nextPeriodEnd, null);

        // - Atualizar status da fatura para 'paid'
        if (invoiceId) {
          dbStore.setInvoicePaid(invoiceId);
        } else {
          // Quita a fatura pendente da assinatura
          const pending = dbStore.getPendingInvoice(targetSub.id);
          if (pending) {
            dbStore.setInvoicePaid(pending.id);
          }
        }

        console.log(`[WEBHOOK SUCCESS] Assinatura ${targetSub.id} reativada para ACTIVE. Próximo ciclo: ${nextPeriodEnd}`);

        res.status(200).json({
          status: 'success',
          event: 'payment_succeeded',
          subscription_status: 'active',
          current_period_end: nextPeriodEnd,
          grace_period_end: null,
        });
        return;
      }

      // -------------------------------------------------------------
      // EVENTO: Falha no Pagamento / Inadimplência
      // -------------------------------------------------------------
      case 'payment_failed': {
        // - Definir grace_period_end para 5 dias a partir da falha
        const graceEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

        // - Atualizar status para 'past_due'
        dbStore.updateSubscriptionStatus(targetSub.id, 'past_due', undefined, graceEnd);

        // - Atualizar/Criar fatura como falha/pendente
        const currentInvId = invoiceId || `inv-${Date.now()}`;
        const newOrUpdatedInvoice: Invoice = {
          id: currentInvId,
          subscription_id: targetSub.id,
          tenant_id: targetSub.tenant_id,
          gateway_invoice_id: invoiceId || `gw_inv_${Date.now()}`,
          amount: amount || 189.9,
          status: 'failed',
          payment_url: `https://pagamento.exemplo.com/fatura/${currentInvId}`,
          pix_copia_cola:
            '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304ABCD',
          due_date: new Date().toISOString(),
          payment_method: 'pix',
          failure_reason: failureReason || 'Cartão não autorizado pela emissora',
          created_at: new Date().toISOString(),
        };
        dbStore.createOrUpdateInvoice(newOrUpdatedInvoice);

        // - Registrar evento para disparo de notificação / régua de cobrança (Dunning)
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
            reason: failureReason,
          });
        }

        console.log(`[WEBHOOK FAILED] Assinatura ${targetSub.id} em PAST_DUE. Tolerância até: ${graceEnd}`);

        res.status(200).json({
          status: 'handled',
          event: 'payment_failed',
          subscription_status: 'past_due',
          grace_period_end: graceEnd,
          dunning_triggered: true,
        });
        return;
      }

      // -------------------------------------------------------------
      // EVENTO: Assinatura Cancelada
      // -------------------------------------------------------------
      case 'subscription_canceled': {
        // - Atualizar status para 'canceled'
        dbStore.updateSubscriptionStatus(targetSub.id, 'canceled');

        console.log(`[WEBHOOK CANCELED] Assinatura ${targetSub.id} foi CANCELADA.`);

        res.status(200).json({
          status: 'handled',
          event: 'subscription_canceled',
          subscription_status: 'canceled',
        });
        return;
      }

      default: {
        console.log(`[WEBHOOK IGNORED] Evento não mapeado: ${rawBody.event || rawBody.type}`);
        res.status(200).json({ status: 'ignored', reason: 'unmapped_event' });
        return;
      }
    }
  } catch (error: any) {
    console.error('[WEBHOOK ERROR] Falha no processamento:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: error?.message });
  }
}
