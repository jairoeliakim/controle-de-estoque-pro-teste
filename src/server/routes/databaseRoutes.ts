import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { Router, Request, Response } from 'express';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { generateDatabaseScript, SYSTEM_TABLES, DatabaseEngine } from '../../utils/databaseScripts.js';
import { validateCNPJ, cleanCNPJ } from '../../utils/cnpjValidator.js';
import { hashPassword } from '../../utils/passwordSecurity.js';
import { inventoryStore } from '../db/inventoryStore.js';

export const databaseRouter = Router();

// Caminho do arquivo de configuração persistente
// Na Vercel o disco é somente leitura (exceto /tmp, temporário e por instância)
const CONFIG_FILE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), '.database-config.json')
  : path.resolve(process.cwd(), '.database-config.json');

// Teste de conectividade real via Socket TCP (camada 4 - rede/porta)
function testTcpSocket(
  host: string,
  port: number,
  timeoutMs = 2500
): Promise<{ reachable: boolean; latencyMs: number; error?: string; code?: string }> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!settled) {
        settled = true;
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      }
    });

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({
          reachable: false,
          latencyMs: timeoutMs,
          code: 'ETIMEDOUT',
          error: `Tempo limite esgotado (${timeoutMs}ms) ao tentar conectar em ${host}:${port}. O servidor ou porta não respondeu.`,
        });
      }
    });

    socket.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        let reason = err.message || 'Falha de conexão';
        if (err.code === 'ECONNREFUSED') {
          reason = `Conexão recusada na porta ${port} do host "${host}". O serviço não está em execução ou não está aceitando conexões.`;
        } else if (err.code === 'ENOTFOUND') {
          reason = `Endereço/host "${host}" não foi encontrado (falha de resolução DNS). Verifique se o IP ou domínio está correto.`;
        } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
          reason = `Host "${host}" ou rede está inacessível a partir deste ambiente.`;
        }
        resolve({
          reachable: false,
          latencyMs: Date.now() - startTime,
          code: err.code,
          error: reason,
        });
      }
    });

    socket.connect(port, host);
  });
}

// Diagnóstico específico para o Supabase (erros comuns e mensagens claras)
function describeSupabaseIssue(
  config: { host: string; port: number; database: string; username: string; ssl?: boolean },
  err: any
): { type: string; code: string; message: string; recommendation: string } | null {
  const host = String(config.host || '').toLowerCase();
  const isDirect = /^db\.[a-z0-9]+\.supabase\.co$/.test(host);
  const isPooler = /\.pooler\.supabase\.com$/.test(host);
  if (!isDirect && !isPooler) return null;

  const msg = String(err?.message || '');
  const code = String(err?.code || '');

  // Sem SSL (o Supabase exige conexão criptografada)
  if (!config.ssl && /ssl|encrypt|pg_hba/i.test(msg)) {
    return {
      type: 'SSL_REQUIRED',
      code: code || 'SSL_REQUIRED',
      message: 'O Supabase exige conexão criptografada. Marque a opção "Habilitar conexão criptografada SSL/TLS".',
      recommendation: 'Marque a caixa de SSL/TLS e teste novamente.',
    };
  }

  // Endereço direto = IPv6 apenas; ambientes IPv4 (como a Vercel) não alcançam
  const networkCodes = ['ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'ETIMEDOUT'];
  if (isDirect && (networkCodes.includes(code) || /timeout/i.test(msg))) {
    return {
      type: 'SUPABASE_IPV6_ONLY',
      code: code || 'SUPABASE_IPV6_ONLY',
      message: `Não foi possível alcançar ${config.host}: o endereço direto do Supabase usa apenas IPv6 e a Vercel só sai por IPv4.`,
      recommendation:
        'Use o "Session pooler" do Supabase:\n1. No Supabase, clique em Connect e escolha o método "Session pooler".\n2. Copie o host (aws-0-REGIAO.pooler.supabase.com), a porta (5432) e o usuário (postgres.SEU_REF).\n3. Use esses valores aqui, com SSL marcado.',
    };
  }

  // Pooler exige usuário no formato postgres.<ref-do-projeto>
  if (isPooler && /tenant or user not found/i.test(msg)) {
    return {
      type: 'SUPABASE_POOLER_USER',
      code: code || 'SUPABASE_POOLER_USER',
      message: 'O pooler do Supabase não encontrou o projeto/usuário informado.',
      recommendation:
        'No pooler o usuário deve ser "postgres.SEU_REF" (ex.: postgres.abcdefghijklmnop), e não apenas "postgres". Copie o valor exato em Connect > Session pooler.',
    };
  }

  // No Supabase o banco padrão se chama "postgres" (o nome do projeto não é o nome do banco)
  if (code === '3D000') {
    return {
      type: 'DATABASE_DOES_NOT_EXIST',
      code,
      message: `O banco "${config.database}" não existe nesse projeto do Supabase.`,
      recommendation:
        'No Supabase o nome do banco é "postgres" (o nome do projeto, como "Restaurante_teste", não é o nome do banco). Preencha "Nome do Banco de Dados" com postgres.',
    };
  }

  return null;
}

// Validação real de protocolo no PostgreSQL (valida existência do banco, usuário e senha)
async function testPostgresConnection(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl?: boolean;
  timeoutMs?: number;
}): Promise<{
  connected: boolean;
  databaseExists?: boolean;
  serverVersion?: string;
  latencyMs?: number;
  errorType?: string;
  errorCode?: string;
  message?: string;
  recommendation?: string;
}> {
  const startTime = Date.now();
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password || '',
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: config.timeoutMs || 8000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT version();');
    const latencyMs = Date.now() - startTime;
    await client.end();

    const versionStr = res.rows[0]?.version?.split(' ')?.[0] + ' ' + res.rows[0]?.version?.split(' ')?.[1] || 'PostgreSQL';

    return {
      connected: true,
      databaseExists: true,
      serverVersion: versionStr,
      latencyMs,
      message: `Conexão com PostgreSQL em ${config.host}:${config.port} autenticada com sucesso! O banco "${config.database}" existe e está ativo.`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    try {
      await client.end();
    } catch {}

    const supabaseIssue = describeSupabaseIssue(config, err);
    if (supabaseIssue) {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: supabaseIssue.code,
        errorType: supabaseIssue.type,
        message: supabaseIssue.message,
        recommendation: supabaseIssue.recommendation,
      };
    }

    if (err.code === '3D000') {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: '3D000',
        errorType: 'DATABASE_DOES_NOT_EXIST',
        message: `O banco de dados "${config.database}" NÃO existe no PostgreSQL (${config.host}:${config.port}).`,
        recommendation: `O servidor PostgreSQL está online e acessível, mas a base "${config.database}" ainda não foi criada.\n\nPara solucionar:\n1. Acesse seu PostgreSQL (via pgAdmin, psql ou terminal).\n2. Execute o comando:\n   CREATE DATABASE ${config.database};\n3. Após criar o banco, teste o vínculo novamente.`,
      };
    }

    if (err.code === '28P01') {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: '28P01',
        errorType: 'AUTH_FAILED',
        message: `Falha de autenticação: senha incorreta para o usuário "${config.username}".`,
        recommendation: `Verifique a senha informada nas configurações de vínculo do banco.`,
      };
    }

    if (err.code === '28000') {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: '28000',
        errorType: 'USER_NOT_FOUND',
        message: `O usuário "${config.username}" não existe no PostgreSQL.`,
        recommendation: `Verifique o nome de usuário digitado ou crie o usuário com permissões no PostgreSQL.`,
      };
    }

    if (err.code === 'ECONNREFUSED') {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: 'ECONNREFUSED',
        errorType: 'CONNECTION_REFUSED',
        message: `Conexão recusada na porta ${config.port} de "${config.host}". O serviço do PostgreSQL não está rodando nesta porta ou o firewall está bloqueando.`,
        recommendation: `1. Certifique-se de que o serviço do PostgreSQL está iniciado.\n2. Verifique se a porta ${config.port} está liberada.\n3. Caso o PostgreSQL esteja no seu computador local e você esteja testando na nuvem, use um host com IP público, ngrok, ou ative o "Modo Simulado em Memória".`,
      };
    }

    return {
      connected: false,
      databaseExists: false,
      latencyMs,
      errorCode: err.code || 'UNKNOWN',
      errorType: 'PG_ERROR',
      message: `Erro ao conectar ao PostgreSQL: ${err.message}`,
      recommendation: `Verifique os parâmetros de host, porta, nome do banco e credenciais.`,
    };
  }
}

