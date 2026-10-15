import { Router, Request, Response, NextFunction } from 'express';
import { cleanCNPJ } from '../../utils/cnpjValidator.js';

export const receitaWsRouter = Router();

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const CNPJ_PATTERN = /^[A-Z0-9]{12}[0-9]{2}$/; // 12 alfanuméricos + 2 dígitos verificadores
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de retenção em cache
const UPSTREAM_TIMEOUT_MS = 9000;

// A API pública da ReceitaWS permite 3 consultas por minuto (cota COMPARTILHADA por todos os clientes).
const UPSTREAM_LIMIT = 3;
const UPSTREAM_WINDOW_MS = 60 * 1000;

// Limite por cliente (IP) nesta rota, para que um único cliente não consuma a cota de todos.
const CLIENT_LIMIT = 10; // requisições (inclui respostas vindas do cache)
const CLIENT_WINDOW_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Estado em memória (reinicia junto com o servidor)
// ---------------------------------------------------------------------------
interface CacheEntry {
  data: any;
  cachedAt: number;
}
const cnpjCache = new Map<string, CacheEntry>();

// Consultas em andamento por CNPJ (evita 2 chamadas simultâneas ao mesmo CNPJ)
const inFlight = new Map<string, Promise<UpstreamResult>>();

// Janela deslizante de chamadas feitas à ReceitaWS
let upstreamCalls: number[] = [];
// Se a ReceitaWS responder 429, paramos de chamá-la até este instante
let upstreamBlockedUntil = 0;

// Janela deslizante por cliente
const clientCalls = new Map<string, number[]>();

// Limpeza periódica para não acumular memória
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, calls] of clientCalls) {
    const recent = calls.filter((t) => now - t < CLIENT_WINDOW_MS);
    if (recent.length === 0) clientCalls.delete(ip);
    else clientCalls.set(ip, recent);
  }
  for (const [cnpj, entry] of cnpjCache) {
    if (now - entry.cachedAt >= CACHE_TTL_MS) cnpjCache.delete(cnpj);
  }
}, 60 * 1000);
cleanupTimer.unref?.();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function retryAfterSeconds(oldestCallAt: number, windowMs: number, now: number): number {
  return Math.max(1, Math.ceil((oldestCallAt + windowMs - now) / 1000));
}

function sendRateLimited(res: Response, seconds: number, message: string) {
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({
    status: 'ERROR',
    code: 429,
    retryAfterSeconds: seconds,
    message,
  });
}

/** Reserva uma vaga na cota da ReceitaWS. Retorna os segundos de espera quando não há vaga. */
function reserveUpstreamSlot(now: number): { ok: true } | { ok: false; seconds: number } {
  if (now < upstreamBlockedUntil) {
    return { ok: false, seconds: Math.max(1, Math.ceil((upstreamBlockedUntil - now) / 1000)) };
  }
  upstreamCalls = upstreamCalls.filter((t) => now - t < UPSTREAM_WINDOW_MS);
  if (upstreamCalls.length >= UPSTREAM_LIMIT) {
    return { ok: false, seconds: retryAfterSeconds(upstreamCalls[0], UPSTREAM_WINDOW_MS, now) };
  }
  upstreamCalls.push(now);
  return { ok: true };
}

/** Limite de requisições por IP nesta rota */
function clientRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (clientCalls.get(key) || []).filter((t) => now - t < CLIENT_WINDOW_MS);

  if (recent.length >= CLIENT_LIMIT) {
    clientCalls.set(key, recent);
    return sendRateLimited(
      res,
      retryAfterSeconds(recent[0], CLIENT_WINDOW_MS, now),
      'Muitas consultas de CNPJ em pouco tempo. Aguarde alguns segundos antes de tentar novamente.'
    );
  }

  recent.push(now);
  clientCalls.set(key, recent);
  next();
}

// ---------------------------------------------------------------------------
// Chamada à ReceitaWS
// ---------------------------------------------------------------------------
type UpstreamResult =
  | { kind: 'ok'; data: any }
  | { kind: 'http'; status: number; body: any };

