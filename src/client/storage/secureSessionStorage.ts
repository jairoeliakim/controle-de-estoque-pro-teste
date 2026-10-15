/**
 * ==============================================================================
 * ARMAZENAMENTO SEGURO DE SESSÃO (WEB & MOBILE 100% ONLINE)
 * ==============================================================================
 * 
 * DIRETRIZES DE ARQUITETURA DE SEGURANÇA:
 * 1. NENHUM DADO DE ESTOQUE OU REGRA DE NEGÓCIO É PERSISTIDO NO APARELHO.
 * 2. Armazena EXCLUSIVAMENTE os tokens de autenticação (access_token e refresh_token).
 * 3. Mobile: Utiliza hardware-backed Keystore (Android) e Keychain (iOS) via Expo SecureStore
 *    ou flutter_secure_storage.
 * 4. Web: Preferência por cookies HttpOnly + SameSite=Strict ou sessionStorage efêmero em memória.
 */

export interface TokenSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // timestamp ms
}

// Chaves reservadas no cofre seguro
const ACCESS_TOKEN_KEY = 'saas_inventory_access_token';
const REFRESH_TOKEN_KEY = 'saas_inventory_refresh_token';
const EXPIRES_AT_KEY = 'saas_inventory_token_expires_at';

/**
 * Interface unificada para Web e Mobile (React Native / Expo / Capacitor / Web)
 */
export interface ISecureSessionStorage {
  saveTokens(session: TokenSession): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  clearSession(): Promise<void>;
  isSessionValid(): Promise<boolean>;
}

// Implementação em Memória / Web SessionStorage Seguro
class WebSecureSessionStorage implements ISecureSessionStorage {
  private inMemoryAccessToken: string | null = null;
  private inMemoryRefreshToken: string | null = null;
  private inMemoryExpiresAt: number = 0;

  async saveTokens(session: TokenSession): Promise<void> {
    this.inMemoryAccessToken = session.accessToken;
    this.inMemoryRefreshToken = session.refreshToken || null;
    this.inMemoryExpiresAt = session.expiresAt;

    // Em navegadores, salva em sessionStorage (limpo ao fechar a aba/janela)
    // Para segurança estrita contra XSS, o ideal é o backend emitir HttpOnly Cookies
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
      if (session.refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
      }
      sessionStorage.setItem(EXPIRES_AT_KEY, session.expiresAt.toString());
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (this.inMemoryAccessToken) return this.inMemoryAccessToken;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return null;
  }

  async getRefreshToken(): Promise<string | null> {
    if (this.inMemoryRefreshToken) return this.inMemoryRefreshToken;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return null;
  }

  async clearSession(): Promise<void> {
    this.inMemoryAccessToken = null;
    this.inMemoryRefreshToken = null;
    this.inMemoryExpiresAt = 0;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(EXPIRES_AT_KEY);
    }
  }

  async isSessionValid(): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) return false;
    let expiresAt = this.inMemoryExpiresAt;
    if (!expiresAt && typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem(EXPIRES_AT_KEY);
      if (stored) expiresAt = parseInt(stored, 10);
    }
    if (expiresAt && Date.now() >= expiresAt) {
      return false; // Token expirado
    }
    return true;
  }

  /**
   * Inicializa sessão com token válido para ambiente de testes e demonstração
   */
  async initDefaultSession(role: 'admin' | 'operador' = 'operador'): Promise<string> {
    const isValid = await this.isSessionValid();
    if (isValid) {
      const token = await this.getAccessToken();
      if (token) return token;
    }

    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: 'tenant-restaurante-matriz',
          role,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        await this.saveTokens({
          accessToken: data.access_token,
          expiresAt: Date.now() + 86400 * 1000,
        });
        return data.access_token;
      }
    } catch (e) {
      console.warn('Falha ao inicializar sessão automática:', e);
    }
    return '';
  }
}

/**
 * Exemplo de adaptador para React Native / Expo Mobile:
 * 
 * ```typescript
 * import * as SecureStore from 'expo-secure-store';
 * 
 * export class MobileSecureSessionStorage implements ISecureSessionStorage {
 *   async saveTokens(session: TokenSession): Promise<void> {
 *     await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken, {
 *       keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
 *     });
 *     if (session.refreshToken) {
 *       await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
 *     }
 *   }
 * 
 *   async getAccessToken(): Promise<string | null> {
 *     return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
 *   }
 * 
 *   async clearSession(): Promise<void> {
 *     await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
 *     await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
 *   }
 * }
 * ```
 */

export const secureSession = new WebSecureSessionStorage();
