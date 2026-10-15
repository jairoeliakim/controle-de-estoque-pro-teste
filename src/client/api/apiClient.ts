import { secureSession } from '../storage/secureSessionStorage.js';

export class OfflineConnectionError extends Error {
  public isOfflineError = true;
  constructor(
    message = 'Operação bloqueada: o dispositivo está sem conexão à internet. O sistema opera 100% online para garantir saldo real e evitar furos de estoque.'
  ) {
    super(message);
    this.name = 'OfflineConnectionError';
  }
}

export class ApiError extends Error {
  public status: number;
  public data: any;
  public isRollback: boolean;

  constructor(status: number, message: string, data?: any, isRollback = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isRollback = isRollback;
  }
}

// Simulador de estado de rede (útil tanto para produção quanto para testes de bancada no browser)
let simulatedOffline = false;

export function setSimulatedOffline(offline: boolean) {
  simulatedOffline = offline;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('saas-network-status-change', { detail: { isOnline: !offline } }));
  }
}

export function isDeviceOnline(): boolean {
  if (simulatedOffline) return false;
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

/**
 * Cliente HTTP Seguro com Interceptor de Conexão Online & Injeção de JWT
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // 1. INTERCEPTOR PRÉ-SUBMISSÃO: Bloqueio estrito se estiver Offline
  if (!isDeviceOnline()) {
    throw new OfflineConnectionError();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // 2. INJEÇÃO DO TOKEN JWT DO STORAGE SEGURO
  const token = await secureSession.getAccessToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. EXECUÇÃO DA REQUISIÇÃO
  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (networkError: any) {
    // Falha de rede durante o trânsito (queda de conexão súbita)
    if (!navigator.onLine) {
      throw new OfflineConnectionError();
    }
    throw new ApiError(0, 'Falha de comunicação com o servidor de estoque.');
  }

  // 4. PARSER E TRATAMENTO DE ERROS DA API
  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // HTTP 422: Saldo Insuficiente / Rollback da transação
    if (response.status === 422) {
      throw new ApiError(
        422,
        data?.message || 'Saldo insuficiente para a saída solicitada. Transação revertida.',
        data,
        true
      );
    }

    // HTTP 402 / 403: Assinatura SaaS Bloqueada
    if (response.status === 402 || (response.status === 403 && data?.error?.includes('SUBSCRIPTION'))) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saas-billing-lock-triggered', { detail: data }));
      }
      throw new ApiError(response.status, data?.message || 'Acesso bloqueado por pendência de faturamento.', data);
    }

    // HTTP 401: Token Expirado
    if (response.status === 401) {
      await secureSession.clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saas-auth-unauthorized'));
      }
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.', data);
    }

    throw new ApiError(
      response.status,
      data?.message || data?.error || `Erro na requisição (Status ${response.status})`,
      data
    );
  }

  return data as T;
}
