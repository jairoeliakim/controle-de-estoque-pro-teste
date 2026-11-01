import { hashPassword, verifyPassword, pickStoredSecret } from '../utils/passwordSecurity.js';

/**
 * Verificação do Super Administrador feita NO SERVIDOR (não no navegador).
 *
 * A senha padrão abaixo é a mesma usada no primeiro acesso do sistema, apenas
 * para o projeto funcionar "fora da caixa" no período de teste. Em produção,
 * defina ADMIN_PASSWORD_HASH (formato `sha256$<salt>$<hash>`, gerado com
 * hashPassword) ou ADMIN_PASSWORD (texto puro, só para teste) nas variáveis
 * de ambiente — assim a senha real nunca precisa estar no código-fonte.
 */
const DEFAULT_ADMIN_PASSWORD = '@dm!n2026';
const ADMIN_EMAIL = 'admin@sistema.com';
const ADMIN_ALIASES = ['admin@sistema.com', 'admin', 'administrador', 'root'];
export const INSTALL_TENANT_ID = '00000000000000';

function resolveAdminSecret(): string {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  if (process.env.ADMIN_PASSWORD) return hashPassword(process.env.ADMIN_PASSWORD);
  console.warn(
    '[AUTH] ADMIN_PASSWORD_HASH/ADMIN_PASSWORD não definidos: usando a senha padrão de instalação.\n' +
    '[AUTH] Defina uma dessas variáveis de ambiente para trocar a senha do Super Administrador.'
  );
  return hashPassword(DEFAULT_ADMIN_PASSWORD);
}

/**
 * Verifica, NO SERVIDOR, se o identificador e a senha informados correspondem
 * ao Super Administrador. Esta é a autoridade final — a checagem feita no
 * navegador é só para dar uma mensagem de erro rápida, nunca para decidir
 * se um token deve ser emitido.
 */
export function verifyMasterAdminOnServer(identifier: string, secret: string): boolean {
  const cleanId = (identifier || '').trim().toLowerCase();
  if (!ADMIN_ALIASES.includes(cleanId)) return false;
  const adminSecret = pickStoredSecret(resolveAdminSecret());
  return verifyPassword(secret, adminSecret);
}

export function masterAdminEmail(): string {
  return ADMIN_EMAIL;
}