async function fetchFromReceitaWs(cnpj: string): Promise<UpstreamResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ControleEstoqueCMV-SaaS/1.0 (Integration ReceitaWS)',
      },
      signal: controller.signal,
    });

    // Rate limit da própria ReceitaWS (HTTP 429): suspende novas chamadas por 1 minuto
    if (response.status === 429) {
      upstreamBlockedUntil = Date.now() + UPSTREAM_WINDOW_MS;
      return {
        kind: 'http',
        status: 429,
        body: {
          status: 'ERROR',
          code: 429,
          retryAfterSeconds: Math.ceil(UPSTREAM_WINDOW_MS / 1000),
          message:
            'Limite da API pública da Receita Federal atingido (máximo de 3 consultas por minuto). Aguarde cerca de 1 minuto antes de tentar novamente.',
        },
      };
    }

    // Timeout de consulta no banco da Receita (HTTP 504)
    if (response.status === 504) {
      return {
        kind: 'http',
        status: 504,
        body: {
          status: 'ERROR',
          code: 504,
          message: 'Tempo limite excedido na base pública da Receita Federal (HTTP 504). Tente novamente em alguns instantes.',
        },
      };
    }

    if (!response.ok) {
      return {
        kind: 'http',
        status: response.status,
        body: {
          status: 'ERROR',
          code: response.status,
          message: `A API da Receita Federal retornou status ${response.status}: ${response.statusText}`,
        },
      };
    }

    const data = (await response.json()) as any;

    // Erro de negócio da própria ReceitaWS (ex: status: "ERROR")
    if (data.status === 'ERROR') {
      return {
        kind: 'http',
        status: 400,
        body: {
          status: 'ERROR',
          message: data.message || 'CNPJ não localizado ou inválido na base da Receita Federal.',
        },
      };
    }

    return { kind: 'ok', data };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Rota GET /api/receitaws/:cnpj
// Consulta os dados oficiais da empresa na Receita Federal via ReceitaWS
// (aceita CNPJ numérico e alfanumérico)
// ---------------------------------------------------------------------------
receitaWsRouter.get('/receitaws/:cnpj', clientRateLimit, async (req, res) => {
  const cnpj = cleanCNPJ(req.params.cnpj);

  if (!CNPJ_PATTERN.test(cnpj)) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'CNPJ inválido. O CNPJ deve possuir 14 caracteres (12 alfanuméricos + 2 dígitos verificadores numéricos).',
    });
  }

  // 1. Cache em memória (não consome a cota da ReceitaWS)
  const now = Date.now();
  const cached = cnpjCache.get(cnpj);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return res.json({
      ...cached.data,
      fromCache: true,
      cacheAgeSeconds: Math.round((now - cached.cachedAt) / 1000),
    });
  }

  try {
    // 2. Se já existe uma consulta em andamento para este CNPJ, reaproveita (não consome nova vaga)
    let pending = inFlight.get(cnpj);

    if (!pending) {
      // 3. Reserva vaga na cota global da ReceitaWS antes de chamar
      const slot = reserveUpstreamSlot(now);
      if (!slot.ok) {
        return sendRateLimited(
          res,
          slot.seconds,
          `Limite da API pública da Receita Federal atingido (máximo de 3 consultas por minuto). Tente novamente em ${slot.seconds} segundo(s).`
        );
      }

      pending = fetchFromReceitaWs(cnpj).finally(() => inFlight.delete(cnpj));
      inFlight.set(cnpj, pending);
    }

    const result = await pending;

    if (result.kind === 'http') {
      if (result.body?.retryAfterSeconds) {
        res.setHeader('Retry-After', String(result.body.retryAfterSeconds));
      }
      return res.status(result.status).json(result.body);
    }

    cnpjCache.set(cnpj, { data: result.data, cachedAt: Date.now() });
    return res.json({ ...result.data, fromCache: false });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({
        status: 'ERROR',
        code: 504,
        message: 'A consulta à Receita Federal expirou após 9 segundos (Timeout). Tente novamente.',
      });
    }

    console.error(`[ReceitaWS] Erro ao consultar CNPJ ${cnpj}:`, error?.message || error);

    return res.status(500).json({
      status: 'ERROR',
      message: `Falha na comunicação com o serviço da Receita Federal: ${error?.message || 'Erro de conexão'}`,
    });
  }
});
