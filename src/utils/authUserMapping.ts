import { AuthUser } from '../types';
import { pickStoredSecret } from './passwordSecurity';

/**
 * Converte uma linha da tabela system_users (vinda do banco) em um acesso do app.
 * O banco guarda o hash em `password_hash`; a coluna `pin` contém só um marcador
 * ("[PROTEGIDO_CRIPTOGRAFADO]"), que NÃO pode ser usado para validar a senha.
 */
export function mapDbUserToAuthUser(u: any): AuthUser {
  const secret = pickStoredSecret(u.password_hash, u.pin);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    companyId: u.tenant_id || u.companyId || '00000000000001',
    companyName: 'CEC Conecta',
    avatarUrl: '',
    phone: u.phone,
    pin: secret,
    password_hash: secret,
    lastLogin: u.last_login || u.lastLogin,
    status: u.is_active === 0 || u.is_active === false || u.status === 'bloqueado' ? 'bloqueado' : 'ativo',
    matricula: u.matricula,
  };
}

/**
 * Mescla os acessos do banco com os locais. O banco prevalece, mas se ele não trouxer
 * um segredo utilizável, mantém o que já existia no aparelho (evita perder a senha).
 */
export function mergeAuthUsers(prev: AuthUser[], incoming: AuthUser[]): AuthUser[] {
  const merged = [...prev];
  incoming.forEach((nu) => {
    const idx = merged.findIndex((x) => x.id === nu.id || x.email.toLowerCase() === nu.email.toLowerCase());
    if (idx >= 0) {
      const old = merged[idx];
      const secret = pickStoredSecret(nu.password_hash, nu.pin) ?? pickStoredSecret(old.password_hash, old.pin);
      merged[idx] = { ...nu, pin: secret, password_hash: secret };
    } else {
      merged.push(nu);
    }
  });
  return merged;
}
