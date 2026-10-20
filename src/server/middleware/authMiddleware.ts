import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthTokenPayload } from '../../types/inventory.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// Segredo de assinatura do token
// ---------------------------------------------------------------------------
// Em produção, defina JWT_SECRET nas variáveis de ambiente (Vercel → Settings →
// Environment Variables). Sem essa variável, um segredo aleatório é gerado a
// cada início do processo: os tokens continuam assinados de verdade (não dá
// para forjar sem o segredo), mas eles deixam de valer entre reinícios/instâncias
// diferentes do servidor — por isso o aviso abaixo.
function resolveSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  console.warn(
    '[AUTH] JWT_SECRET não definido (ou muito curto). Usando um segredo aleatório válido só para este processo.\n' +
    '[AUTH] Defina JWT_SECRET (>=32 caracteres aleatórios) nas variáveis de ambiente para sessões estáveis entre reinícios.'
  );
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveSecret();
const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 horas

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
}

/**
 * Assina um JWT real (HS256). A assinatura é verificada em `verifyToken` —
 * um token com payload alterado ou assinatura inventada é sempre rejeitado.
 */
export function signToken(payload: AuthTokenPayload): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const body = base64url(JSON.stringify(fullPayload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

/**
 * Verifica a assinatura e a expiração do token. Retorna `null` para qualquer
 * token malformado, com assinatura inválida ou expirado — nunca decodifica
 * "no escuro" como a versão anterior fazia.
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSignature = sign(`${header}.${body}`);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null; // assinatura inválida: token forjado ou adulterado
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as AuthTokenPayload;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // expirado
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware de autenticação: exige um token válido (assinatura + validade
 * conferidas) com tenant_id e user_id.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || (req.headers['x-access-token'] as string);

  if (!authHeader) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token de autenticação não fornecido no cabeçalho Authorization: Bearer <token>',
    });
    return;
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  const decoded = verifyToken(token);

  if (!decoded || !decoded.tenant_id || !decoded.user_id) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token inválido, com assinatura incorreta, expirado ou desprovido de tenant_id.',
    });
    return;
  }

  req.user = decoded;
  next();
}

/**
 * Exige um dos papéis informados (usa os papéis reais do sistema:
 * 'administrador' | 'gerente' | 'compras' | 'conferente').
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Acesso restrito. Esta operação requer um dos papéis: ${roles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}

/**
 * Garante que o recurso acessado pertence ao MESMO tenant do token.
 * Use isso sempre que um :id de rota (ou corpo da requisição) referenciar
 * um registro de outro tenant que não deveria ser lido/alterado.
 */
export function belongsToTenant(req: Request, resourceTenantId?: string | null): boolean {
  if (!req.user) return false;
  if (!resourceTenantId) return false;
  return req.user.tenant_id === resourceTenantId;
}
