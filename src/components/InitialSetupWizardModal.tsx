import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Server,
  RefreshCw,
  Terminal,
  Lock,
  X,
  Sliders,
  Check,
  Globe,
  Zap,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Company, DatabaseEngine, DatabaseConnectionConfig, UserRole } from '../types';
import { formatCNPJ, validateCNPJ, autoFixCNPJCheckDigits, cleanCNPJ } from '../utils/cnpjValidator';
import { syncAllDataToDatabase } from '../utils/databaseSync';
import { lookupReceitaWsCnpj, ReceitaWSResponse } from '../services/receitaWsService';

interface InitialSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCompany: (company: Company) => void;
  onCompleteSetup: (companyId: string) => void;
  existingCompanies: Company[];
  currentRole: UserRole;
  onOpenParametrizacaoDatabase?: () => void;
}

export const InitialSetupWizardModal: React.FC<InitialSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onSaveCompany,
  onCompleteSetup,
  existingCompanies,
  currentRole,
  onOpenParametrizacaoDatabase,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Cadastro da Empresa Matriz
  const [cnpj, setCnpj] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [stateUF, setStateUF] = useState('SP');
  const [phone, setPhone] = useState('(11) 98888-7777');
  const [email, setEmail] = useState('contato@empresa.com.br');
  const [segment, setSegment] = useState('Desenvolvimento de Software');
  const [address, setAddress] = useState('');
  const [managerName, setManagerName] = useState('Administrador Geral');
  const [companySaved, setCompanySaved] = useState<Company | null>(null);

  // ReceitaWS state
  const [isSearchingReceita, setIsSearchingReceita] = useState(false);
  const [receitaError, setReceitaError] = useState<string | null>(null);
  const [receitaSuccessMessage, setReceitaSuccessMessage] = useState<string | null>(null);
  const [receitaData, setReceitaData] = useState<ReceitaWSResponse | null>(null);

  // Step 2: Sincronização do Banco de Dados
  const [engine, setEngine] = useState<DatabaseEngine>('postgres');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<number>(5432);
  const [database, setDatabase] = useState('restaurante_estoque_db');
  const [username, setUsername] = useState('postgres');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);

  // Status de conexão e sincronização
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [syncedRecordsCount, setSyncedRecordsCount] = useState<number>(0);

  // Ajusta porta padrão quando o motor muda
  useEffect(() => {
    if (engine === 'postgres') setPort(5432);
    else if (engine === 'mysql') setPort(3306);
    else if (engine === 'sqlserver') setPort(1433);
  }, [engine]);

  // Se já houver empresa cadastrada, pré-carrega para facilitar
  useEffect(() => {
    if (isOpen && existingCompanies.length > 0 && !companySaved) {
      const comp = existingCompanies[0];
      setCnpj(comp.cnpj || '');
      setName(comp.name || '');
      setTradeName(comp.tradeName || comp.name || '');
      setCity(comp.city || 'São Paulo');
      setStateUF(comp.state || 'SP');
      setPhone(comp.phone || '(11) 98888-7777');
      setEmail(comp.email || 'contato@empresa.com.br');
      setSegment(comp.segment || 'Desenvolvimento de Software');
    }
  }, [isOpen, existingCompanies, companySaved]);

  if (!isOpen) return null;

  // Validação do CNPJ
  const cnpjValidation = cnpj.trim() ? validateCNPJ(cnpj) : null;
  const isCnpjValid = cnpjValidation ? cnpjValidation.isValid : false;

  const handleFixCnpj = () => {
    if (cnpj) {
      const fixed = autoFixCNPJCheckDigits(cnpj);
      setCnpj(fixed);
    }
  };

  // Evita repetir a consulta automática para o mesmo CNPJ (limite da API pública: 3 consultas/min)
  const lastAutoLookupRef = useRef<string>('');

  const handleCnpjChange = (val: string) => {
    const formatted = formatCNPJ(val);
    setCnpj(formatted);
    setReceitaError(null);
    setReceitaSuccessMessage(null);

    // Busca automática ao completar um CNPJ válido (numérico ou alfanumérico)
    const clean = cleanCNPJ(formatted);
    if (clean.length === 14 && validateCNPJ(clean).isValid && lastAutoLookupRef.current !== clean) {
      lastAutoLookupRef.current = clean;
      handleLookupReceita(clean);
    }
  };

  const handleLookupReceita = async (targetCnpj?: string) => {
    const raw = targetCnpj || cnpj;
    const clean = cleanCNPJ(raw);
    if (clean.length !== 14) {
      setReceitaError('Digite os 14 dígitos do CNPJ para consultar na Receita Federal.');
      return;
    }

    setIsSearchingReceita(true);
    setReceitaError(null);
    setReceitaSuccessMessage(null);

    const result = await lookupReceitaWsCnpj(clean);
    setIsSearchingReceita(false);

    if (!result.success) {
      setReceitaError(result.error || 'Não foi possível consultar os dados na Receita Federal.');
      return;
    }

    // Preenche automaticamente os campos da empresa matriz
    if (result.razaoSocial) setName(result.razaoSocial);
    if (result.nomeFantasia) setTradeName(result.nomeFantasia);
    if (result.cnpjFormatado) setCnpj(result.cnpjFormatado);
    if (result.cidade) setCity(result.cidade);
    if (result.estadoUF) setStateUF(result.estadoUF);
    if (result.telefone) setPhone(result.telefone);
    if (result.email) setEmail(result.email);
    if (result.segmento) setSegment(result.segmento);
    if (result.enderecoCompleto) setAddress(result.enderecoCompleto);
    if (result.responsavelNome) setManagerName(result.responsavelNome);

    if (result.data) {
      setReceitaData(result.data);
    }
    setReceitaSuccessMessage(
      `Dados carregados com sucesso da Receita Federal! Situação: ${result.situacaoCadastral || 'ATIVA'}.`
    );
  };

  // Salvar Empresa Matriz e Avançar para o Passo 2
  const handleSaveCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cnpj.trim()) return;

    const cleanCnpjId = cleanCNPJ(cnpj) || '00000000000001';
    const newCompany: Company = {
      id: cleanCnpjId, // Tenant identificador da empresa é o CNPJ sem traços
      name: name.trim(),
      tradeName: tradeName.trim() || name.trim(),
      cnpj: cnpj.trim(),
      paisOrigem: 'BR',
      tipoDocumento: 'CNPJ',
      documentoIdentificador: cleanCnpjId,
      city: city.trim(),
      state: stateUF.trim().toUpperCase(),
      phone: phone.trim(),
      email: email.trim(),
      segment: segment.trim(),
      address: address.trim() || undefined,
      managerName: managerName.trim() || undefined,
      active: true,
      createdAt: new Date().toISOString(),
    };

    onSaveCompany(newCompany);
    setCompanySaved(newCompany);
    setStep(2); // Avança para a sincronização de banco
  };

  // Lê a resposta como JSON; se vier HTML (ex.: API não publicada), explica o problema real
  const readJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `A API respondeu HTTP ${res.status} com uma página HTML em vez de JSON. Verifique se ${window.location.origin}/api/health responde {"status":"ok"} (a função /api pode não ter sido publicada na Vercel).`
      );
    }
  };

  // Testar e vincular a conexão com o banco
  const handleTestConnection = async () => {
    setIsConnecting(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      // O Supabase exige SSL: ativa automaticamente para hosts supabase
      const useSsl = ssl || /supabase\.(co|com)$/i.test(host.trim());
      if (useSsl && !ssl) setSsl(true);

      const payload = {
        engine,
        host: host.trim(),
        port,
        database: database.trim(),
        username: username.trim(),
        password,
        ssl: useSsl,
      };

      // 1. Testa a conexão real com o SGBD
      const res = await fetch('/api/database/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);

      if (!res.ok || !data.success) {
        setConnectionStatus('error');
        setConnectionMessage(
          [data.message || 'Não foi possível conectar ao banco de dados informado.', data.recommendation]
            .filter(Boolean)
            .join('\n\n')
        );
        return;
      }

      // 2. Vincula o banco ao sistema (usado pelas demais rotas)
      const linkRes = await fetch('/api/database/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const linkData = await readJson(linkRes);

      if (!linkRes.ok || !linkData.success) {
        setConnectionStatus('error');
        setConnectionMessage(
          [linkData.message || 'A conexão funcionou, mas não foi possível vincular o banco.', linkData.recommendation]
            .filter(Boolean)
            .join('\n\n')
        );
        return;
      }

      setConnectionStatus('success');
      setConnectionMessage(
        `Conexão com ${engine.toUpperCase()} estabelecida e vinculada com sucesso! (${data.latencyMs ? `${data.latencyMs}ms` : 'Online'})`
      );
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err?.message || 'Falha na requisição');
    } finally {
      setIsConnecting(false);
    }
  };

  // Sincronizar Banco de Dados (Criar tabelas e sincronizar entidades)
  const handleProvisionAndSyncDatabase = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');

    try {
      // 1. Executa o DDL de criação de tabelas
      const runRes = await fetch('/api/database/create-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          database: database.trim(),
        }),
      });

      const runData = await readJson(runRes);
      if (!runRes.ok || !runData.success) {
        throw new Error(
          [runData.message || 'Falha ao criar as tabelas no banco.', runData.recommendation].filter(Boolean).join(' ')
        );
      }
      const tablesCreated = runData.tablesCount || 12;

      // 2. Dispara a sincronização de entidades
      const targetCompany = companySaved || existingCompanies[0];
      const syncPayload = {
        companies: targetCompany ? [targetCompany] : [],
      };

      const syncRes = await syncAllDataToDatabase(syncPayload);
      if (!syncRes.success) {
        throw new Error(syncRes.message || 'Falha ao sincronizar os cadastros com o banco.');
      }

      setSyncStatus('success');
      setSyncedRecordsCount(syncRes.recordsProcessed || tablesCreated);
      setSyncMessage(
        `Esquema provisionado com ${tablesCreated} tabelas e sincronização estrutural concluída no ${engine.toUpperCase()}!`
      );
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(`Erro ao sincronizar banco: ${err?.message || 'Falha no processamento'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Concluir Setup
  const handleFinish = () => {
    const finalTenantId = companySaved ? companySaved.id : existingCompanies[0]?.id || '00000000000001';
    onCompleteSetup(finalTenantId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/40">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Assistente de Setup & Sincronização Inicial
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-wider">
                  Primeiro Acesso
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Passo a passo obrigatório: cadastre a empresa matriz e sincronize o banco relacional para dar continuidade aos registros.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-2 bg-slate-950/80 border-b border-slate-800 p-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`py-2 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all ${
              step === 1
                ? 'bg-purple-600 text-white font-bold shadow'
                : companySaved
                ? 'text-emerald-400 hover:bg-slate-900'
                : 'text-slate-400 hover:bg-slate-900'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${
                companySaved ? 'bg-emerald-500 text-slate-950' : step === 1 ? 'bg-white text-purple-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {companySaved ? <Check className="w-3.5 h-3.5" /> : '1'}
            </span>
            <span>1. Cadastro da Empresa Matriz</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`py-2 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all ${
              step === 2
                ? 'bg-purple-600 text-white font-bold shadow'
                : syncStatus === 'success'
                ? 'text-emerald-400 hover:bg-slate-900'
                : 'text-slate-400 hover:bg-slate-900'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${
                syncStatus === 'success' ? 'bg-emerald-500 text-slate-950' : step === 2 ? 'bg-white text-purple-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {syncStatus === 'success' ? <Check className="w-3.5 h-3.5" /> : '2'}
            </span>
            <span>2. Sincronização do Banco (SGBD)</span>
          </button>
        </div>

        <div className="p-6">
          {/* ========================================================================= */}
          {/* PASSO 1: CADASTRO DA EMPRESA MATRIZ */}
          {/* ========================================================================= */}
          {step === 1 && (
            <form onSubmit={handleSaveCompanySubmit} className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-purple-100">
                    Definição do Tenant Oficial da Empresa Matriz
                  </p>
                  <p className="text-[11px] text-purple-300/90 leading-relaxed">
                    O identificador da empresa será exatamente o <strong>CNPJ sem traços</strong> (apenas números). Ele será a chave primária de todas as tabelas e garantirá o isolamento dos dados no banco.
                  </p>
                </div>
              </div>

              {/* Bloco de CNPJ e Consulta Automática na Receita Federal */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      CNPJ da Empresa Matriz (Tenant Oficial) *
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Digite o CNPJ para carregar automaticamente Razão Social, Endereço, Contato e Situação Cadastral na Receita Federal.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-purple-300">
                    {cleanCNPJ(cnpj).length}/14 caracteres
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border text-xs font-mono text-slate-100 focus:outline-none transition-colors ${
                        cnpjValidation
                          ? cnpjValidation.isValid
                            ? 'border-emerald-500/80 focus:border-emerald-400'
                            : 'border-rose-500/80 focus:border-rose-400'
                          : 'border-slate-700 focus:border-purple-400'
                      }`}
                    />
                    {cnpjValidation && (
                      <span className="absolute right-2.5 top-2.5">
                        {cnpjValidation.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        )}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLookupReceita()}
                    disabled={isSearchingReceita || cleanCNPJ(cnpj).length !== 14}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSearchingReceita ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                        <span>Buscando na Receita...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-purple-200" />
                        <span>Buscar na Receita Federal</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Validação de DV Módulo 11 */}
                {cnpjValidation && !cnpjValidation.isValid && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-center justify-between gap-2">
                    <span>{cnpjValidation.error}</span>
                    <button
                      type="button"
                      onClick={handleFixCnpj}
                      className="text-[10px] px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold shrink-0"
                    >
                      Corrigir DV
                    </button>
                  </div>
                )}

                {/* Feedback ReceitaWS */}
                {receitaError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{receitaError}</span>
                  </div>
                )}

                {receitaSuccessMessage && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{receitaSuccessMessage}</span>
                  </div>
                )}

                {/* Card de Dados Oficiais da ReceitaWS */}
                {receitaData && (
                  <div className="mt-2 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2">
                      <span className="font-bold text-purple-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-400" />
                        {receitaData.tipo || 'MATRIZ'} • {receitaData.porte || 'EMPRESA'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          receitaData.situacao === 'ATIVA'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        Situação: {receitaData.situacao || 'ATIVA'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-400">Natureza Jurídica:</span>{' '}
                        <strong className="text-slate-200">{receitaData.natureza_juridica || 'Sociedade'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Abertura:</span>{' '}
                        <strong className="text-slate-200">{receitaData.abertura || 'N/D'}</strong>
                      </div>
                      {receitaData.atividade_principal && receitaData.atividade_principal[0] && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-400">Atividade Principal (CNAE):</span>{' '}
                          <span className="text-purple-300 font-mono">
                            {receitaData.atividade_principal[0].code} - {receitaData.atividade_principal[0].text}
                          </span>
                        </div>
                      )}
                      {receitaData.simples && (
                        <div>
                          <span className="text-slate-400">Simples Nacional:</span>{' '}
                          <strong className={receitaData.simples.optante ? 'text-emerald-300' : 'text-slate-400'}>
                            {receitaData.simples.optante ? 'Optante' : 'Não optante'}
                          </strong>
                        </div>
                      )}
                      {receitaData.capital_social && (
                        <div>
                          <span className="text-slate-400">Capital Social:</span>{' '}
                          <strong className="text-slate-200">
                            R$ {parseFloat(receitaData.capital_social || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    required
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="Ex: CEC São Paulo"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Razão Social Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Desenvolvimento de Software Alimentos Ltda."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Patrocinio"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estado (UF) *
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={stateUF}
                    onChange={(e) => setStateUF(e.target.value.toUpperCase())}
                    placeholder="MG"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs uppercase font-mono text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telefone / WhatsApp Comercial
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(34)99947-2865"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@restaurante.com.br"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Segmento / Ramo de Atuação
                  </label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-purple-400 font-semibold"
                  >
                    <option value="Desenvolvimento de Software">Desenvolvimento de Software</option>
                    <option value="Hamburgueria Artesanal">Hamburgueria Artesanal</option>
                    <option value="Pizzaria & Forneria">Pizzaria & Forneria</option>
                    <option value="Churrascaria & Carnes Nobres">Churrascaria & Carnes Nobres</option>
                    <option value="Cafeteria & Confeitaria">Cafeteria & Confeitaria</option>
                    <option value="Alimentos & Bebidas em Geral">Alimentos & Bebidas em Geral</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <span>Salvar Empresa & Ir para Sincronização do Banco</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* PASSO 2: SINCRONIZAÇÃO DO BANCO DE DADOS RELACIONAL (SGBD) */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-emerald-100">
                      Sincronização com o Banco de Dados Relacional (SGBD)
                    </p>
                    <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                      Conecte e sincronize o banco de dados oficial para provisionar as tabelas estruturais e continuar os registros do sistema com integridade referencial.
                    </p>
                  </div>
                </div>
                {companySaved && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold shrink-0">
                    Tenant: {companySaved.id}
                  </span>
                )}
              </div>

              {/* Seletor de Motor SGBD */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Selecione o Sistema Gerenciador de Banco de Dados (SGBD):
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'postgres', label: 'PostgreSQL', port: 5432, desc: 'Recomendado / Cloud SQL' },
                    { id: 'mysql', label: 'MySQL', port: 3306, desc: 'MySQL 8.0+ / MariaDB' },
                    { id: 'sqlserver', label: 'SQL Server', port: 1433, desc: 'Microsoft SQL 2017+' },
                  ].map((db) => (
                    <button
                      key={db.id}
                      type="button"
                      onClick={() => setEngine(db.id as DatabaseEngine)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        engine === db.id
                          ? 'bg-purple-600/15 border-purple-500 text-purple-200 ring-1 ring-purple-500 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-100">{db.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Porta padrão: {db.port}</div>
                      <div className="text-[10px] text-purple-400 mt-1 font-semibold">{db.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Parâmetros de Conexão */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Host / Servidor
                    </label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="localhost ou IP do servidor"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Porta
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nome do Banco de Dados
                    </label>
                    <input
                      type="text"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      placeholder="restaurante_estoque_db"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Usuário do Banco
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="postgres ou root"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Senha do Banco
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={ssl}
                      onChange={(e) => setSsl(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Habilitar conexão criptografada SSL/TLS</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isConnecting}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isConnecting ? 'Testando Conexão...' : 'Testar Conectividade'}</span>
                  </button>
                </div>

                {/* Feedback do Teste */}
                {connectionStatus === 'success' && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="whitespace-pre-line">{connectionMessage}</span>
                  </div>
                )}
                {connectionStatus === 'error' && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="whitespace-pre-line">{connectionMessage}</span>
                  </div>
                )}
              </div>

              {/* Botão de Ação: Provisionar Tabelas & Sincronizar Registros */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-purple-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Provisionar Tabelas e Sincronizar Registros
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gera e executa as 12 tabelas DDL oficiais com chave tenant CNPJ e sincroniza os cadastros.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleProvisionAndSyncDatabase}
                  disabled={isSyncing}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/30 active:scale-95 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando Banco...' : 'Sincronizar Banco Agora'}</span>
                </button>
              </div>

              {/* Feedback de Sincronização */}
              {syncStatus === 'success' && (
                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-emerald-100">
                      Banco de Dados Sincronizado com Sucesso!
                    </h5>
                    <p className="text-[11px] text-emerald-300/90 mt-0.5">
                      {syncMessage} ({syncedRecordsCount} registros processados). O sistema agora está pronto para continuar todas as operações e relatórios.
                    </p>
                  </div>
                </div>
              )}
              {syncStatus === 'error' && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-rose-100">Aviso na Sincronização</h5>
                    <p className="text-[11px] text-rose-300/90 mt-0.5 whitespace-pre-line">{syncMessage}</p>
                  </div>
                </div>
              )}

              {/* Botões de Ação Final */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline text-left"
                >
                  ← Voltar ao Cadastro da Empresa
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluir Setup e Iniciar Operação</span>
                  </button>
                </div>
              </div>

              {/* Lembrete de Parametrização Sistêmica */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>
                    A opção de alterar os dados de conexão e sincronizar o banco continua sempre disponível no menu <strong>Parametrização Sistêmica</strong> (aba Banco de Dados).
                  </span>
                </span>
                {onOpenParametrizacaoDatabase && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenParametrizacaoDatabase();
                    }}
                    className="text-[10px] text-purple-300 hover:text-purple-200 font-semibold underline shrink-0"
                  >
                    Abrir Parametrização
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