// Validação real de protocolo no MySQL (valida existência do banco, usuário e senha)
async function testMysqlConnection(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl?: boolean;
  timeoutMs?: number;
}): Promise<{
  connected: boolean;
  databaseExists?: boolean;
  serverVersion?: string;
  latencyMs?: number;
  errorType?: string;
  errorCode?: string;
  message?: string;
  recommendation?: string;
}> {
  const startTime = Date.now();
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password || '',
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: config.timeoutMs || 3000,
    });

    const [rows]: any = await connection.query('SELECT VERSION() as version');
    const latencyMs = Date.now() - startTime;
    await connection.end();

    const versionStr = rows?.[0]?.version ? `MySQL ${rows[0].version}` : 'MySQL Server 8.0';

    return {
      connected: true,
      databaseExists: true,
      serverVersion: versionStr,
      latencyMs,
      message: `Conexão com MySQL em ${config.host}:${config.port} autenticada com sucesso! O banco "${config.database}" existe e está pronto.`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;

    if (err.code === 'ER_BAD_DB_ERROR' || err.errno === 1049) {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: '1049',
        errorType: 'DATABASE_DOES_NOT_EXIST',
        message: `O banco de dados "${config.database}" NÃO existe no MySQL (${config.host}:${config.port}).`,
        recommendation: `O servidor MySQL respondeu, mas o banco "${config.database}" ainda não foi criado.\n\nPara solucionar:\n1. Acesse o MySQL (via MySQL Workbench ou terminal mysql).\n2. Execute:\n   CREATE DATABASE ${config.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n3. Após criar o banco, teste o vínculo novamente.`,
      };
    }

    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045) {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: '1045',
        errorType: 'AUTH_FAILED',
        message: `Acesso negado para o usuário "${config.username}" no MySQL. Senha incorreta ou usuário sem privilégios.`,
        recommendation: `Verifique se o usuário e a senha informados estão corretos no MySQL.`,
      };
    }

    if (err.code === 'ECONNREFUSED') {
      return {
        connected: false,
        databaseExists: false,
        latencyMs,
        errorCode: 'ECONNREFUSED',
        errorType: 'CONNECTION_REFUSED',
        message: `Conexão recusada na porta ${config.port} de "${config.host}". O serviço do MySQL não está em execução.`,
        recommendation: `Verifique se o serviço MySQL está ativo e aceitando conexões na porta ${config.port}.`,
      };
    }

    return {
      connected: false,
      databaseExists: false,
      latencyMs,
      errorCode: err.code || 'UNKNOWN',
      errorType: 'MYSQL_ERROR',
      message: `Erro ao conectar ao MySQL: ${err.message}`,
      recommendation: `Verifique os parâmetros de host, porta, nome do banco e credenciais.`,
    };
  }
}

// Estado em memória do vínculo com banco de dados
let linkedDatabaseState: {
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl: boolean;
  status: 'desconectado' | 'conectado' | 'erro';
  isSimulationMode?: boolean;
  databaseExists?: boolean;
  errorMessage?: string;
  lastConnectedAt?: string;
  tablesCreated: boolean;
  tablesCount?: number;
  lastMigrationAt?: string;
  serverVersion?: string;
  totalRecordsCount?: number;
  lastInsertedAt?: string;
} = {
  engine: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'restaurante_estoque_db',
  username: 'postgres',
  password: '',
  ssl: false,
  status: 'desconectado',
  isSimulationMode: false,
  databaseExists: false,
  tablesCreated: false,
  totalRecordsCount: 0,
};

// Estado em memória das configurações de banco de cada Tenant/Empresa
let tenantDatabaseConfigs: Record<string, typeof linkedDatabaseState> = {};

// Estado do vínculo SEM a senha (usado nas respostas da API)
function publicDbState() {
  const { password: _password, ...rest } = linkedDatabaseState;
  return rest;
}

// Persistência em disco do arquivo de configuração (com suporte a multi-tenant)
function savePersistedConfig(state: typeof linkedDatabaseState) {
  // Na Vercel, arquivos locais (/tmp inclusive) são efêmeros e variam por instância.
  // A configuração de produção deve vir de variáveis de ambiente, nunca deste arquivo.
  if (process.env.VERCEL) {
    console.info('[DB Config] Vercel detectada: configuração mantida por variáveis de ambiente; arquivo local não é persistente.');
    return;
  }
  try {
    const toSave = {
      ...state,
      tenantConfigs: tenantDatabaseConfigs,
    };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[DB Config Save Warning]:', err.message);
  }
}

function tryRestorePersistedConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const loaded = JSON.parse(content);
      if (loaded && loaded.database && loaded.host) {
        const isLocal = loaded.host === 'localhost' || loaded.host === '127.0.0.1';
        linkedDatabaseState = {
          ...linkedDatabaseState,
          ...loaded,
          // Evita assumir conectado em localhost em contêiner se não for modo simulado
          status: isLocal && !loaded.isSimulationMode ? 'desconectado' : loaded.status,
        };

        if (loaded.tenantConfigs && typeof loaded.tenantConfigs === 'object') {
          tenantDatabaseConfigs = loaded.tenantConfigs;
        } else {
          // Atribui ao tenant padrão '00000000000001' a configuração carregada
          tenantDatabaseConfigs['00000000000001'] = { ...linkedDatabaseState };
        }

        console.info(`[DB Config Loaded] Banco pré-configurado: ${linkedDatabaseState.engine.toUpperCase()} em ${linkedDatabaseState.host}:${linkedDatabaseState.port}/${linkedDatabaseState.database} (status: ${linkedDatabaseState.status}) - ${Object.keys(tenantDatabaseConfigs).length} tenant(s) parametrizado(s)`);
      }
    }
  } catch (err: any) {
    console.warn('[DB Config Load Warning]:', err.message);
  }
}

