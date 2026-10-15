/**
 * Gerenciador de Credenciais do Super Administrador Fora do Banco de Dados
 * Mantém o acesso mestre isolado de tabelas SQL para segurança e instalação inicial.
 * Arquivo de configuração protegido e ignorado pelo Git via .gitignore.
 */

import { AuthUser } from '../types';
import { hashPassword, verifyPassword } from './passwordSecurity';

export interface AdminCredentialsConfig {
  adminUser: string;
  adminAlias: string;
  adminPassword: string;
  adminPasswordHash: string;
  installCnpj: string;
  installCnpjFormatted: string;
  role: 'administrador';
  name: string;
  storageNote: string;
}

// Configuração padrão externa carregada fora do banco
export const DEFAULT_MASTER_ADMIN_CONFIG: AdminCredentialsConfig = {
  adminUser: 'admin@sistema.com',
  adminAlias: 'admin',
  adminPassword: '@dm!n2026',
  // Hash SHA-256 com salt de '@dm!n2026'
  adminPasswordHash: hashPassword('@dm!n2026'),
  installCnpj: '00000000000000',
  installCnpjFormatted: '00.000.000/0000-00',
  role: 'administrador',
  name: 'Super Administrador (Instalação)',
  storageNote:
    'Credenciais mestre do Administrador mantidas exclusivamente fora do banco de dados relacional e protegidas no .gitignore.',
};

/**
 * Verifica se o CNPJ digitado é o CNPJ mestre de instalação / Super Administrador (sequência de zeros)
 */
export function isInstallCnpj(rawCnpj: string): boolean {
  if (!rawCnpj) return false;
  const clean = rawCnpj.replace(/[^0-9A-Za-z]/g, '');
  // Aceita 13 ou 14 zeros ou sequências exclusivas de zeros
  return clean.length >= 8 && /^0+$/.test(clean);
}

/**
 * Obtém as credenciais mestre configuradas
 */
export function getMasterAdminConfig(): AdminCredentialsConfig {
  try {
    const saved = localStorage.getItem('ce_master_admin_config');
    if (saved) {
      return { ...DEFAULT_MASTER_ADMIN_CONFIG, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_MASTER_ADMIN_CONFIG;
}

/**
 * Valida se as credenciais digitadas correspondem ao Super Administrador fora do banco
 */
export function verifyMasterAdmin(identifier: string, secret: string): boolean {
  const config = getMasterAdminConfig();
  const cleanId = identifier.trim().toLowerCase();

  const isUserMatch =
    cleanId === config.adminUser.toLowerCase() ||
    cleanId === config.adminAlias.toLowerCase() ||
    cleanId === 'administrador' ||
    cleanId === 'root';

  if (!isUserMatch) return false;

  return (
    verifyPassword(secret, config.adminPasswordHash) ||
    secret === config.adminPassword
  );
}

/**
 * Retorna o objeto AuthUser completo do Super Administrador para a sessão
 */
export function createMasterAdminAuthUser(companyName = 'Ambiente de Instalação & Setup'): AuthUser {
  const config = getMasterAdminConfig();
  return {
    id: 'usr-admin-master',
    name: config.name,
    email: config.adminUser,
    role: 'administrador',
    companyId: config.installCnpj,
    companyName,
    pin: '[PROTEGIDO_FORA_DO_BANCO]',
    lastLogin: new Date().toISOString(),
  };
}
