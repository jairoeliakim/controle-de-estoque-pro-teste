import { Request, Response, NextFunction } from 'express';
import { dbStore } from '../db/billingStore.js';

// Rotas públicas e de cobrança isentas de bloqueio
const UNPROTECTED_PATHS = [
  '/billing',
  '/pagamento',
  '/logout',
  '/login',
  '/api/health',
  '/api/webhooks',
  '/api/billing',
];

/**
 * Middleware Guard de Controle de Acesso por Assinatura e Tolerância (Dunning)
 */
export function subscriptionGuard(req: Request, res: Response, next: NextFunction): void {
  const currentPath = req.path.toLowerCase();

  // 1. Isenção para rotas públicas, estáticas, webhooks e faturamento
  const isUnprotected = UNPROTECTED_PATHS.some((path) => currentPath.startsWith(path));
  if (isUnprotected) {
    return next();
  }

  // Obter tenant ID do cabeçalho de autenticação ou sessão (fallback para o tenant demo)
  const tenantId = (req.headers['x-tenant-id'] as string) || 'tenant-restaurante-01';

  // 2. Avaliação de Status e Carência no Repositório Central
  const checkResult = dbStore.checkSubscriptionAccess(tenantId);

  // A: Assinatura Ativa ou Período de Testes
  if (checkResult.status === 'active' || checkResult.status === 'trialing') {
    res.setHeader('X-Subscription-Status', checkResult.status);
    return next();
  }

  // B: Inadimplente mas DENTRO do Período de Carência (now <= grace_period_end)
  if (checkResult.status === 'past_due' && checkResult.inGracePeriod) {
    // Injeta cabeçalhos de aviso para o cliente HTTP / Frontend
    res.setHeader('X-Subscription-Status', 'past_due');
    res.setHeader('X-Subscription-Warning', 'in_grace_period');
    res.setHeader('X-Grace-Days-Left', String(checkResult.daysLeftInGrace));
    res.setHeader(
      'X-Grace-Period-End',
      checkResult.subscription.grace_period_end || ''
    );
    res.setHeader('X-Grace-Message', encodeURIComponent(checkResult.message));

    // Permite prosseguir normalmente com o processamento da rota protegida
    return next();
  }

  // C: Inadimplente com Prazo de Carência ESGOTADO (now > grace_period_end) -> BLOQUEIO / PAYWALL
  if (checkResult.status === 'past_due' && !checkResult.inGracePeriod) {
    res.status(402).json({
      error: 'SUBSCRIPTION_OVERDUE_LOCKED',
      status: 'past_due',
      isBlocked: true,
      redirect: '/billing/overdue',
      message:
        'Acesso suspenso por inadimplência. O prazo de tolerância de 5 dias expirou.',
      details: {
        gracePeriodEnd: checkResult.subscription.grace_period_end,
        unpaidInvoice: checkResult.pendingInvoice,
        supportPhone: '5511987654321',
      },
    });
    return;
  }

  // D: Assinatura Cancelada
  if (checkResult.status === 'canceled') {
    res.status(403).json({
      error: 'SUBSCRIPTION_CANCELED',
      status: 'canceled',
      isBlocked: true,
      redirect: '/billing/reactivate',
      message:
        'Sua assinatura do sistema de controle de estoque está cancelada. Escolha um plano para reativar seu acesso.',
    });
    return;
  }

  // Fallback seguro
  return next();
}