// Configuração persistente de produção. Na Vercel, use DATABASE_URL (preferencial)
// ou DB_ENGINE/DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_SSL.
// A configuração é carregada em cada instância serverless e aplicada ao tenant padrão.
function restoreConfigFromEnv() {
  const defaultTenantId = String(process.env.DEFAULT_TENANT_ID || '00000000000001').trim();
  const url = process.env.DATABASE_URL;

  try {
    let config: typeof linkedDatabaseState | null = null;

    if (url) {
      const u = new URL(url);
      const proto = u.protocol.replace(':', '').toLowerCase();
      const engine: DatabaseEngine | null = proto.startsWith('postgres') ? 'postgres' : proto.startsWith('mysql') ? 'mysql' : null;
      if (!engine) {
        console.warn('[DB Env Warning]: DATABASE_URL deve começar com postgresql:// ou mysql://');
        return;
      }
      const sslMode = (u.searchParams.get('sslmode') || '').toLowerCase();
      config = {
        ...linkedDatabaseState,
        engine,
        host: u.hostname,
        port: Number(u.port) || (engine === 'postgres' ? 5432 : 3306),
        database: decodeURIComponent(u.pathname.replace(/^\//, '')) || (engine === 'postgres' ? 'postgres' : ''),
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        ssl: sslMode ? sslMode !== 'disable' : (process.env.DB_SSL || 'true').toLowerCase() !== 'false',
        status: 'conectado',
        isSimulationMode: false,
        databaseExists: true,
        errorMessage: undefined,
        lastConnectedAt: new Date().toISOString(),
      };
    } else if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER) {
      const engine = (process.env.DB_ENGINE || 'postgres').toLowerCase() as DatabaseEngine;
      config = {
        ...linkedDatabaseState,
        engine,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || (engine === 'postgres' ? 5432 : 3306),
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        ssl: (process.env.DB_SSL || 'true').toLowerCase() !== 'false',
        status: 'conectado',
        isSimulationMode: false,
        databaseExists: true,
        errorMessage: undefined,
        lastConnectedAt: new Date().toISOString(),
      };
    }

    if (!config) return;
    linkedDatabaseState = config;
    tenantDatabaseConfigs[defaultTenantId] = { ...config };
    // Também cobre o identificador padrão usado em versões anteriores do aplicativo.
    tenantDatabaseConfigs['00000000000001'] = { ...config };
    console.info(`[DB Env Loaded] ${config.engine.toUpperCase()} configurado por ambiente em ${config.host}:${config.port}/${config.database}`);
  } catch (err: any) {
    console.warn('[DB Env Warning]: configuração de banco por ambiente inválida:', err.message);
  }
}

// Restaura na inicialização (arquivo em disco e, com prioridade, variável de ambiente)
tryRestorePersistedConfig();
restoreConfigFromEnv();

// Histórico de comandos SQL executados / alimentados
export interface SqlExecutionLog {
  id: string;
  timestamp: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';
  sql: string;
  engine: DatabaseEngine;
  recordsAffected: number;
}

const sqlExecutionLogs: SqlExecutionLog[] = [];

// Base de Dados Relacional Unificada por Tabelas (Em Memória / Cache Espelho)
const databaseTables: Record<string, Map<string, any>> = {
  tenants_companies: new Map(),
  system_users: new Map(),
  system_settings: new Map(),
  categories: new Map(),
  suppliers: new Map(),
  stock_items: new Map(),
  supplier_quotes: new Map(),
  stock_movements: new Map(),
  stock_count_sessions: new Map(),
  stock_count_entries: new Map(),
  unlisted_count_items: new Map(),
  loss_records: new Map(),
  purchase_orders: new Map(),
  purchase_order_items: new Map(),
  invoices_history: new Map(),
};

// MAPPER ROBUSTO DE DOMÍNIO -> COLUNAS SQL DO ESQUEMA DDL
export function mapEntityToSqlRow(tableName: string, entity: any, defaultTenant = '00000000000001'): Record<string, any> {
  const now = new Date().toISOString();
  const resolveTenant = (rawTenant: any) => {
    const t = String(rawTenant || defaultTenant).trim();
    if (t === 'comp-matriz' || t === 'emp-matriz') return '00000000000001';
    return t || '00000000000001';
  };

  switch (tableName) {
    case 'tenants_companies': {
      const rawCnpj = entity.cnpj || entity.documento_identificador || entity.documentoIdentificador || '00.000.000/0000-00';
      const cleanCnpj = cleanCNPJ(String(rawCnpj)) || '00000000000001';
      const compId = entity.id && entity.id !== 'comp-matriz' && entity.id !== 'emp-matriz'
        ? entity.id
        : cleanCnpj;
      const pais = String(entity.paisOrigem || entity.pais_origem || 'BR').toUpperCase().slice(0, 2);
      const tipoDoc = String(entity.tipoDocumento || entity.tipo_documento || (pais === 'BR' ? 'CNPJ' : 'TAX_ID')).slice(0, 20);
      const docId = String(entity.documentoIdentificador || entity.documento_identificador || (pais === 'BR' ? cleanCnpj : rawCnpj)).slice(0, 35);

      return {
        id: String(compId),
        name: String(entity.name || 'CEC Conecta'),
        trade_name: entity.tradeName || entity.trade_name || entity.name || null,
        cnpj: String(entity.cnpj || rawCnpj),
        pais_origem: pais,
        tipo_documento: tipoDoc,
        documento_identificador: docId,
        city: entity.city || 'Patrocinio',
        state: entity.state || 'MG',
        phone: entity.phone || null,
        email: entity.email || null,
        is_active: Boolean(entity.active !== false && entity.is_active !== false && entity.is_active !== 0),
        created_at: entity.createdAt || entity.created_at || now,
        updated_at: now,
      };
    }

    case 'categories':
      return {
        id: String(entity.id),
        tenant_id: resolveTenant(entity.tenant_id || entity.companyId),
        name: String(entity.name || 'Geral'),
        description: entity.description || null,
        created_at: entity.createdAt || entity.created_at || now,
      };

    case 'system_users': {
      const validPin = entity.pin && entity.pin !== '[PROTEGIDO]' && entity.pin !== '[PROTEGIDO_CRIPTOGRAFADO]' ? entity.pin : '';
      const rawSecret = String(entity.password_hash || entity.password || validPin || '@dm!n2026');
      const secureHash = rawSecret.startsWith('sha256$') || /^[a-f0-9]{64}$/i.test(rawSecret)
        ? rawSecret
        : hashPassword(rawSecret);

      return {
        id: String(entity.id),
        tenant_id: resolveTenant(entity.tenant_id || entity.companyId),
        name: String(entity.name || 'Usuário'),
        email: String(entity.email || ''),
        password_hash: secureHash,
        role: ['administrador', 'gerente', 'compras', 'conferente'].includes(entity.role)
          ? entity.role
          : 'conferente',
        phone: entity.phone || null,
        pin: '[PROTEGIDO_CRIPTOGRAFADO]', // Inibe leitura via banco
        is_active: Boolean(entity.status !== 'bloqueado' && entity.is_active !== false && entity.is_active !== 0),
        status: entity.status || (entity.is_active === false ? 'bloqueado' : 'ativo'),
        matricula: entity.matricula ? String(entity.matricula).trim() : null,
        last_login: entity.lastLogin || entity.last_login || null,
        created_at: entity.createdAt || entity.created_at || now,
      };
    }

    case 'suppliers': {
      const sPais = String(entity.paisOrigem || entity.pais_origem || 'BR').toUpperCase().slice(0, 2);
      const sTipoDoc = String(entity.tipoDocumento || entity.tipo_documento || (sPais === 'BR' ? 'CNPJ' : 'TAX_ID')).slice(0, 20);
      const sDoc = String(entity.documentoIdentificador || entity.documento_identificador || entity.cnpj || '').slice(0, 35);

      return {
        id: String(entity.id),
        tenant_id: resolveTenant(entity.tenant_id || entity.companyId),
        name: String(entity.name || 'Fornecedor'),
        trade_name: entity.tradeName || entity.trade_name || entity.name || null,
        cnpj: entity.cnpj || (sPais === 'BR' ? sDoc : null),
        pais_origem: sPais,
        tipo_documento: sTipoDoc,
        documento_identificador: sDoc || null,
        contact_name: entity.contactName || entity.contact_name || 'Comercial',
        phone: entity.phone || null,
        email: entity.email || null,
        price_update_interval_days: Number(entity.priceUpdateIntervalDays ?? entity.price_update_interval_days ?? 30),
        min_order_value: Number(entity.minOrderValue ?? entity.min_order_value ?? 0),
        last_price_update_date: entity.lastPriceUpdateDate || entity.last_price_update_date || now,
        rating: Number(entity.rating ?? 5.0),
        created_at: entity.createdAt || entity.created_at || now,
      };
    }

    case 'stock_items':
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        category_id: entity.categoryId || entity.category_id || null,
        name: String(entity.name || 'Produto'),
        category: String(entity.category || 'outro'),
        current_stock: Number(entity.currentStock ?? entity.current_stock ?? 0),
        min_stock: Number(entity.minStock ?? entity.min_stock ?? 0),
        ideal_stock: Number(entity.optimalStock ?? entity.idealStock ?? entity.ideal_stock ?? 0),
        unit: String(entity.unit || 'un'),
        unit_cost: Number(entity.costPrice ?? entity.unit_cost ?? entity.unitCost ?? 0),
        target_cmv: Number(entity.targetCmv ?? entity.target_cmv ?? 28.5),
        primary_supplier_id: entity.primarySupplierId || entity.primary_supplier_id || null,
        count_days: JSON.stringify(entity.countDays || entity.count_days || ['quarta', 'domingo']),
        location: entity.location || null,
        current_batch_expiry: entity.currentBatchExpiry ? String(entity.currentBatchExpiry).substring(0, 10) : null,
        barcode: entity.barcode || entity.code || null,
        created_at: entity.createdAt || entity.created_at || now,
        updated_at: now,
      };

    case 'loss_records':
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        item_id: String(entity.itemId || entity.item_id || entity.id),
        item_name: String(entity.itemName || entity.item_name || 'Item'),
        category: String(entity.category || 'outro'),
        quantity: Number(entity.quantity || 1),
        unit: String(entity.unit || 'un'),
        unit_cost: Number(entity.unitCost ?? entity.unit_cost ?? 0),
        total_cost: Number(entity.totalCost ?? entity.total_cost ?? 0),
        reason: String(entity.reason || 'outro'),
        sector: String(entity.sector || 'Cozinha'),
        reported_by: String(entity.reportedBy || entity.reported_by || 'Operador'),
        notes: entity.notes || null,
        created_at: entity.createdAt || entity.created_at || now,
      };

    case 'purchase_orders':
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        order_number: String(entity.orderNumber || entity.order_number || entity.id),
        supplier_id: String(entity.supplierId || entity.supplier_id || ''),
        supplier_name: String(entity.supplierName || entity.supplier_name || 'Fornecedor'),
        total_amount: Number(entity.totalAmount ?? entity.total_amount ?? 0),
        items_count: Number(entity.itemsCount ?? entity.items_count ?? (entity.items?.length || 1)),
        status: String(entity.status || 'pendente'),
        channel: String(entity.channel || 'direto'),
        payment_terms: entity.paymentTerms || entity.payment_terms || null,
        created_by: String(entity.createdBy || entity.created_by || 'Compras'),
        created_at: entity.createdAt || entity.created_at || now,
        sent_at: entity.sentAt || entity.sent_at || null,
      };

    case 'purchase_order_items':
      return {
        id: String(entity.id || `poi_${Date.now()}`),
        order_id: String(entity.orderId || entity.order_id || ''),
        item_id: String(entity.itemId || entity.item_id || ''),
        item_name: String(entity.itemName || entity.item_name || 'Item'),
        unit: String(entity.unit || 'un'),
        quantity_ordered: Number(entity.quantityOrdered ?? entity.quantity_ordered ?? entity.quantity ?? 1),
        unit_price: Number(entity.unitPrice ?? entity.unit_price ?? 0),
        total_cost: Number(entity.totalCost ?? entity.total_cost ?? 0),
        received_quantity: Number(entity.receivedQuantity ?? entity.received_quantity ?? 0),
      };

    case 'stock_count_sessions':
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        date: String(entity.date || now.split('T')[0]),
        conducted_by: String(entity.conductedBy || entity.conducted_by || 'Conferente'),
        user_role: String(entity.userRole || entity.user_role || 'conferente'),
        day_of_week: String(entity.dayOfWeek || entity.day_of_week || 'quarta'),
        total_items_counted: Number(entity.totalItemsCounted ?? entity.total_items_counted ?? 0),
        divergent_items_count: Number(entity.divergentItemsCount ?? entity.divergent_items_count ?? 0),
        status: String(entity.status || 'rascunho'),
        supervisor_authorized: Boolean(entity.supervisorAuthorized || entity.supervisor_authorized),
        supervisor_name: entity.supervisorName || entity.supervisor_name || null,
        submitted_at: entity.submittedAt || entity.submitted_at || null,
        created_at: entity.createdAt || entity.created_at || now,
      };

    case 'invoices_history':
      return {
        id: String(entity.id),
        tenant_id: String(entity.tenant_id || entity.companyId || defaultTenant),
        access_key: String(entity.accessKey || entity.access_key || entity.id),
        number: String(entity.number || ''),
        series: entity.series || '1',
        issue_date: entity.issueDate || entity.issue_date || now,
        supplier_cnpj: String(entity.supplierCnpj || entity.supplier_cnpj || ''),
        supplier_name: String(entity.supplierName || entity.supplier_name || 'Fornecedor'),
        total_invoice_value: Number(entity.totalInvoiceValue ?? entity.total_invoice_value ?? entity.total ?? 0),
        source_type: String(entity.sourceType || entity.source_type || 'chave'),
      };

    default:
      return { ...entity, id: String(entity.id || `rec_${Date.now()}`) };
  }
}

