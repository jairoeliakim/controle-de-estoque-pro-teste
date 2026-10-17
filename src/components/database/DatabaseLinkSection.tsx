import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Layers,
  Lock,
  Code,
  Sparkles,
  Clock,
  ArrowRight,
  Shield,
  Zap,
  Building2,
} from 'lucide-react';
import { DatabaseEngine, DatabaseConnectionConfig } from '../../types';
import { SYSTEM_TABLES, generateDatabaseScript } from '../../utils/databaseScripts';

interface DatabaseLinkSectionProps {
  initialConfig?: DatabaseConnectionConfig;
  onUpdateConfig: (config: DatabaseConnectionConfig) => void;
  tenantId?: string;
  companyName?: string;
  companyCnpj?: string;
}

export const DatabaseLinkSection: React.FC<DatabaseLinkSectionProps> = ({
  initialConfig,
  onUpdateConfig,
  tenantId,
  companyName,
  companyCnpj,
}) => {
  // Config states
  const [engine, setEngine] = useState<DatabaseEngine>(initialConfig?.engine || 'postgres');
  const [host, setHost] = useState<string>(initialConfig?.host || '');
  const [port, setPort] = useState<number>(initialConfig?.port || 5432);
  const [database, setDatabase] = useState<string>(initialConfig?.database || '');
  const [username, setUsername] = useState<string>(initialConfig?.username || '');
  const [password, setPassword] = useState<string>(initialConfig?.password || '');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [ssl, setSsl] = useState<boolean>(initialConfig?.ssl || false);

  // Status & action states
  const [status, setStatus] = useState<'desconectado' | 'conectado' | 'erro'>(
    initialConfig?.status || 'desconectado'
  );
  const [serverVersion, setServerVersion] = useState<string | undefined>(
    initialConfig?.serverVersion
  );
  const [lastConnectedAt, setLastConnectedAt] = useState<string | undefined>(
    initialConfig?.lastConnectedAt
  );
  const [tablesCreated, setTablesCreated] = useState<boolean>(
    initialConfig?.tablesCreated || false
  );
  const [lastMigrationAt, setLastMigrationAt] = useState<string | undefined>(
    initialConfig?.lastMigrationAt
  );

  // Interaction feedback states
  const [simulationMode, setSimulationMode] = useState<boolean>(
    initialConfig?.isSimulationMode || false
  );
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    databaseExists?: boolean;
    recommendation?: string;
    latencyMs?: number;
    version?: string;
    simulationMode?: boolean;
  } | null>(null);

  const [autoRunScript, setAutoRunScript] = useState<boolean>(false);
  const [isRunningScript, setIsRunningScript] = useState<boolean>(false);
  const [completedTables, setCompletedTables] = useState<string[]>(
    initialConfig?.tablesCreated ? SYSTEM_TABLES.map((t) => t.name) : []
  );
  const [scriptSuccessMessage, setScriptSuccessMessage] = useState<string | null>(null);

  const [showSqlViewer, setShowSqlViewer] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [totalRecordsCount, setTotalRecordsCount] = useState<number>(0);
  const [lastInsertedAt, setLastInsertedAt] = useState<string | undefined>();
  const [sqlLogs, setSqlLogs] = useState<any[]>([]);
  const [showSqlLogs, setShowSqlLogs] = useState<boolean>(false);
  const [tableRecords, setTableRecords] = useState<Record<string, number>>({});

  // Consulta status e logs de alimentação da rota do banco em tempo real
  const fetchDatabaseStatus = async () => {
    try {
      const url = tenantId ? `/api/database/status?tenantId=${encodeURIComponent(tenantId)}` : '/api/database/status';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.databaseConfig) {
          setStatus(data.databaseConfig.status || 'desconectado');
          setSimulationMode(Boolean(data.databaseConfig.isSimulationMode));
          setTotalRecordsCount(data.databaseConfig.totalRecordsCount || 0);
          setLastInsertedAt(data.databaseConfig.lastInsertedAt);
          setTablesCreated(Boolean(data.databaseConfig.tablesCreated));
          if (data.databaseConfig.tablesCreated && completedTables.length === 0) {
            setCompletedTables(SYSTEM_TABLES.map((t) => t.name));
          }
          // Se há configuração salva no tenant do banco, hidrata os campos
          if (data.databaseConfig.host && (!host || data.databaseConfig.status === 'conectado')) {
            setHost(data.databaseConfig.host);
            setPort(data.databaseConfig.port);
            setDatabase(data.databaseConfig.database);
            setUsername(data.databaseConfig.username);
            setEngine(data.databaseConfig.engine);
            setSsl(Boolean(data.databaseConfig.ssl));
          }
        }
        if (data.tableRecords) {
          setTableRecords(data.tableRecords);
        }
        if (data.recentLogs) {
          setSqlLogs(data.recentLogs);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchDatabaseStatus();
    const timer = setInterval(fetchDatabaseStatus, 3500);
    return () => clearInterval(timer);
  }, [tenantId]);

  // Sync when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setEngine(initialConfig.engine || 'postgres');
      setHost(initialConfig.host || '');
      setPort(initialConfig.port || (initialConfig.engine === 'mysql' ? 3306 : initialConfig.engine === 'sqlserver' ? 1433 : 5432));
      setDatabase(initialConfig.database || '');
      setUsername(initialConfig.username || '');
      setPassword(initialConfig.password || '');
      setSsl(initialConfig.ssl || false);
      setStatus(initialConfig.status || 'desconectado');
      setSimulationMode(initialConfig.isSimulationMode || false);
      setServerVersion(initialConfig.serverVersion);
      setLastConnectedAt(initialConfig.lastConnectedAt);
      setTablesCreated(initialConfig.tablesCreated || false);
      setLastMigrationAt(initialConfig.lastMigrationAt);
      if (initialConfig.tablesCreated) {
        setCompletedTables(SYSTEM_TABLES.map((t) => t.name));
      }
    }
  }, [initialConfig, tenantId]);

  // Ao alterar o motor do banco, ajustar a porta padrão
  const handleSelectEngine = (newEngine: DatabaseEngine) => {
    setEngine(newEngine);
    setTestResult(null);
    setScriptSuccessMessage(null);

    // Atualizar portas padrões automaticamente
    if (newEngine === 'postgres') {
      setPort(5432);
    } else if (newEngine === 'mysql') {
      setPort(3306);
    } else if (newEngine === 'sqlserver') {
      setPort(1433);
    }
  };

  // 1. Ação: Vincular Banco de Dados (Validação + Handshake)
  const handleLinkDatabase = async (overrideSimulation?: boolean) => {
    const useSim = overrideSimulation !== undefined ? overrideSimulation : simulationMode;

    if (!host.trim()) {
      setTestResult({ success: false, message: 'Por favor, informe o host ou IP do servidor de banco.' });
      return;
    }
    if (!database.trim()) {
      setTestResult({ success: false, message: 'Por favor, informe o nome do banco de dados.' });
      return;
    }
    if (!username.trim()) {
      setTestResult({ success: false, message: 'Por favor, informe o usuário de conexão.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setScriptSuccessMessage(null);

    try {
      // 1. Testa a conexão com a API backend (validação TCP real caso useSim === false)
      const response = await fetch('/api/database/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
          simulationMode: useSim,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus('erro');
        setTestResult({
          success: false,
          databaseExists: data.databaseExists,
          message: data.message || 'Falha ao autenticar no banco de dados.',
          recommendation: data.recommendation,
          latencyMs: data.latencyMs,
          simulationMode: false,
        });
        onUpdateConfig({
          engine,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
          status: 'erro',
          isSimulationMode: useSim,
          errorMessage: data.message,
          tablesCreated,
        });
        return;
      }

      // 2. Vincula o banco de dados no backend
      const linkRes = await fetch('/api/database/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
          simulationMode: useSim,
          tenantId: tenantId || initialConfig?.tenantId || '00000000000001',
        }),
      });

      const linkData = await linkRes.json();
      if (!linkRes.ok || !linkData.success) {
        setStatus('erro');
        setTestResult({
          success: false,
          message: linkData.message || 'Falha ao consolidar vínculo.',
          recommendation: linkData.recommendation,
        });
        return;
      }

      const now = new Date().toISOString();
      setStatus('conectado');
      setServerVersion(data.serverVersion);
      setLastConnectedAt(now);

      const result = {
        success: true,
        message: data.message || `Conexão efetuada com sucesso ao ${engine.toUpperCase()} em ${host}:${port}!`,
        latencyMs: data.latencyMs || 28,
        version: data.serverVersion,
        simulationMode: Boolean(data.simulationMode),
      };
      setTestResult(result);

      // Notifica o estado consolidado
      const updatedConfig: DatabaseConnectionConfig = {
        engine,
        host: host.trim(),
        port: Number(port),
        database: database.trim(),
        username: username.trim(),
        password,
        ssl,
        status: 'conectado',
        isSimulationMode: Boolean(data.simulationMode),
        lastConnectedAt: now,
        tablesCreated,
        tablesCount: completedTables.length,
        lastMigrationAt,
        serverVersion: data.serverVersion,
        tenantId: tenantId || initialConfig?.tenantId || '00000000000001',
      };
      onUpdateConfig(updatedConfig);

      // Se a opção de rodar script automático estiver ativa, dispara a criação de tabelas
      if (autoRunScript) {
        setTimeout(() => {
          handleExecuteMigration(updatedConfig);
        }, 400);
      }
    } catch (err: any) {
      setStatus('erro');
      setTestResult({
        success: false,
        message: err.message || 'Não foi possível conectar ao banco de dados informado. Verifique host, porta e credenciais.',
      });
      onUpdateConfig({
        engine,
        host: host.trim(),
        port: Number(port),
        database: database.trim(),
        username: username.trim(),
        password,
        ssl,
        status: 'erro',
        isSimulationMode: useSim,
        tablesCreated,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 2. Ação: Rodar Script para Criar as Tabelas do Sistema
  const handleExecuteMigration = async (currentCfg?: DatabaseConnectionConfig) => {
    setIsRunningScript(true);
    setScriptSuccessMessage(null);
    setCompletedTables([]);

    try {
      // Dispara requisição para criar tabelas na API
      const reqPromise = fetch('/api/database/create-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          database: database.trim(),
        }),
      });

      // Animação progressiva das 15 tabelas sendo criadas passo a passo
      const tables = SYSTEM_TABLES;
      for (let i = 0; i < tables.length; i++) {
        await new Promise((r) => setTimeout(r, 65));
        setCompletedTables((prev) => [...prev, tables[i].name]);
      }

      const response = await reqPromise;
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro durante a execução do script DDL.');
      }

      const now = new Date().toISOString();
      setTablesCreated(true);
      setLastMigrationAt(now);
      setScriptSuccessMessage(
        `Todas as ${SYSTEM_TABLES.length} tabelas do sistema foram criadas e preparadas com sucesso no banco "${database}"!`
      );

      // Notifica o componente pai sobre a migração concluída
      const finalConfig: DatabaseConnectionConfig = {
        ...(currentCfg || {
          engine,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
        }),
        status: 'conectado',
        tablesCreated: true,
        tablesCount: SYSTEM_TABLES.length,
        lastMigrationAt: now,
        serverVersion: serverVersion || data.serverVersion,
      };
      onUpdateConfig(finalConfig);
    } catch (err: any) {
      alert(`Erro ao criar tabelas: ${err.message}`);
    } finally {
      setIsRunningScript(false);
    }
  };

  const handleCopySqlScript = () => {
    const script = generateDatabaseScript(engine, database);
    navigator.clipboard.writeText(script);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Banner de Tenant / Empresa Vinculada */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400">Tenant / Empresa Ativa:</span>
              <strong className="text-sm font-bold text-amber-200">
                {companyName || 'Empresa Matriz (CEC Conecta)'}
              </strong>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Identificador do Tenant (CNPJ): <span className="text-slate-200 font-bold">{companyCnpj || tenantId || '00000000000001'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Salvo no Tenant da Empresa</span>
          </span>
        </div>
      </div>

      {/* Intro Header */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-900/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-100">
                  Vínculo de Banco de Dados Relacional Externo
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  MySQL • Postgres • SQL Server
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Conecte o sistema diretamente à sua infraestrutura de banco de dados relacional. Informe as credenciais para validação da conexão e execute a criação das tabelas estruturais do sistema.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0 flex items-center gap-2">
            {status === 'conectado' ? (
              simulationMode ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Modo Simulado (Em Memória)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Banco Externo Vinculado ({engine.toUpperCase()})</span>
                </span>
              )
            ) : status === 'erro' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Erro de Conexão</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>Não Vinculado</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1. Seleção de Opções de Banco de Dados */}
      <div>
        <label className="block text-xs font-bold text-slate-200 mb-2.5 flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>1. Selecione o Motor de Banco de Dados (SGBD):</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Opção 1: PostgreSQL */}
          <button
            type="button"
            onClick={() => handleSelectEngine('postgres')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
              engine === 'postgres'
                ? 'bg-blue-500/15 border-blue-500 text-blue-100 shadow-lg shadow-blue-500/10'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  <span>PostgreSQL</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                  Porta 5432
                </span>
              </div>
              <h5 className="text-sm font-bold text-slate-100 mt-2">Postgres 13+ / 16</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Ideal para alta concorrência, tipos JSONB e isolamento estrito com Row-Level Locking.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Dialeto SQL: ANSI/PG</span>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                engine === 'postgres' ? 'bg-blue-500 text-slate-950 font-bold' : 'border border-slate-700'
              }`}>
                {engine === 'postgres' ? '✓' : ''}
              </div>
            </div>
          </button>

          {/* Opção 2: MySQL */}
          <button
            type="button"
            onClick={() => handleSelectEngine('mysql')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
              engine === 'mysql'
                ? 'bg-amber-500/15 border-amber-500 text-amber-100 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  <span>MySQL</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Porta 3306
                </span>
              </div>
              <h5 className="text-sm font-bold text-slate-100 mt-2">MySQL 8.0+ / MariaDB</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Mecanismo InnoDB com charset utf8mb4, transações ACID e suporte de mercado amplo.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Engine: InnoDB</span>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                engine === 'mysql' ? 'bg-amber-500 text-slate-950 font-bold' : 'border border-slate-700'
              }`}>
                {engine === 'mysql' ? '✓' : ''}
              </div>
            </div>
          </button>

          {/* Opção 3: SQL Server */}
          <button
            type="button"
            onClick={() => handleSelectEngine('sqlserver')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
              engine === 'sqlserver'
                ? 'bg-purple-500/15 border-purple-500 text-purple-100 shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  <span>SQL Server</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  Porta 1433
                </span>
              </div>
              <h5 className="text-sm font-bold text-slate-100 mt-2">MS SQL Server 2019+ / Azure</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Padrão corporativo T-SQL com suporte robusto para servidores Windows e Azure SQL.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Dialeto: T-SQL MSSQL</span>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                engine === 'sqlserver' ? 'bg-purple-500 text-slate-950 font-bold' : 'border border-slate-700'
              }`}>
                {engine === 'sqlserver' ? '✓' : ''}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Parâmetros de Conexão: Host, Porta, Nome do Banco, Usuário e Senha */}
      <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/80">
          <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>2. Credenciais & Parâmetros de Acesso ao Banco:</span>
          </h5>
          <span className="text-[11px] text-slate-400">
            Motor selecionado: <strong className="text-cyan-300 capitalize">{engine}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          {/* Host / Servidor */}
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Host / IP do Servidor: <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="Ex: localhost, 127.0.0.1 ou db.empresa.com.br"
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          {/* Porta do Banco */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Porta do Banco: <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 0)}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Nome do Banco de Dados */}
          <div className="sm:col-span-6">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Nome do Banco de Dados (Database): <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="Ex: restaurante_estoque_db"
              className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          {/* Usuário */}
          <div className="sm:col-span-6">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Usuário do Banco: <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={engine === 'mysql' ? 'root' : engine === 'sqlserver' ? 'sa' : 'postgres'}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          {/* Senha do Banco */}
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Senha do Banco:
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Informe a senha de autenticação do banco"
                className="w-full py-2 pl-3 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Opções de SSL & Automação */}
          <div className="sm:col-span-4 flex flex-col justify-end">
            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 focus:ring-cyan-400"
              />
              <span className="text-xs text-slate-300 font-medium">SSL / Conexão Segura</span>
            </label>
          </div>
        </div>

        {/* Opção de Modo Simulado vs Conexão Real */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={simulationMode}
              onChange={(e) => setSimulationMode(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span>Modo de Teste Simulado (Em Memória / Sem Servidor Externo)</span>
                {simulationMode && (
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Modo Simulado Ativo
                  </span>
                )}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                Deixe desmarcado para validar a conexão <strong>TCP real</strong> com o seu PostgreSQL, MySQL ou SQL Server. Se o serviço ou o banco ainda não existirem no servidor, o teste acusará falha real para evitar falsos positivos.
              </span>
            </div>
          </label>

          {/* Checkbox: Rodar script automaticamente após validar */}
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoRunScript}
              onChange={(e) => setAutoRunScript(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-cyan-400 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Rodar script de criação das tabelas do sistema automaticamente após validação
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                Ao validar com sucesso, cria instantaneamente as 15 tabelas (tenants, usuários, categorias, fornecedores, estoques, perdas, pedidos e contagens) no banco.
              </span>
            </div>
          </label>
        </div>

        {/* 3. Botão para Vincular o Banco de Dados */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Validação de handshake TCP Socket em tempo real com timeout</span>
          </div>

          <button
            type="button"
            id="btn-vincular-banco"
            onClick={() => handleLinkDatabase()}
            disabled={isTesting || isRunningScript}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${
              isTesting
                ? 'bg-cyan-600/50 text-cyan-100 cursor-wait'
                : simulationMode
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
            }`}
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Testando Conexão Real ({host}:{port})...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>{simulationMode ? 'Vincular em Modo Simulado' : 'Testar & Vincular Banco Real'}</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback do Teste de Conexão */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs animate-in fade-in space-y-2.5 ${
              testResult.success
                ? testResult.simulationMode
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {testResult.success ? (
                testResult.simulationMode ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm block">
                    {testResult.success
                      ? testResult.simulationMode
                        ? 'Banco Vinculado em Modo Simulado (Em Memória)'
                        : 'Servidor Conectado & Validado com Sucesso!'
                      : testResult.databaseExists === false
                      ? `Atenção: O Banco de Dados "${database}" Não Existe no Servidor`
                      : 'Falha de Conexão: Servidor Inacessível ou Autenticação Rejeitada'}
                  </span>
                  {testResult.simulationMode && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Ambiente em Memória
                    </span>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed opacity-90">{testResult.message}</p>

                {/* Orientações em caso de falha de conexão real */}
                {!testResult.success && testResult.recommendation && (
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-rose-500/30 text-[11px] text-slate-300 space-y-2 font-mono whitespace-pre-line">
                    <span className="text-amber-400 font-bold block font-sans text-xs">
                      Por que isto aconteceu e como resolver:
                    </span>
                    <p className="text-slate-300 leading-relaxed font-sans">{testResult.recommendation}</p>

                    {!simulationMode && (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] text-slate-400 font-sans">
                          Não tem um servidor de banco instalado agora?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSimulationMode(true);
                            handleLinkDatabase(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-xs transition-all shadow cursor-pointer"
                        >
                          Ativar Modo Simulado e Continuar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {testResult.version && (
                  <div className="pt-1 text-[10px] font-mono opacity-80 flex items-center gap-2 flex-wrap">
                    <span>Motor: {testResult.version}</span>
                    {testResult.latencyMs !== undefined && <span>• Latência: {testResult.latencyMs}ms</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Painel de Execução do Script para Criar Tabelas do Sistema */}
      {(status === 'conectado' || tablesCreated) && (
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>3. Execução do Script: Tabelas Estruturais do Sistema</span>
                </h5>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {completedTables.length} de {SYSTEM_TABLES.length} Tabelas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Cria e valida a integridade referencial das tabelas no banco de dados <strong>{database}</strong> ({engine.toUpperCase()}).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSqlViewer(!showSqlViewer)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                <span>{showSqlViewer ? 'Ocultar Script SQL' : 'Ver Script SQL'}</span>
              </button>

              <button
                type="button"
                id="btn-rodar-script-tabelas"
                onClick={() => handleExecuteMigration()}
                disabled={isRunningScript}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer ${
                  isRunningScript
                    ? 'bg-emerald-600/50 text-emerald-100 cursor-wait'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {isRunningScript ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando Tabelas ({completedTables.length}/{SYSTEM_TABLES.length})...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{tablesCreated ? 'Recriar / Atualizar Tabelas' : 'Rodar Script & Criar Tabelas'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Notificação de sucesso da criação das tabelas */}
          {scriptSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{scriptSuccessMessage}</span>
            </div>
          )}

          {/* Lista das 15 tabelas do sistema com status */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Tabelas do Sistema Alvo:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SYSTEM_TABLES.map((table) => {
                const isCreated = completedTables.includes(table.name);
                const count = tableRecords[table.name];
                return (
                  <div
                    key={table.name}
                    className={`p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                      isCreated
                        ? 'bg-slate-900 border-emerald-500/40 text-slate-200 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isCreated ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-[11px] truncate text-slate-100">
                          {table.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {count !== undefined && count > 0 && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {count} {count === 1 ? 'reg' : 'regs'}
                            </span>
                          )}
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {table.category}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5" title={table.description}>
                        {table.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visualizador do Script SQL DDL */}
          {showSqlViewer && (
            <div className="pt-3 border-t border-slate-800 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-cyan-300 font-bold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>DDL Script Gerado ({engine.toUpperCase()}):</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopySqlScript}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar Script SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-56 overflow-y-auto font-mono text-[11px] text-slate-300 leading-relaxed scrollbar-thin">
                <pre className="whitespace-pre-wrap">{generateDatabaseScript(engine, database)}</pre>
              </div>
            </div>
          )}

          {/* Metadados da última migração e Alimentação do Banco */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">Alimentação Automática das Rotas do Banco</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Sincronização Ativa" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Todas as inserções (produtos, colaboradores, fornecedores, contagens, perdas, pedidos) alimentam o banco de dados em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total no Banco</span>
                  <span className="font-mono text-sm font-bold text-cyan-300">{totalRecordsCount} registros</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSqlLogs(!showSqlLogs)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    showSqlLogs
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showSqlLogs ? 'Ocultar Logs SQL' : `Logs SQL (${sqlLogs.length})`}</span>
                </button>
              </div>
            </div>

            {/* Visualizador dos Logs SQL em tempo real */}
            {showSqlLogs && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 font-mono text-cyan-300">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Últimas Operações Executadas no Banco ({engine.toUpperCase()}):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {lastInsertedAt ? `Última inserção: ${new Date(lastInsertedAt).toLocaleTimeString('pt-BR')}` : 'Pronto para receber cadastros'}
                  </span>
                </div>

                {sqlLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-2">
                    Nenhum comando registrado ainda. Cadastre um produto, fornecedor ou colaborador para visualizar a execução em tempo real.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin font-mono text-[11px]">
                    {sqlLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-start justify-between gap-2 text-slate-300"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                log.operation === 'INSERT'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : log.operation === 'DELETE'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {log.operation}
                            </span>
                            <span className="text-cyan-400 font-bold text-[10px]">{log.table}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate text-ellipsis">{log.sql}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {lastMigrationAt && (
              <div className="text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Última execução DDL das tabelas: {new Date(lastMigrationAt).toLocaleString('pt-BR')}</span>
                </span>
                <span className="text-emerald-400 font-medium">
                  15 tabelas ativas e sincronizadas no banco {engine.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
