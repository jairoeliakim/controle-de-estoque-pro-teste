import express from 'express';
import { billingRouter } from './routes/billingRoutes.js';
import { inventoryRouter } from './routes/inventoryRoutes.js';
import { databaseRouter } from './routes/databaseRoutes.js';
import { receitaWsRouter } from './routes/receitaWsRoutes.js';
import { subscriptionGuard } from './middleware/subscriptionGuard.js';
import { signDemoToken } from './middleware/authMiddleware.js';

/**
 * Cria o app Express com todas as rotas de API.
 * É usado tanto pelo servidor local (server.ts, que acrescenta Vite/estáticos e o listen)
 * quanto pela função serverless da Vercel (api/index.js).
 */
export function createApiApp() {
  const app = express();

  // Na Vercel o IP real do cliente vem no X-Forwarded-For (1 proxy confiável).
  // Necessário para o limitador por IP da rota /api/receitaws.
  if (process.env.VERCEL) {
    app.set('trust proxy', 1);
  }

  // Middleware para parser de corpo JSON
  app.use(express.json());

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'SaaS Controle de Estoque & CMV' });
  });

  // Autenticação & Emissão de Token JWT para Web & Mobile
  app.post('/api/auth/token', (req, res) => {
    const { tenant_id, role, name, email } = req.body || {};
    const defaultPayload = {
      user_id: role === 'admin' ? 'usr-admin-01' : 'usr-operador-02',
      tenant_id: tenant_id || 'tenant-restaurante-matriz',
      name: name || (role === 'admin' ? 'Carlos Gerente' : 'Marcos Operador de Estoque'),
      email: email || (role === 'admin' ? 'gerente@saborearte.com.br' : 'marcos.estoque@saborearte.com.br'),
      role: (role === 'admin' ? 'admin' : 'operador') as 'admin' | 'operador',
    };
    const token = signDemoToken(defaultPayload);
    res.json({
      success: true,
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400, // 24 horas
      user: defaultPayload,
    });
  });

  // 1. Rotas de Cobrança, Webhooks e Faturamento (Isentas do subscriptionGuard)
  app.use('/api', billingRouter);

  // 2. Rotas de Vínculo e Configuração de Banco de Dados (MySQL, Postgres, SQL Server)
  app.use('/api', databaseRouter);

  // 3. Rota de Consulta de CNPJ na Receita Federal (ReceitaWS)
  app.use('/api', receitaWsRouter);

  // 4. Rotas REST de Estoque Multi-Tenant (Protegidas pelo SubscriptionGuard e Auth)
  app.use('/api', subscriptionGuard, inventoryRouter);

  // 5. Exemplo de Rotas Protegidas pelo SubscriptionGuard (demonstração do middleware)
  app.get('/api/protected/inventory-status', subscriptionGuard, (_req, res) => {
    res.json({
      status: 'authorized',
      message: 'Acesso autorizado aos dados de estoque do restaurante.',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