// Verifica se um registro existe no SGBD
async function checkRowExistsInDb(engine: DatabaseEngine, tableName: string, id: string): Promise<boolean> {
  try {
    if (engine === 'postgres') {
      const client = new pg.Client({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || '',
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 3000,
      });
      await client.connect();
      const res = await client.query(`SELECT 1 FROM ${tableName} WHERE id = $1 LIMIT 1;`, [id]);
      await client.end();
      return (res.rowCount || 0) > 0;
    } else if (engine === 'mysql') {
      const conn = await mysql.createConnection({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || '',
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 3000,
      });
      const [rows]: any = await conn.execute(`SELECT 1 FROM ${tableName} WHERE id = ? LIMIT 1;`, [id]);
      await conn.end();
      return Array.isArray(rows) && rows.length > 0;
    }
  } catch (err: any) {
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      linkedDatabaseState.status = 'erro';
      linkedDatabaseState.errorMessage = `Banco inacessível (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
      savePersistedConfig(linkedDatabaseState);
    }
    return false;
  }
  return false;
}

// Execução de DDL completa no SGBD conectado
async function runDdlOnDatabase(engine: DatabaseEngine, script: string): Promise<boolean> {
  if (engine === 'postgres') {
    const client = new pg.Client({
      host: linkedDatabaseState.host,
      port: linkedDatabaseState.port,
      database: linkedDatabaseState.database,
      user: linkedDatabaseState.username,
      password: linkedDatabaseState.password || '',
      ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      await client.query(script);
      return true;
    } catch (e: any) {
      console.warn('[DDL Run Postgres Error]:', e.message);
      throw e;
    } finally {
      try {
        await client.end();
      } catch {}
    }
  } else if (engine === 'mysql') {
    let conn: any = null;
    try {
      conn = await mysql.createConnection({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || '',
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
        multipleStatements: true,
        connectTimeout: 10000,
      });
      await conn.query(script);
      return true;
    } catch (e: any) {
      console.warn('[DDL Run MySQL Error]:', e.message);
      throw e;
    } finally {
      try {
        await conn?.end();
      } catch {}
    }
  }
  return false;
}

// Garante integridade referencial antes da inserção de registros dependentes
async function ensureDependenciesBeforeInsert(
  engine: DatabaseEngine,
  tableName: string,
  mappedRow: Record<string, any>
): Promise<void> {
  if (linkedDatabaseState.isSimulationMode || linkedDatabaseState.status !== 'conectado') {
    return;
  }

  const tenantId = (mappedRow.tenant_id || '00000000000001').replace(/^comp-matriz$|^emp-matriz$/, '00000000000001');

  // 1. Garante que a empresa tenant existe em tenants_companies
  if (tableName !== 'tenants_companies') {
    const companyExists = await checkRowExistsInDb(engine, 'tenants_companies', tenantId);
    if (!companyExists) {
      const defaultCompany = {
        id: tenantId,
        name: 'CEC Conecta',
        trade_name: 'CEC',
        cnpj: '00.000.000/0000-00',
        pais_origem: 'BR',
        tipo_documento: 'CNPJ',
        documento_identificador: tenantId,
        city: 'Patrocinio',
        state: 'MG',
        phone: '(34)99947-2865',
        email: 'jairoeliakim@hotmail.com',
        is_active: true,
        created_at: '2026-01-01T08:00:00.000Z',
        updated_at: new Date().toISOString(),
      };
      await executeRawUpsertDirect(engine, 'tenants_companies', defaultCompany);
    }
  }

  // 2. Se for stock_items (PRODUTOS):
  if (tableName === 'stock_items') {
    // Sanitiza strings vazias para null
    if (typeof mappedRow.category_id === 'string' && mappedRow.category_id.trim() === '') {
      mappedRow.category_id = null;
    }
    if (typeof mappedRow.primary_supplier_id === 'string' && mappedRow.primary_supplier_id.trim() === '') {
      mappedRow.primary_supplier_id = null;
    }

    // 2.1 Garante que a categoria existe em categories
    if (mappedRow.category_id) {
      try {
        const catExists = await checkRowExistsInDb(engine, 'categories', mappedRow.category_id);
        if (!catExists) {
          const catRow = {
            id: mappedRow.category_id,
            tenant_id: tenantId,
            name: mappedRow.category || 'Geral',
            description: `Categoria de ${mappedRow.category || 'Insumos'}`,
            created_at: new Date().toISOString(),
          };
          await executeRawUpsertDirect(engine, 'categories', catRow);
        }
      } catch {
        mappedRow.category_id = null; // Fallback seguro para evitar violação de foreign key
      }
    }

    // 2.2 Se primary_supplier_id fornecido, verifica se o fornecedor existe; se não, cria stub ou anula
    if (mappedRow.primary_supplier_id) {
      try {
        const supExists = await checkRowExistsInDb(engine, 'suppliers', mappedRow.primary_supplier_id);
        if (!supExists) {
          const supFromCache = databaseTables.suppliers.get(mappedRow.primary_supplier_id);
          const stubSup = {
            id: mappedRow.primary_supplier_id,
            tenant_id: tenantId,
            name: supFromCache?.name || 'Fornecedor Vinculado',
            trade_name: supFromCache?.tradeName || 'Fornecedor',
            contact_name: supFromCache?.contactName || 'Comercial',
            phone: supFromCache?.phone || '(00) 0000-0000',
            email: supFromCache?.email || 'contato@fornecedor.com',
            created_at: new Date().toISOString(),
          };
          await executeRawUpsertDirect(engine, 'suppliers', stubSup);
        }
      } catch {
        mappedRow.primary_supplier_id = null; // Fallback seguro
      }
    }
  }
}

// Execução direta de Upsert sem recursão
async function executeRawUpsertDirect(
  engine: DatabaseEngine,
  tableName: string,
  row: Record<string, any>
): Promise<void> {
  const keys = Object.keys(row);
  const values = Object.values(row).map((v) => (v === undefined ? null : v));

  if (engine === 'postgres') {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updateKeys = keys.filter((k) => k !== 'id' && k !== 'created_at');
    const updateClause = updateKeys.map((k) => `${k} = EXCLUDED.${k}`).join(', ');
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateClause};`;

    const client = new pg.Client({
      host: linkedDatabaseState.host,
      port: linkedDatabaseState.port,
      database: linkedDatabaseState.database,
      user: linkedDatabaseState.username,
      password: linkedDatabaseState.password || '',
      ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query(sql, values);
      await client.end();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        linkedDatabaseState.status = 'erro';
        linkedDatabaseState.errorMessage = `Banco inacessível (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
        savePersistedConfig(linkedDatabaseState);
      }
      console.warn(`[Raw Upsert Postgres Error on ${tableName}]:`, err.message);
    }
  } else if (engine === 'mysql') {
    const placeholders = keys.map(() => '?').join(', ');
    const updateKeys = keys.filter((k) => k !== 'id' && k !== 'created_at');
    const updateClause = updateKeys.map((k) => `${k} = VALUES(${k})`).join(', ');
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause};`;

    try {
      const conn = await mysql.createConnection({
        host: linkedDatabaseState.host,
        port: linkedDatabaseState.port,
        database: linkedDatabaseState.database,
        user: linkedDatabaseState.username,
        password: linkedDatabaseState.password || '',
        ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5000,
      });
      await conn.execute(sql, values);
      await conn.end();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        linkedDatabaseState.status = 'erro';
        linkedDatabaseState.errorMessage = `Banco inacessível (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
        savePersistedConfig(linkedDatabaseState);
      }
      console.warn(`[Raw Upsert MySQL Error on ${tableName}]:`, err.message);
    }
  }
}

// EXECUÇÃO REAL DE UPSERT / INSERT NO SGBD CONECTADO (PostgreSQL ou MySQL)
async function executeRealSqlUpsert(
  engine: DatabaseEngine,
  tableName: string,
  mappedRow: Record<string, any>
): Promise<{ success: boolean; sqlExecuted: string; error?: string }> {
  // Executa validação de dependências antes de computar chaves e valores
  if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === 'conectado') {
    try {
      await ensureDependenciesBeforeInsert(engine, tableName, mappedRow);
    } catch (depErr: any) {
      console.warn(`[Dependencies check warning on ${tableName}]:`, depErr.message);
    }
  }

  // 1. Sanitiza valores para não conter 'undefined'
  const keys = Object.keys(mappedRow);
  const values = Object.values(mappedRow).map((v) => (v === undefined ? null : v));

  if (engine === 'postgres') {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updateKeys = keys.filter((k) => k !== 'id' && k !== 'created_at');
    const updateClause = updateKeys.map((k) => `${k} = EXCLUDED.${k}`).join(', ');

    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateClause};`;

    // Visualização da query interpolada para auditoria
    const debugSql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.map((v) => (v === null ? 'NULL' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)).join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updateClause};`;

    if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === 'conectado') {
      try {
        const client = new pg.Client({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || '',
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 5000,
        });
        await client.connect();

        try {
          await client.query(sql, values);
        } catch (firstErr: any) {
          // Se a tabela não existir (42P01), roda DDL e retenta!
          if (firstErr.code === '42P01') {
            console.info(`[Auto-Create Tables] Tabela "${tableName}" inexistente. Criando esquema DDL no PostgreSQL...`);
            const ddl = generateDatabaseScript('postgres', linkedDatabaseState.database);
            await client.query(ddl);
            // Retenta a inserção após criar a estrutura
            await client.query(sql, values);
            linkedDatabaseState.tablesCreated = true;
          } else {
            throw firstErr;
          }
        }

        await client.end();
        return { success: true, sqlExecuted: debugSql };
      } catch (err: any) {
        console.warn(`[Postgres INSERT fallback on ${tableName}]: ${err.message}`);
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
          linkedDatabaseState.status = 'erro';
          linkedDatabaseState.errorMessage = `Banco inacessível (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
          savePersistedConfig(linkedDatabaseState);
        }
        return { success: false, sqlExecuted: debugSql, error: err.message };
      }
    }
    return { success: true, sqlExecuted: debugSql };
  }

  if (engine === 'mysql') {
    const placeholders = keys.map(() => '?').join(', ');
    const updateKeys = keys.filter((k) => k !== 'id' && k !== 'created_at');
    const updateClause = updateKeys.map((k) => `${k} = VALUES(${k})`).join(', ');

    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause};`;
    const debugSql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.map((v) => (v === null ? 'NULL' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)).join(', ')}) ON DUPLICATE KEY UPDATE ${updateClause};`;

    if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === 'conectado') {
      try {
        const conn = await mysql.createConnection({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || '',
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
          connectTimeout: 5000,
        });

        try {
          await conn.execute(sql, values);
        } catch (firstErr: any) {
          if (firstErr.code === 'ER_NO_SUCH_TABLE' || firstErr.errno === 1146) {
            console.info(`[Auto-Create Tables] Tabela "${tableName}" inexistente no MySQL. Criando esquema DDL...`);
            const ddl = generateDatabaseScript('mysql', linkedDatabaseState.database);
            await conn.query(ddl);
            await conn.execute(sql, values);
            linkedDatabaseState.tablesCreated = true;
          } else {
            throw firstErr;
          }
        }

        await conn.end();
        return { success: true, sqlExecuted: debugSql };
      } catch (err: any) {
        console.warn(`[MySQL INSERT fallback on ${tableName}]: ${err.message}`);
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
          linkedDatabaseState.status = 'erro';
          linkedDatabaseState.errorMessage = `Banco inacessível (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
          savePersistedConfig(linkedDatabaseState);
        }
        return { success: false, sqlExecuted: debugSql, error: err.message };
      }
    }
    return { success: true, sqlExecuted: debugSql };
  }

  // Fallback SQL Server
  const debugSql = `MERGE INTO ${tableName} AS target USING (SELECT '${mappedRow.id}' AS id) AS source ON (target.id = source.id) WHEN MATCHED THEN UPDATE SET ... WHEN NOT MATCHED THEN INSERT ...;`;
  return { success: true, sqlExecuted: debugSql };
}

// EXECUÇÃO REAL DE DELETE NO SGBD CONECTADO
async function executeRealSqlDelete(
  engine: DatabaseEngine,
  tableName: string,
  id: string
): Promise<{ success: boolean; sqlExecuted: string; error?: string }> {
  const sql = `DELETE FROM ${tableName} WHERE id = '${id}';`;

  if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === 'conectado') {
    try {
      if (engine === 'postgres') {
        const client = new pg.Client({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || '',
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 5000,
        });
        await client.connect();
        await client.query(`DELETE FROM ${tableName} WHERE id = $1;`, [id]);
        await client.end();
      } else if (engine === 'mysql') {
        const conn = await mysql.createConnection({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || '',
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
          connectTimeout: 5000,
        });
        await conn.execute(`DELETE FROM ${tableName} WHERE id = ?;`, [id]);
        await conn.end();
      }
      return { success: true, sqlExecuted: sql };
    } catch (err: any) {
      console.warn(`[SQL DELETE fallback on ${tableName}]: ${err.message}`);
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        linkedDatabaseState.status = 'erro';
        linkedDatabaseState.errorMessage = `Banco inacessível (${linkedDatabaseState.host}:${linkedDatabaseState.port}): ${err.message}`;
        savePersistedConfig(linkedDatabaseState);
      }
      return { success: false, sqlExecuted: sql, error: err.message };
    }
  }

  return { success: true, sqlExecuted: sql };
}

// Inicialização com carga limpa padrão (empresa, categorias e admin oficial)
function initCleanDatabaseSeed() {
  const defaultTenantCnpj = '00000000000001';
  const defaultCompany = {
    id: defaultTenantCnpj,
    name: 'CEC Conecta',
    trade_name: 'CEC',
    tradeName: 'CEC',
    cnpj: '00.000.000/0000-00',
    pais_origem: 'BR',
    tipo_documento: 'CNPJ',
    documento_identificador: defaultTenantCnpj,
    city: 'Patrocinio',
    state: 'MG',
    phone: '(34)99947-2865',
    email: 'jairoeliakim@hotmail.com',
    is_active: true,
    active: true,
    created_at: new Date('2026-01-01').toISOString(),
  };

  // 1. Empresa Matriz Padrão (registrada com CNPJ sem traços)
  databaseTables.tenants_companies.set(defaultTenantCnpj, defaultCompany);

  // 2. Categorias padrão no banco de dados para integridade de produtos
  const defaultCategories = [
    { id: 'cat-carnes', name: 'Carnes & Proteínas', description: 'Cortes nobres, carnes e aves' },
    { id: 'cat-laticinios', name: 'Laticínios & Derivados', description: 'Queijos, leites e manteigas' },
    { id: 'cat-hortifruti', name: 'Hortifruti & Insumos', description: 'Verduras, legumes e temperos frescos' },
    { id: 'cat-bebidas', name: 'Bebidas, Bar & Adega', description: 'Vinhos, destilados, cervejas e refrigerantes' },
    { id: 'cat-petiscos', name: 'Petiscos & Congelados', description: 'Porções, congelados e entradas' },
    { id: 'cat-porcionamento', name: 'Porcionamento & Preparos', description: 'Insumos pré-porcionados' },
    { id: 'cat-limpeza', name: 'Limpeza & Higiene', description: 'Produtos químicos e materiais de limpeza' },
    { id: 'cat-consumo', name: 'Consumo & Descartáveis', description: 'Embalagens e descartáveis' },
    { id: 'cat-outro', name: 'Outros Insumos', description: 'Itens diversos' },
  ];
  for (const cat of defaultCategories) {
    databaseTables.categories.set(cat.id, {
      ...cat,
      tenant_id: defaultTenantCnpj,
      created_at: new Date('2026-01-01').toISOString(),
    });
  }

  // 3. Usuário Administrador Oficial Padrão (******)
  databaseTables.system_users.set('usr-admin-01', {
    id: 'usr-admin-01',
    tenant_id: defaultTenantCnpj,
    name: 'Administrador do Sistema',
    email: 'admin@sistema.com',
    password_hash: '@dm!n2026',
    role: 'administrador',
    phone: '(31)99947-2865',
    pin: '@dm!n2026',
    is_active: true,
    created_at: new Date('2026-01-01').toISOString(),
  });

  databaseTables.system_users.set('usr-admin-alias', {
    id: 'usr-admin-alias',
    tenant_id: defaultTenantCnpj,
    name: 'Administrador do Sistema',
    email: 'admin',
    password_hash: '@dm!n2026',
    role: 'administrador',
    phone: '(31)99947-2865',
    pin: '@dm!n2026',
    is_active: true,
    created_at: new Date('2026-01-01').toISOString(),
  });
}

// Inicializa seed limpo na subida do backend
initCleanDatabaseSeed();

function logSql(
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL',
  sql: string,
  recordsAffected = 1
) {
  const log: SqlExecutionLog = {
    id: `sql_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    table,
    operation,
    sql,
    engine: linkedDatabaseState.engine,
    recordsAffected,
  };
  sqlExecutionLogs.unshift(log);
  if (sqlExecutionLogs.length > 250) {
    sqlExecutionLogs.pop();
  }
}

