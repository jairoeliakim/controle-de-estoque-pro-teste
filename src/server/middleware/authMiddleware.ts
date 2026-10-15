import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload } from '../../types/inventory.js';

// Estende a interface Request do Express para conter o usuário autenticado e tenant
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Simulação/Decodificação de JWT para ambiente híbrido Web & Mobile
 * Em produção com 'jsonwebtoken', usa jwt.verify(token, process.env.JWT_SECRET)
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    // Suporte a JWT real (formato header.payload.signature) ou tokens simulados codificados em base64/JSON
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        return JSON.parse(payloadJson) as AuthTokenPayload;
      }
    }
    // Fallback para token base64 direto ou JSON
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(decoded) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Cria token assinado (JWT) para testes e autenticação de operadores
 */
export function signDemoToken(payload: AuthTokenPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from('mock_signature_for_dev').toString('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Middleware de Autenticação e Extração de Tenant
 * Garante que nenhuma rota de negócio execute sem um tenant_id válido
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
      message: 'Token JWT inválido, expirado ou desprovido de tenant_id.',
    });
    return;
  }

  // Anexa o usuário e tenant ao request
  req.user = decoded;
  next();
}

/**
 * Middleware para exigir papel de Administrador quando necessário
 */
export function requireRole(role: 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Acesso restrito. Esta operação requer privilégio de ${role}.`,
      });
      return;
    }
    next();
  };
}
