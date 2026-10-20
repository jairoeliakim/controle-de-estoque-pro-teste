import express from 'express';
import { billingRouter } from './routes/billingRoutes.js';
import { inventoryRouter } from './routes/inventoryRoutes.js';
import { databaseRouter, findTenantByCnpj, findSystemUserForLogin, updateSystemUserSecret } from './routes/databaseRoutes.js';
import { receitaWsRouter } from './routes/receitaWsRoutes.js';
import { subscriptionGuard } from './middleware/subscriptionGuard.js';
import { signToken, requireAuth } from './middleware/authMiddleware.js';
import { verifyMasterAdminOnServer, masterAdminEmail, INSTALL_TENANT_ID } from './adminAuth.js';
import { verifyPassword, pickStoredSecret, rehashIfLegacy } from '../utils/passwordSecurity.js';
import { cleanCNPJ } from '../utils/cnpjValidator.js';

// Limita tentativas de login por IP (mitiga força bruta contra o hash de senha)
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, number[]>();

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  attempts.push(now);
  loginAttempts.set(ip, attempts);
  return attempts.length > LOGIN_MAX_ATTEMPTS;
}

/**
 * Cria o app Express com todas as rotas de API.
 * É usado tanto pelo servidor local (server.ts, que acrescenta Vite/estáticos e o listen)
 * quanto pela função serverless da Vercel (api/index.js).
 */
export function createApiApp() {
  const app = express();

  // Na Vercel o IP real do cliente vem no X-Forwarded-For (1 proxy confiável).
  // Necessário para o limitador por IP das rotas de login e do /api/receitaws.
  if (process.env.VERCEL) {
    app.set('trust proxy', 1);
  }

  // Middleware para parser de corpo JSON
  app.use(express.json());

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'SaaS Controle de Estoque & CMV' });
  });

  // ---------------------------------------------------------------------
  // Autenticação REAL: a senha é sempre verificada AQUI, no servidor.
  // Esta é a única forma legítima de obter um token que abre as rotas
  // protegidas (/api/database/*, /api/products, etc.).
  // ---------------------------------------------------------------------
  app.post('/api/auth/login', (req: express.Request, res: express.Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (isLoginRateLimited(clientIp)) {
      res.status(429).json({
        success: false,
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Muitas tentativas de login em pouco tempo. Aguarde 1 minuto e tente novamente.',
      });
      return;
    }

    const { mode, cnpj, email, password } = (req.body || {}) as {
      mode?: 'master-admin' | 'employee';
      cnpj?: string;
      email?: string;
      password?: string;
    };

    if (!password) {
      res.status(400).json({ success: false, message: 'Informe a senha de acesso.' });
      return;
    }

    // --- Super Administrador (fora do banco, CNPJ de instalação) ---
    if (mode === 'master-admin') {
      const identifier = email || 'admin';
      if (!verifyMasterAdminOnServer(identifier, password)) {
        res.status(401).json({ success: false, message: 'Senha incorreta para o Super Administrador.' });
        return;
      }
      const payload = {
        user_id: 'usr-admin-master',
        tenant_id: INSTALL_TENANT_ID,
        name: 'Super Administrador (Instalação)',
        email: masterAdminEmail(),
        role: 'administrador' as const,
      };
      res.json({
        success: true,
        access_token: signToken(payload),
        token_type: 'Bearer',
        expires_in: 86400,
        user: payload,
      });
      return;
    }

    // --- Colaborador de uma empresa (identificado pelo CNPJ) ---
    const cleanCnpj = cleanCNPJ(cnpj || '');
    const tenant = cleanCnpj ? findTenantByCnpj(cleanCnpj) : null;
    if (!tenant) {
      res.status(404).json({ success: false, message: 'Nenhuma empresa localizada com o CNPJ informado.' });
      return;
    }
    if (!email) {
      res.status(400).json({ success: false, message: 'Informe o e-mail do colaborador.' });
      return;
    }

    const user = findSystemUserForLogin(tenant.id, email);
    if (!user) {
      res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      return;
    }
    if (user.is_active === false || user.status === 'bloqueado') {
      res.status(403).json({ success: false, message: 'Acesso bloqueado. Aguarde a liberação de um gerente.' });
      return;
    }

    const storedSecret = pickStoredSecret(user.password_hash, user.pin);
    if (!storedSecret || !verifyPassword(password, storedSecret)) {
      res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      return;
    }

    // Migração transparente: se a senha confere mas o hash gravado ainda é do
    // formato antigo (salt fixo), grava um hash bcrypt novo neste login.
    const upgradedHash = rehashIfLegacy(password, storedSecret);
    if (upgradedHash) {
      updateSystemUserSecret(user.id, upgradedHash);
    }

    const payload = {
      user_id: user.id,
      tenant_id: tenant.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
    };
    res.json({
      success: true,
      access_token: signToken(payload),
      token_type: 'Bearer',
      expires_in: 86400,
      user: payload,
    });
  });

  // Token de baixo privilégio para ferramentas de teste/bancada (nunca emite papel
  // administrativo nem decide a senha — é sempre o papel menos privilegiado do sistema).
  app.post('/api/auth/token', (req, res) => {
    const { tenant_id } = req.body || {};
    const payload = {
      user_id: 'usr-bancada-teste',
      tenant_id: tenant_id || 'tenant-restaurante-matriz',
      name: 'Sessão de Bancada (somente leitura)',
      email: 'bancada@sistema.local',
      role: 'conferente' as const,
    };
    res.json({
      success: true,
      access_token: signToken(payload),
      token_type: 'Bearer',
      expires_in: 86400,
      user: payload,
    });
  });

  // 1. Rotas de Cobrança, Webhooks e Faturamento (Isentas do subscriptionGuard)
  app.use('/api', billingRouter);

  // 2. Rotas de Vínculo e Configuração de Banco de Dados (MySQL, Postgres, SQL Server)
  //    Exigem um token válido: toda a API de administração do banco ficava aberta antes.
  app.use('/api', requireAuth, databaseRouter);

  // 3. Rota de Consulta de CNPJ na Receita Federal (ReceitaWS) — fica pública de propósito:
  //    só consulta dados públicos do CNPJ e é usada durante o cadastro, antes do login.
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