function calculateTotalRecords(): number {
  return Object.values(databaseTables).reduce((acc, map) => acc + map.size, 0);
}

/**
 * 1. Testar conexão com o banco de dados
 * POST /api/database/test-connection
 */
databaseRouter.post('/database/test-connection', async (req: Request, res: Response) => {
  const { engine, host, port, database, username, password, ssl, simulationMode } = req.body || {};

  if (!engine || !host || !port || !database || !username) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros incompletos. Informe motor (mysql, postgres, sqlserver), host, porta, nome do banco e usuário.',
    });
  }

  // 1. Se o usuário ativou explicitamente o "Modo Simulado em Memória"
  if (simulationMode === true) {
    return res.json({
      success: true,
      simulationMode: true,
      databaseExists: true,
      latencyMs: 5,
      engine,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      serverVersion: `${String(engine).toUpperCase()} (Modo Simulado em Memória)`,
      verifiedAt: new Date().toISOString(),
      message: `[MODO SIMULADO EM MEMÓRIA] Validação executada apenas em memória. (Atenção: Nenhuma conexão externa real foi feita com ${host}:${port}).`,
    });
  }

  // 2. TESTE REAL COM O DRIVER DO SGDB
  if (engine === 'postgres') {
    const pgResult = await testPostgresConnection({
      host: String(host).trim(),
      port: Number(port),
      database: String(database).trim(),
      username: String(username).trim(),
      password: String(password || ''),
      ssl: Boolean(ssl),
    });

    if (!pgResult.connected) {
      return res.status(400).json({
        success: false,
        simulationMode: false,
        databaseExists: pgResult.databaseExists,
        error: pgResult.errorType,
        errorCode: pgResult.errorCode,
        latencyMs: pgResult.latencyMs,
        engine,
        host,
        port: Number(port),
        database,
        message: pgResult.message,
        recommendation: pgResult.recommendation,
      });
    }

    return res.json({
      success: true,
      simulationMode: false,
      databaseExists: true,
      latencyMs: pgResult.latencyMs,
      engine,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      serverVersion: pgResult.serverVersion,
      verifiedAt: new Date().toISOString(),
      message: pgResult.message,
    });
  }

  if (engine === 'mysql') {
    const myResult = await testMysqlConnection({
      host: String(host).trim(),
      port: Number(port),
      database: String(database).trim(),
      username: String(username).trim(),
      password: String(password || ''),
      ssl: Boolean(ssl),
    });

    if (!myResult.connected) {
      return res.status(400).json({
        success: false,
        simulationMode: false,
        databaseExists: myResult.databaseExists,
        error: myResult.errorType,
        errorCode: myResult.errorCode,
        latencyMs: myResult.latencyMs,
        engine,
        host,
        port: Number(port),
        database,
        message: myResult.message,
        recommendation: myResult.recommendation,
      });
    }

    return res.json({
      success: true,
      simulationMode: false,
      databaseExists: true,
      latencyMs: myResult.latencyMs,
      engine,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      serverVersion: myResult.serverVersion,
      verifiedAt: new Date().toISOString(),
      message: myResult.message,
    });
  }

  // Fallback para SQL Server via TCP Socket
  const tcpResult = await testTcpSocket(String(host).trim(), Number(port), 2500);
  if (!tcpResult.reachable) {
    return res.status(400).json({
      success: false,
      simulationMode: false,
      databaseExists: false,
      error: 'DATABASE_UNREACHABLE',
      errorCode: tcpResult.code,
      latencyMs: tcpResult.latencyMs,
      engine,
      host,
      port: Number(port),
      database,
      message: `Não foi possível conectar ao SQL Server: ${tcpResult.error}`,
      recommendation: `Certifique-se de que o SQL Server está ouvindo na porta ${port} e o banco "${database}" foi criado.`,
    });
  }

  return res.json({
    success: true,
    simulationMode: false,
    databaseExists: true,
    latencyMs: tcpResult.latencyMs,
    engine,
    host,
    port: Number(port),
    database,
    username,
    ssl: Boolean(ssl),
    serverVersion: 'Microsoft SQL Server 2022',
    verifiedAt: new Date().toISOString(),
    message: `Servidor SQL Server em ${host}:${port} ativo e respondendo!`,
  });
});

/**
 * 2. Vincular o banco de dados
 * POST /api/database/link
 */
databaseRouter.post('/database/link', async (req: Request, res: Response) => {
  const { engine, host, port, database, username, password, ssl, simulationMode, tenantId, companyId } = req.body || {};
  const effectiveTenantId = String(tenantId || companyId || '00000000000001').trim();

  if (!engine || !host || !port || !database || !username) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros obrigatórios ausentes para vincular o banco.',
    });
  }

  // Se não for modo simulado, valida com o driver real
  if (simulationMode !== true) {
    if (engine === 'postgres') {
      const pgCheck = await testPostgresConnection({
        host: String(host).trim(),
        port: Number(port),
        database: String(database).trim(),
        username: String(username).trim(),
        password: String(password || ''),
        ssl: Boolean(ssl),
      });

      if (!pgCheck.connected) {
        linkedDatabaseState.status = 'erro';
        linkedDatabaseState.errorMessage = pgCheck.message;
        savePersistedConfig(linkedDatabaseState);
        return res.status(400).json({
          success: false,
          error: pgCheck.errorType,
          errorCode: pgCheck.errorCode,
          message: `Vínculo Rejeitado: ${pgCheck.message}`,
          recommendation: pgCheck.recommendation,
        });
      }
    } else if (engine === 'mysql') {
      const myCheck = await testMysqlConnection({
        host: String(host).trim(),
        port: Number(port),
        database: String(database).trim(),
        username: String(username).trim(),
        password: String(password || ''),
        ssl: Boolean(ssl),
      });

      if (!myCheck.connected) {
        linkedDatabaseState.status = 'erro';
        linkedDatabaseState.errorMessage = myCheck.message;
        savePersistedConfig(linkedDatabaseState);
        return res.status(400).json({
          success: false,
          error: myCheck.errorType,
          errorCode: myCheck.errorCode,
          message: `Vínculo Rejeitado: ${myCheck.message}`,
          recommendation: myCheck.recommendation,
        });
      }
    } else {
      const tcpResult = await testTcpSocket(String(host).trim(), Number(port), 2500);
      if (!tcpResult.reachable) {
        linkedDatabaseState.status = 'erro';
        linkedDatabaseState.errorMessage = tcpResult.error;
        savePersistedConfig(linkedDatabaseState);
        return res.status(400).json({
          success: false,
          error: 'DATABASE_UNREACHABLE',
          errorCode: tcpResult.code,
          message: `Vínculo Rejeitado: ${tcpResult.error}`,
          recommendation: `Verifique se o SQL Server está ativo na porta ${port}.`,
        });
      }
    }
  }

  linkedDatabaseState = {
    engine: engine as DatabaseEngine,
    host: String(host),
    port: Number(port),
    database: String(database),
    username: String(username),
    password: String(password || ''),
    ssl: Boolean(ssl),
    status: 'conectado',
    isSimulationMode: Boolean(simulationMode),
    databaseExists: true,
    errorMessage: undefined,
    lastConnectedAt: new Date().toISOString(),
    tablesCreated: linkedDatabaseState.tablesCreated,
    tablesCount: linkedDatabaseState.tablesCount,
    lastMigrationAt: linkedDatabaseState.lastMigrationAt,
    totalRecordsCount: calculateTotalRecords(),
  };

  // Salva no mapa de configurações do tenant específico da empresa
  tenantDatabaseConfigs[effectiveTenantId] = {
    ...linkedDatabaseState,
  };

  // Atualiza também os dados da empresa em tenants_companies se presente
  if (databaseTables.tenants_companies.has(effectiveTenantId)) {
    const existingComp = databaseTables.tenants_companies.get(effectiveTenantId);
    databaseTables.tenants_companies.set(effectiveTenantId, {
      ...existingComp,
      databaseConfig: publicDbState(),
    });
  }

  // Salva no arquivo de configuração em disco com tenantConfigs
  savePersistedConfig(linkedDatabaseState);

  logSql(
    'system_settings',
    'UPDATE',
    `-- Conexão vinculada ao cluster ${engine.toUpperCase()} em ${host}:${port}/${database} (Tenant ${effectiveTenantId})${simulationMode ? ' [MODO SIMULADO]' : ' [AUTENTICADO COM SUCESSO]'}`,
    1
  );

  return res.json({
    success: true,
    tenantId: effectiveTenantId,
    databaseConfig: {
      ...publicDbState(),
      tenantId: effectiveTenantId,
    },
    message: simulationMode
      ? `Banco de dados "${database}" vinculado em MODO SIMULADO para o tenant ${effectiveTenantId}.`
      : `Banco de dados "${database}" (${engine.toUpperCase()}) em ${host}:${port} validado e vinculado ao tenant ${effectiveTenantId} com sucesso!`,
  });
});

/**
  * 2.1. Ativar conexão do banco de um Tenant específico
  * POST /api/database/activate-tenant/:tenantId
  */
databaseRouter.post(['/database/activate-tenant', '/database/activate-tenant/:tenantId'], async (req: Request, res: Response) => {
  const tenantId = String(req.params.tenantId || req.body?.tenantId || '').trim();
  const cfg = tenantDatabaseConfigs[tenantId];
  if (cfg && cfg.host && cfg.database) {
    linkedDatabaseState = {
      ...linkedDatabaseState,
      ...cfg,
    };
    savePersistedConfig(linkedDatabaseState);
    return res.json({
      success: true,
      activated: true,
      tenantId,
      databaseConfig: {
        ...publicDbState(),
        tenantId,
      },
      message: `Banco do tenant "${tenantId}" ativado com sucesso! (${cfg.engine.toUpperCase()} em ${cfg.host})`,
    });
  }

  return res.json({
    success: false,
    activated: false,
    tenantId,
    message: `Nenhum banco configurado previamente para o tenant "${tenantId}".`,
  });
});

/**
  * 2.2. Salvar parâmetros de banco diretamente para um Tenant
  * POST /api/database/save-tenant-config
  */
databaseRouter.post('/database/save-tenant-config', async (req: Request, res: Response) => {
  const { tenantId, companyId, databaseConfig } = req.body || {};
  const tId = String(tenantId || companyId || '').trim();
  if (!tId || !databaseConfig) {
    return res.status(400).json({
      success: false,
      message: 'tenantId e databaseConfig são obrigatórios.',
    });
  }

  tenantDatabaseConfigs[tId] = {
    ...linkedDatabaseState,
    ...databaseConfig,
  };

  // Se o tenant atual for o mesmo do request, atualiza linkedDatabaseState
  linkedDatabaseState = {
    ...linkedDatabaseState,
    ...databaseConfig,
  };

  if (databaseTables.tenants_companies.has(tId)) {
    const existingComp = databaseTables.tenants_companies.get(tId);
    databaseTables.tenants_companies.set(tId, {
      ...existingComp,
      databaseConfig: publicDbState(),
    });
  }

  savePersistedConfig(linkedDatabaseState);

  return res.json({
    success: true,
    tenantId: tId,
    databaseConfig: {
      ...publicDbState(),
      tenantId: tId,
    },
    message: `Configuração do banco de dados salva com sucesso no tenant "${tId}".`,
  });
});

/**
 * 3. Rodar o script para criar as tabelas do sistema
 * POST /api/database/create-tables
 */
databaseRouter.post('/database/create-tables', async (req: Request, res: Response) => {
  const { engine, database } = req.body || {};
  const targetEngine: DatabaseEngine = engine || linkedDatabaseState.engine || 'postgres';
  const targetDb: string = database || linkedDatabaseState.database || 'restaurante_estoque_db';

  if (linkedDatabaseState.status !== 'conectado') {
    return res.status(400).json({
      success: false,
      message: 'Não é possível rodar o script: o banco de dados não está conectado. Primeiro teste e vincule um servidor de banco ativo.',
    });
  }

  // Gerar o script DDL conforme o dialeto
  const ddlScript = generateDatabaseScript(targetEngine, targetDb);

  // Se estiver conectado a um banco externo real (não simulado), executa o DDL no banco real!
  if (!linkedDatabaseState.isSimulationMode) {
    try {
      await runDdlOnDatabase(targetEngine, ddlScript);
    } catch (realErr: any) {
      console.warn('[DDL Error on external DB]', realErr.message);
      return res.status(500).json({
        success: false,
        engine: targetEngine,
        database: targetDb,
        error: 'DDL_FAILED',
        message: `Falha ao criar as tabelas no banco "${targetDb}": ${realErr?.message || 'erro desconhecido'}`,
        recommendation:
          'Confira se o usuário tem permissão de criação (CREATE) no schema public e se a conexão está ativa. As tabelas NÃO foram criadas.',
      });
    }
  }

  // Inicializa seed limpo padrão com admin  e categorias
  initCleanDatabaseSeed();

  // Sincroniza todos os registros em memória existentes para o banco externo recém-criado!
  if (!linkedDatabaseState.isSimulationMode) {
    try {
      // 1. Empresa Matriz
      for (const comp of databaseTables.tenants_companies.values()) {
        const mapped = mapEntityToSqlRow('tenants_companies', comp);
        await executeRealSqlUpsert(targetEngine, 'tenants_companies', mapped);
      }
      // 2. Categorias padrão
      for (const cat of databaseTables.categories.values()) {
        const mapped = mapEntityToSqlRow('categories', cat);
        await executeRealSqlUpsert(targetEngine, 'categories', mapped);
      }
      // 3. Usuários (admin + colaboradores cadastrados)
      for (const user of databaseTables.system_users.values()) {
        const mapped = mapEntityToSqlRow('system_users', user);
        await executeRealSqlUpsert(targetEngine, 'system_users', mapped);
      }
      // 4. Fornecedores cadastrados
      for (const sup of databaseTables.suppliers.values()) {
        const mapped = mapEntityToSqlRow('suppliers', sup);
        await executeRealSqlUpsert(targetEngine, 'suppliers', mapped);
      }
      // 5. Produtos cadastrados
      for (const prod of databaseTables.stock_items.values()) {
        const mapped = mapEntityToSqlRow('stock_items', prod);
        await executeRealSqlUpsert(targetEngine, 'stock_items', mapped);
      }
    } catch (syncErr: any) {
      console.warn('[Seed Sync to External DB Error]:', syncErr.message);
    }
  }

  linkedDatabaseState.status = 'conectado';
  linkedDatabaseState.tablesCreated = true;
  linkedDatabaseState.tablesCount = SYSTEM_TABLES.length;
  linkedDatabaseState.lastMigrationAt = new Date().toISOString();
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();

  savePersistedConfig(linkedDatabaseState);

  logSql(
    'ALL_TABLES',
    'DDL',
    `-- Execução DDL de criação de ${SYSTEM_TABLES.length} tabelas no banco ${targetDb} (${targetEngine.toUpperCase()})\n-- Usuário admin@sistema.com`,
    SYSTEM_TABLES.length
  );

  return res.json({
    success: true,
    engine: targetEngine,
    database: targetDb,
    tablesCount: SYSTEM_TABLES.length,
    tablesCreated: SYSTEM_TABLES.map((t) => t.name),
    tablesDetailed: SYSTEM_TABLES,
    executedAt: new Date().toISOString(),
    scriptExecuted: ddlScript,
    message: `Script DDL executado com sucesso! Todas as ${SYSTEM_TABLES.length} tabelas do sistema foram criadas no banco "${targetDb}". O usuário administrador padrão foi inicializado.`,
  });
});

/**
 * 4. ALIMENTAR BANCO DE DADOS: Inserção / Atualização de Registros
 * POST /api/database/insert/:table
 * Salva no banco em memória E executa o SQL no PostgreSQL / MySQL real se conectado!
 */
databaseRouter.post('/database/insert/:table', async (req: Request, res: Response) => {
  const tableName = req.params.table;
  const targetTable = databaseTables[tableName];

  if (!targetTable) {
    return res.status(404).json({
      success: false,
      message: `Tabela "${tableName}" não existe no esquema do sistema. Tabelas válidas: ${Object.keys(databaseTables).join(', ')}`,
    });
  }

  const payload = req.body;
  if (!payload) {
    return res.status(400).json({
      success: false,
      message: 'Corpo da requisição vazio.',
    });
  }

  const itemsToInsert = Array.isArray(payload) ? payload : [payload];
  const insertedCount = itemsToInsert.length;
  let lastExecutedSql = '';
  let realDbSynced = false;
  let realDbError: string | undefined;

  for (const rawItem of itemsToInsert) {
    const id = rawItem.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullItem = { ...rawItem, id };

    // 1. Mapeia as colunas com tipagem estrita para o DDL SQL
    const mappedRow = mapEntityToSqlRow(tableName, fullItem, '00000000000001');

    // Validação Condicional de Empresas e Fornecedores (Globalizado)
    if (tableName === 'suppliers') {
      const pais = String(mappedRow.pais_origem || 'BR').toUpperCase();
      const doc = String(mappedRow.documento_identificador || mappedRow.cnpj || '').trim();

      if (pais === 'BR') {
        // Validação de DV apenas para BR
        if (doc) {
          const cnpjVal = validateCNPJ(doc);
          if (!cnpjVal.isValid) {
            return res.status(400).json({
              success: false,
              error: `Validação de CNPJ (Brasil) falhou: ${cnpjVal.error}`,
              calculatedCheckDigits: cnpjVal.calculatedCheckDigits,
              actualCheckDigits: cnpjVal.actualCheckDigits,
            });
          }
        }
      } else {
        // Validação simples para estrangeiro (não vazio e <= 35 chars)
        if (!doc) {
          return res.status(400).json({
            success: false,
            error: `Documento identificador da empresa estrangeira é obrigatório.`,
          });
        }
        if (doc.length > 35) {
          return res.status(400).json({
            success: false,
            error: `Documento identificador estrangeiro excede o limite máximo de 35 caracteres (informados: ${doc.length}).`,
          });
        }
      }
    }

    // 2. Salva no cache do servidor
    targetTable.set(id, { ...fullItem, ...mappedRow });

    // 3. Se for produto ou usuário, sincroniza com o inventoryStore
    if (tableName === 'stock_items') {
      inventoryStore.upsertProduct({
        id: mappedRow.id,
        tenant_id: mappedRow.tenant_id || '00000000000001',
        category_id: mappedRow.category_id || 'cat-carnes',
        sku: mappedRow.barcode || `SKU-${mappedRow.id}`,
        barcode: mappedRow.barcode,
        name: mappedRow.name,
        current_stock: Number(mappedRow.current_stock || 0),
        min_stock: Number(mappedRow.min_stock || 0),
        unit_price: Number(mappedRow.unit_cost || 0),
        created_at: mappedRow.created_at || new Date().toISOString(),
      });
    }

    if (tableName === 'system_users') {
      inventoryStore.upsertUser({
        id: mappedRow.id,
        tenant_id: mappedRow.tenant_id || '00000000000001',
        name: mappedRow.name,
        email: mappedRow.email,
        role: mappedRow.role || 'conferente',
        created_at: mappedRow.created_at || new Date().toISOString(),
      });
    }

    // 4. EXECUTA SQL REAL NO BANCO DE DADOS EXTERNO (Se conectado)
    const sqlResult = await executeRealSqlUpsert(linkedDatabaseState.engine, tableName, mappedRow);
    lastExecutedSql = sqlResult.sqlExecuted;
    if (sqlResult.success) {
      realDbSynced = !linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === 'conectado';
    } else {
      realDbError = sqlResult.error;
    }

    // 5. Registra o comando no log oficial de auditoria
    logSql(tableName, 'INSERT', sqlResult.sqlExecuted, 1);
  }

  linkedDatabaseState.lastInsertedAt = new Date().toISOString();
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();

  return res.status(201).json({
    success: true,
    table: tableName,
    insertedCount,
    totalTableRecords: targetTable.size,
    totalDatabaseRecords: linkedDatabaseState.totalRecordsCount,
    lastInsertedAt: linkedDatabaseState.lastInsertedAt,
    sqlExecuted: lastExecutedSql,
    realDbSynced,
    realDbError,
    message: `Sucesso: ${insertedCount} registro(s) inserido(s) e persistido(s) na tabela "${tableName}" do banco de dados!${
      realDbSynced ? ' [Persistido no SGBD Externo]' : realDbError ? ` [Aviso: Erro no SGBD externo: ${realDbError}]` : ''
    }`,
  });
});

/**
 * 5. EXCLUSÃO DE REGISTRO DO BANCO
 * DELETE /api/database/delete/:table/:id
 */
databaseRouter.delete('/database/delete/:table/:id', async (req: Request, res: Response) => {
  const { table: tableName, id } = req.params;
  const targetTable = databaseTables[tableName];

  if (!targetTable) {
    return res.status(404).json({ success: false, message: `Tabela "${tableName}" não encontrada.` });
  }

  const existed = targetTable.delete(id);
  if (tableName === 'stock_items') {
    inventoryStore.deleteProduct(id);
  }
  if (tableName === 'system_users') {
    inventoryStore.deleteUser(id);
  }

  // Executa no SGBD real se conectado
  const delResult = await executeRealSqlDelete(linkedDatabaseState.engine, tableName, id);
  logSql(tableName, 'DELETE', delResult.sqlExecuted, existed ? 1 : 0);
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();

  return res.json({
    success: true,
    deleted: existed,
    sqlExecuted: delResult.sqlExecuted,
    message: existed ? `Registro "${id}" removido da tabela "${tableName}".` : 'Registro não encontrado.',
  });
});

/**
 * 6. SINCRONIZAÇÃO COMPLETA DE ENTIDADES
 * POST /api/database/sync-all
 */
databaseRouter.post('/database/sync-all', async (req: Request, res: Response) => {
  const {
    items,
    suppliers,
    employees,
    companies,
    losses,
    countSessions,
    orders,
    unlistedItems,
    settings,
    invoices,
  } = req.body || {};

  let count = 0;

  if (Array.isArray(companies)) {
    for (const c of companies) {
      const mapped = mapEntityToSqlRow('tenants_companies', c);
      databaseTables.tenants_companies.set(c.id, { ...c, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'tenants_companies', mapped);
      count++;
    }
  }

  if (Array.isArray(employees)) {
    for (const e of employees) {
      const mapped = mapEntityToSqlRow('system_users', e);
      databaseTables.system_users.set(e.id, { ...e, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'system_users', mapped);
      count++;
    }
  }

  if (Array.isArray(suppliers)) {
    for (const s of suppliers) {
      const mapped = mapEntityToSqlRow('suppliers', s);
      databaseTables.suppliers.set(s.id, { ...s, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'suppliers', mapped);
      count++;
    }
  }

  if (Array.isArray(items)) {
    for (const it of items) {
      const mapped = mapEntityToSqlRow('stock_items', it);
      databaseTables.stock_items.set(it.id, { ...it, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'stock_items', mapped);
      count++;
    }
  }

  if (Array.isArray(losses)) {
    for (const l of losses) {
      const mapped = mapEntityToSqlRow('loss_records', l);
      databaseTables.loss_records.set(l.id, { ...l, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'loss_records', mapped);
      count++;
    }
  }

  if (Array.isArray(countSessions)) {
    for (const cs of countSessions) {
      const mapped = mapEntityToSqlRow('stock_count_sessions', cs);
      databaseTables.stock_count_sessions.set(cs.id, { ...cs, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'stock_count_sessions', mapped);
      count++;
    }
  }

  if (Array.isArray(orders)) {
    for (const o of orders) {
      const mapped = mapEntityToSqlRow('purchase_orders', o);
      databaseTables.purchase_orders.set(o.id, { ...o, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'purchase_orders', mapped);
      count++;
    }
  }

  if (Array.isArray(unlistedItems)) {
    for (const u of unlistedItems) {
      databaseTables.unlisted_count_items.set(u.id, u);
      count++;
    }
  }

  if (settings) {
    databaseTables.system_settings.set('global', settings);
    count++;
  }

  if (Array.isArray(invoices)) {
    for (const inv of invoices) {
      const mapped = mapEntityToSqlRow('invoices_history', inv);
      databaseTables.invoices_history.set(inv.id, { ...inv, ...mapped });
      await executeRealSqlUpsert(linkedDatabaseState.engine, 'invoices_history', mapped);
      count++;
    }
  }

  linkedDatabaseState.lastInsertedAt = new Date().toISOString();
  linkedDatabaseState.totalRecordsCount = calculateTotalRecords();

  logSql('MULTIPLE', 'INSERT', `-- Sincronização em lote: ${count} registros processados em todas as tabelas`, count);

  return res.json({
    success: true,
    recordsProcessed: count,
    totalRecordsInDatabase: linkedDatabaseState.totalRecordsCount,
    message: `${count} registro(s) sincronizados em todas as tabelas estruturais do banco de dados!`,
  });
});

/**
 * 7. Obter todos os dados do banco
 * GET /api/database/all-data
 * Se o banco externo estiver conectado, busca os dados reais das tabelas!
 */
databaseRouter.get('/database/all-data', async (_req: Request, res: Response) => {
  // Se o banco externo estiver conectado e não for simulado, carrega os dados reais do SGBD!
  if (!linkedDatabaseState.isSimulationMode && linkedDatabaseState.status === 'conectado') {
    try {
      if (linkedDatabaseState.engine === 'postgres') {
        const client = new pg.Client({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || '',
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 5000,
        });
        await client.connect();

        const tablesToCheck = ['tenants_companies', 'categories', 'system_users', 'suppliers', 'stock_items', 'loss_records', 'purchase_orders'];
        for (const t of tablesToCheck) {
          try {
            const queryRes = await client.query(`SELECT * FROM ${t};`);
            if (databaseTables[t]) {
              queryRes.rows.forEach((r) => databaseTables[t].set(r.id, r));
            }
          } catch {}
        }
        await client.end();
      } else if (linkedDatabaseState.engine === 'mysql') {
        const conn = await mysql.createConnection({
          host: linkedDatabaseState.host,
          port: linkedDatabaseState.port,
          database: linkedDatabaseState.database,
          user: linkedDatabaseState.username,
          password: linkedDatabaseState.password || '',
          ssl: linkedDatabaseState.ssl ? { rejectUnauthorized: false } : undefined,
          connectTimeout: 5000,
        });

        const tablesToCheck = ['tenants_companies', 'categories', 'system_users', 'suppliers', 'stock_items', 'loss_records', 'purchase_orders'];
        for (const t of tablesToCheck) {
          try {
            const [rows]: any = await conn.query(`SELECT * FROM ${t};`);
            if (databaseTables[t] && Array.isArray(rows)) {
              rows.forEach((r: any) => databaseTables[t].set(r.id, r));
            }
          } catch {}
        }
        await conn.end();
      }
    } catch (loadErr: any) {
      console.warn('[Load Real DB Data Warning]:', loadErr.message);
    }
  }

  const result: Record<string, any[]> = {};
  for (const [key, map] of Object.entries(databaseTables)) {
    result[key] = Array.from(map.values());
  }

  // Anexa a configuração de banco correspondente em cada empresa tenant
  if (result.tenants_companies && Array.isArray(result.tenants_companies)) {
    result.tenants_companies = result.tenants_companies.map((c: any) => {
      const tenantCfg = tenantDatabaseConfigs[c.id];
      if (tenantCfg) {
        const { password: _p, ...cleanCfg } = tenantCfg;
        return { ...c, databaseConfig: cleanCfg };
      }
      return c;
    });
  }

  // Sanitiza mapa de tenants para o retorno
  const sanitizedTenants: Record<string, any> = {};
  for (const [tId, tCfg] of Object.entries(tenantDatabaseConfigs)) {
    const { password: _p, ...cleanCfg } = tCfg;
    sanitizedTenants[tId] = cleanCfg;
  }

  return res.json({
    success: true,
    databaseConfig: publicDbState(),
    tenantConfigs: sanitizedTenants,
    tables: result,
    stats: {
      companies: databaseTables.tenants_companies.size,
      categories: databaseTables.categories.size,
      users: databaseTables.system_users.size,
      suppliers: databaseTables.suppliers.size,
      stockItems: databaseTables.stock_items.size,
      losses: databaseTables.loss_records.size,
      sessions: databaseTables.stock_count_sessions.size,
      orders: databaseTables.purchase_orders.size,
      totalRecords: calculateTotalRecords(),
    },
  });
});

/**
 * 8. Obter status atual do banco vinculado (suporta filtro por tenantId)
 * GET /api/database/status
 */
databaseRouter.get('/database/status', (req: Request, res: Response) => {
  const reqTenantId = req.query.tenantId ? String(req.query.tenantId).trim() : null;
  let targetConfig = linkedDatabaseState;
  if (reqTenantId && tenantDatabaseConfigs[reqTenantId]) {
    targetConfig = tenantDatabaseConfigs[reqTenantId];
  }

  const { password: _p, ...sanitizedTarget } = targetConfig;

  // Sanitiza mapa de tenants
  const sanitizedTenants: Record<string, any> = {};
  for (const [tId, tCfg] of Object.entries(tenantDatabaseConfigs)) {
    const { password: _pw, ...cleanCfg } = tCfg;
    sanitizedTenants[tId] = cleanCfg;
  }

  return res.json({
    databaseConfig: {
      ...sanitizedTarget,
      totalRecordsCount: calculateTotalRecords(),
    },
    tenantConfigs: sanitizedTenants,
    activeTenantId: reqTenantId || '00000000000001',
    availableEngines: [
      { id: 'postgres', name: 'PostgreSQL', defaultPort: 5432, driver: 'pg' },
      { id: 'mysql', name: 'MySQL', defaultPort: 3306, driver: 'mysql2' },
      { id: 'sqlserver', name: 'Microsoft SQL Server', defaultPort: 1433, driver: 'mssql' },
    ],
    systemTablesCount: SYSTEM_TABLES.length,
    tableRecords: {
      stock_items: databaseTables.stock_items.size,
      suppliers: databaseTables.suppliers.size,
      system_users: databaseTables.system_users.size,
      tenants_companies: databaseTables.tenants_companies.size,
      categories: databaseTables.categories.size,
      loss_records: databaseTables.loss_records.size,
      stock_count_sessions: databaseTables.stock_count_sessions.size,
      purchase_orders: databaseTables.purchase_orders.size,
    },
    recentLogs: sqlExecutionLogs.slice(0, 15),
  });
});

/**
 * 9. Obter Registros de uma tabela específica
 * GET /api/database/table-data/:table
 */
databaseRouter.get('/database/table-data/:table', (req: Request, res: Response) => {
  const tableName = req.params.table;
  const targetTable = databaseTables[tableName];

  if (!targetTable) {
    return res.status(404).json({
      success: false,
      message: `Tabela "${tableName}" não encontrada.`,
    });
  }

  const rows = Array.from(targetTable.values());
  return res.json({
    success: true,
    table: tableName,
    count: rows.length,
    rows,
  });
});

/**
 * 10. Obter Logs de Execução SQL em tempo real
 * GET /api/database/sql-logs
 */
databaseRouter.get('/database/sql-logs', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    engine: linkedDatabaseState.engine,
    database: linkedDatabaseState.database,
    totalLogs: sqlExecutionLogs.length,
    logs: sqlExecutionLogs,
  });
});

/**
 * 11. Baixar/Consultar Script DDL formatado
 * GET /api/database/script/:engine
 */
databaseRouter.get('/database/script/:engine', (req: Request, res: Response) => {
  const rawEngine = (req.params.engine || 'postgres').toLowerCase() as DatabaseEngine;
  const engine: DatabaseEngine = ['mysql', 'postgres', 'sqlserver'].includes(rawEngine) ? rawEngine : 'postgres';
  const dbName = (req.query.database as string) || 'restaurante_estoque_db';

  const script = generateDatabaseScript(engine, dbName);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.send(script);
});
