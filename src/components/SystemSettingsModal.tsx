import React, { useState, useEffect } from 'react';
import {
  Shield,
  Sliders,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingDown,
  UserCheck,
  RotateCcw,
  Save,
  X,
  Clock,
  EyeOff,
  Bell,
  Ban,
  FileCheck2,
  Settings2,
  MessageCircle,
  Smartphone,
  Database,
} from 'lucide-react';
import {
  CountDay,
  OutdatedPricePolicy,
  SystemSettings,
  UserRole,
  canAccessSystemSettings,
  DatabaseConnectionConfig,
  Company,
} from '../types';
import { INITIAL_SYSTEM_SETTINGS } from '../data/initialData';
import { DatabaseLinkSection } from './database/DatabaseLinkSection';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  currentRole: UserRole;
  currentUserName?: string;
  initialTab?: 'precos' | 'contagem' | 'seguranca' | 'financeiro' | 'database';
  activeCompany?: Company;
  onSaveCompany?: (company: Company) => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  currentRole,
  currentUserName = 'Administrador Geral',
  initialTab = 'precos',
  activeCompany,
  onSaveCompany,
}) => {
  const [activeTab, setActiveTab] = useState<'precos' | 'contagem' | 'seguranca' | 'financeiro' | 'database'>(initialTab);

  // Sincroniza a aba ativa quando initialTab mudar ao abrir
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Database configuration state
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConnectionConfig>(
    settings.databaseConfig || INITIAL_SYSTEM_SETTINGS.databaseConfig || {
      engine: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'restaurante_estoque_db',
      username: 'postgres',
      password: '',
      ssl: false,
      status: 'desconectado',
      tablesCreated: false,
    }
  );

  // Form states initialized with current settings
  const [outdatedPricePolicy, setOutdatedPricePolicy] = useState<OutdatedPricePolicy>(
    settings.outdatedPricePolicy || 'alertar'
  );
  const [defaultPriceValidityDays, setDefaultPriceValidityDays] = useState<number>(
    settings.defaultPriceValidityDays || 30
  );
  const [notifyOutdatedPrices, setNotifyOutdatedPrices] = useState<boolean>(
    settings.notifyOutdatedPrices ?? true
  );
  const [blockOrdersBelowMinSupplierValue, setBlockOrdersBelowMinSupplierValue] = useState<boolean>(
    settings.blockOrdersBelowMinSupplierValue ?? false
  );

  // Count schedule states
  const [countDays, setCountDays] = useState<CountDay[]>(
    settings.countSchedule?.defaultDays || ['quarta', 'domingo']
  );
  const [countCutoffTime, setCountCutoffTime] = useState<string>(
    settings.countCutoffTime || '23:59'
  );
  const [requireSupervisorAuthForOffDays, setRequireSupervisorAuthForOffDays] = useState<boolean>(
    settings.requireSupervisorAuthForOffDays ?? true
  );
  const [divergenceTolerancePercent, setDivergenceTolerancePercent] = useState<number>(
    settings.divergenceTolerancePercent || 3.0
  );
  const [blindCountMode, setBlindCountMode] = useState<boolean>(
    settings.blindCountMode ?? false
  );

  // WhatsApp Notification states for count schedule
  const [whatsappNotification, setWhatsappNotification] = useState<boolean>(
    settings.countSchedule?.whatsappNotification ?? false
  );
  const [whatsappPhone, setWhatsappPhone] = useState<string>(
    settings.countSchedule?.whatsappPhone || ''
  );
  const [whatsappReminderTime, setWhatsappReminderTime] = useState<string>(
    settings.countSchedule?.whatsappReminderTime || '08:00'
  );
  const [whatsappCustomMessage, setWhatsappCustomMessage] = useState<string>(
    settings.countSchedule?.whatsappCustomMessage || ''
  );

  // Access & Security states
  const [requireIndividualLogin, setRequireIndividualLogin] = useState<boolean>(
    settings.requireIndividualLogin ?? true
  );
  const [conferenteCanViewPrices, setConferenteCanViewPrices] = useState<boolean>(
    settings.conferenteCanViewPrices ?? false
  );
  const [allowConferenteRegisterUnlisted, setAllowConferenteRegisterUnlisted] = useState<boolean>(
    settings.allowConferenteRegisterUnlisted ?? true
  );
  const [buyerCanRegisterSupplierWithoutCnpj, setBuyerCanRegisterSupplierWithoutCnpj] = useState<boolean>(
    settings.buyerCanRegisterSupplierWithoutCnpj ?? false
  );

  // Financial states
  const [targetCmvPercent, setTargetCmvPercent] = useState<number>(
    settings.targetCmvPercent || 28.5
  );
  const [criticalAlertThreshold, setCriticalAlertThreshold] = useState<number>(
    settings.criticalAlertThreshold || 1.0
  );

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state whenever settings prop updates or modal opens
  useEffect(() => {
    if (isOpen) {
      setOutdatedPricePolicy(settings.outdatedPricePolicy || 'alertar');
      setDefaultPriceValidityDays(settings.defaultPriceValidityDays || 30);
      setNotifyOutdatedPrices(settings.notifyOutdatedPrices ?? true);
      setBlockOrdersBelowMinSupplierValue(settings.blockOrdersBelowMinSupplierValue ?? false);

      setCountDays(settings.countSchedule?.defaultDays || ['quarta', 'domingo']);
      setCountCutoffTime(settings.countCutoffTime || '23:59');
      setRequireSupervisorAuthForOffDays(settings.requireSupervisorAuthForOffDays ?? true);
      setDivergenceTolerancePercent(settings.divergenceTolerancePercent || 3.0);
      setBlindCountMode(settings.blindCountMode ?? false);
      setWhatsappNotification(settings.countSchedule?.whatsappNotification ?? false);
      setWhatsappPhone(settings.countSchedule?.whatsappPhone || '');
      setWhatsappReminderTime(settings.countSchedule?.whatsappReminderTime || '08:00');
      setWhatsappCustomMessage(settings.countSchedule?.whatsappCustomMessage || '');

      setRequireIndividualLogin(settings.requireIndividualLogin ?? true);
      setConferenteCanViewPrices(settings.conferenteCanViewPrices ?? false);
      setAllowConferenteRegisterUnlisted(settings.allowConferenteRegisterUnlisted ?? true);
      setBuyerCanRegisterSupplierWithoutCnpj(settings.buyerCanRegisterSupplierWithoutCnpj ?? false);

      setTargetCmvPercent(settings.targetCmvPercent || 28.5);
      setCriticalAlertThreshold(settings.criticalAlertThreshold || 1.0);
      setDatabaseConfig(settings.databaseConfig || INITIAL_SYSTEM_SETTINGS.databaseConfig || {
        engine: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'restaurante_estoque_db',
        username: 'postgres',
        password: '',
        ssl: false,
        status: 'desconectado',
        tablesCreated: false,
      });
      setSaveSuccess(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const isAdministrator = canAccessSystemSettings(currentRole);

  const weekDaysList: { key: CountDay; label: string; short: string }[] = [
    { key: 'domingo', label: 'Domingo', short: 'Dom' },
    { key: 'segunda', label: 'Segunda-feira', short: 'Seg' },
    { key: 'terca', label: 'Terça-feira', short: 'Ter' },
    { key: 'quarta', label: 'Quarta-feira', short: 'Qua' },
    { key: 'quinta', label: 'Quinta-feira', short: 'Qui' },
    { key: 'sexta', label: 'Sexta-feira', short: 'Sex' },
    { key: 'sabado', label: 'Sábado', short: 'Sáb' },
  ];

  const toggleDay = (day: CountDay) => {
    if (countDays.includes(day)) {
      if (countDays.length <= 1) {
        alert('É necessário manter ao menos 1 dia oficial de contagem configurado.');
        return;
      }
      setCountDays(countDays.filter((d) => d !== day));
    } else {
      setCountDays([...countDays, day]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdministrator) {
      alert('Somente o Administrador pode salvar parametrizações sistêmicas.');
      return;
    }

    const updated: SystemSettings = {
      ...settings,
      outdatedPricePolicy,
      defaultPriceValidityDays: Number(defaultPriceValidityDays) || 30,
      notifyOutdatedPrices,
      blockOrdersBelowMinSupplierValue,

      countSchedule: {
        defaultDays: countDays,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserName,
        notes: `Atualizado pelo Administrador em ${new Date().toLocaleDateString('pt-BR')}`,
        whatsappNotification,
        whatsappPhone: whatsappPhone.trim(),
        whatsappReminderTime: whatsappReminderTime || '08:00',
        whatsappCustomMessage: whatsappCustomMessage.trim(),
      },
      countCutoffTime,
      requireSupervisorAuthForOffDays,
      divergenceTolerancePercent: Number(divergenceTolerancePercent) || 3.0,
      blindCountMode,

      requireIndividualLogin,
      conferenteCanViewPrices,
      allowConferenteRegisterUnlisted,
      buyerCanRegisterSupplierWithoutCnpj,

      targetCmvPercent: Number(targetCmvPercent) || 28.5,
      criticalAlertThreshold: Number(criticalAlertThreshold) || 1.0,

      databaseConfig,

      updatedAt: new Date().toISOString(),
      updatedBy: currentUserName,
    };

    onSaveSettings(updated);
    if (activeCompany && onSaveCompany && databaseConfig) {
      onSaveCompany({
        ...activeCompany,
        databaseConfig,
      });
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Deseja realmente restaurar as parametrizações para os padrões recomendados de fábrica?')) {
      setOutdatedPricePolicy(INITIAL_SYSTEM_SETTINGS.outdatedPricePolicy);
      setDefaultPriceValidityDays(INITIAL_SYSTEM_SETTINGS.defaultPriceValidityDays);
      setNotifyOutdatedPrices(INITIAL_SYSTEM_SETTINGS.notifyOutdatedPrices);
      setBlockOrdersBelowMinSupplierValue(INITIAL_SYSTEM_SETTINGS.blockOrdersBelowMinSupplierValue);

      setCountDays(INITIAL_SYSTEM_SETTINGS.countSchedule.defaultDays);
      setCountCutoffTime(INITIAL_SYSTEM_SETTINGS.countCutoffTime);
      setRequireSupervisorAuthForOffDays(INITIAL_SYSTEM_SETTINGS.requireSupervisorAuthForOffDays);
      setDivergenceTolerancePercent(INITIAL_SYSTEM_SETTINGS.divergenceTolerancePercent);
      setBlindCountMode(INITIAL_SYSTEM_SETTINGS.blindCountMode);

      setRequireIndividualLogin(INITIAL_SYSTEM_SETTINGS.requireIndividualLogin);
      setConferenteCanViewPrices(INITIAL_SYSTEM_SETTINGS.conferenteCanViewPrices);
      setAllowConferenteRegisterUnlisted(INITIAL_SYSTEM_SETTINGS.allowConferenteRegisterUnlisted);
      setBuyerCanRegisterSupplierWithoutCnpj(INITIAL_SYSTEM_SETTINGS.buyerCanRegisterSupplierWithoutCnpj);

      setTargetCmvPercent(INITIAL_SYSTEM_SETTINGS.targetCmvPercent);
      setCriticalAlertThreshold(INITIAL_SYSTEM_SETTINGS.criticalAlertThreshold);
      if (INITIAL_SYSTEM_SETTINGS.databaseConfig) {
        setDatabaseConfig(INITIAL_SYSTEM_SETTINGS.databaseConfig);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-purple-950/40 via-slate-900 to-amber-950/20 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Sliders className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
                  Parametrização Sistêmica & Governança
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <Shield className="w-3 h-3" />
                  Exclusivo Administrador
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Defina permissões globais para pedidos com preço desatualizado, calendário de contagens físicas e políticas de acesso.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Barrier if accessed by non-admin */}
        {!isAdministrator ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Acesso Restrito ao Administrador</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Apenas o perfil de <strong>Administrador do Sistema</strong> possui autorização para consultar e alterar as parametrizações de governança, preços desatualizados e regras de contagem física.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Voltar ao Início
            </button>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-1 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('precos')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'precos'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>1. Políticas de Preço & Pedidos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contagem')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'contagem'
                    ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>2. Dias & Regras de Contagem</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('seguranca')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'seguranca'
                    ? 'border-purple-400 text-purple-300 bg-purple-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>3. Acessos Individuais & Segurança</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('financeiro')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'financeiro'
                    ? 'border-blue-400 text-blue-300 bg-blue-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>4. Metas CMV & Indicadores</span>
              </button>

              <button
                type="button"
                id="tab-settings-database"
                onClick={() => setActiveTab('database')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'database'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>5. Vincular Banco de Dados</span>
                {databaseConfig?.tablesCreated ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="Tabelas Criadas com Sucesso" />
                ) : databaseConfig?.status === 'conectado' ? (
                  <span className="w-2 h-2 rounded-full bg-cyan-400" title="Banco Conectado" />
                ) : null}
              </button>
            </div>

            {/* Scrollable Content Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: POLÍTICAS DE PREÇO & PEDIDOS DE COMPRA */}
              {activeTab === 'precos' && (
                <div className="space-y-6 animate-in fade-in">
                  
                  {/* Política de Preço Desatualizado */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <Ban className="w-4 h-4 text-amber-400" />
                          <span>Regra para Pedidos de Produtos com Preço Desatualizado</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Determina o comportamento do sistema quando um comprador tenta emitir ou salvar um pedido para fornecedor cuja tabela de cotação expirou.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      {/* Opção 1: Bloquear */}
                      <label
                        className={`relative p-3.5 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                          outdatedPricePolicy === 'bloquear'
                            ? 'bg-rose-500/15 border-rose-500/60 text-rose-200 shadow-md shadow-rose-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="pricePolicy"
                            value="bloquear"
                            checked={outdatedPricePolicy === 'bloquear'}
                            onChange={() => setOutdatedPricePolicy('bloquear')}
                            className="mt-0.5 text-rose-500 focus:ring-rose-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                              <span>🛑 Bloquear Pedido</span>
                            </span>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              Impede o fechamento e salvamento do pedido até que a cotação com o fornecedor seja renovada.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded w-fit">
                          Rigor Financeiro Máximo
                        </span>
                      </label>

                      {/* Opção 2: Alertar */}
                      <label
                        className={`relative p-3.5 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                          outdatedPricePolicy === 'alertar'
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-md shadow-amber-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="pricePolicy"
                            value="alertar"
                            checked={outdatedPricePolicy === 'alertar'}
                            onChange={() => setOutdatedPricePolicy('alertar')}
                            className="mt-0.5 text-amber-500 focus:ring-amber-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                              <span>⚠️ Alertar Apenas</span>
                            </span>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              Exibe um alerta chamativo informando os dias vencidos, porém autoriza a conclusão do pedido.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded w-fit">
                          Flexibilidade Operacional
                        </span>
                      </label>

                      {/* Opção 3: Exigir Aprovação */}
                      <label
                        className={`relative p-3.5 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                          outdatedPricePolicy === 'exigir_aprovacao'
                            ? 'bg-blue-500/15 border-blue-500/60 text-blue-200 shadow-md shadow-blue-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="pricePolicy"
                            value="exigir_aprovacao"
                            checked={outdatedPricePolicy === 'exigir_aprovacao'}
                            onChange={() => setOutdatedPricePolicy('exigir_aprovacao')}
                            className="mt-0.5 text-blue-500 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                              <span>📋 Exigir Aprovação Gerencial</span>
                            </span>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              Permite gerar o pedido em estado pré-aprovado, exigindo liberação do Gerente ou Administrador.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded w-fit">
                          Governança Compartilhada
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Dias de Validade Padrão das Cotações */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Validade Máxima da Cotação de Preço (Dias)</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Após quantos dias sem atualização a cotação do fornecedor é considerada &quot;preço desatualizado&quot;.
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="number"
                          min="7"
                          max="90"
                          value={defaultPriceValidityDays}
                          onChange={(e) => setDefaultPriceValidityDays(Math.max(7, parseInt(e.target.value) || 30))}
                          className="w-24 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-xs text-slate-400">dias corridos (recomendado: 30 dias)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-200 block">
                            Notificar Comprador de Preços Vencidos
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            Exibir banner informativo em cotações e compras.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifyOutdatedPrices}
                          onChange={(e) => setNotifyOutdatedPrices(e.target.checked)}
                          className="w-4 h-4 text-amber-500 rounded border-slate-700 focus:ring-amber-500"
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-200 block">
                            Bloquear Pedido Abaixo do Pedido Mínimo
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            Impede envio se o total for menor que o valor mínimo exigido pelo fornecedor.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={blockOrdersBelowMinSupplierValue}
                          onChange={(e) => setBlockOrdersBelowMinSupplierValue(e.target.checked)}
                          className="w-4 h-4 text-amber-500 rounded border-slate-700 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DIAS & REGRAS DE CONTAGEM FÍSICA */}
              {activeTab === 'contagem' && (
                <div className="space-y-6 animate-in fade-in">
                  {/* Dias Oficiais de Contagem */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          <span>Dias Oficiais de Contagem de Estoque</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Selecione os dias da semana em que os conferentes realizam a contagem padrão de estoque.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCountDays(['quarta', 'domingo'])}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                        >
                          Qua & Dom (Padrão)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCountDays(['segunda', 'quarta', 'sexta'])}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750"
                        >
                          Seg, Qua & Sex
                        </button>
                      </div>
                    </div>

                    {/* Weekday selector grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
                      {weekDaysList.map((day) => {
                        const isSelected = countDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => toggleDay(day.key)}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 font-bold shadow-md shadow-emerald-500/10'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-xs uppercase tracking-wider">{day.short}</span>
                            <span className="text-[10px] font-normal opacity-80">{day.label}</span>
                            <span
                              className={`w-2 h-2 rounded-full mt-0.5 ${
                                isSelected ? 'bg-emerald-400 ring-2 ring-emerald-500/40' : 'bg-slate-700'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horário de Corte e Tolerância */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span>Horário Limite de Fechamento da Contagem</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Horário de corte para envio da contagem do dia (evita registros retroativos sem justificativa).
                      </p>
                      <input
                        type="time"
                        value={countCutoffTime}
                        onChange={(e) => setCountCutoffTime(e.target.value)}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        <span>Tolerância de Divergência Físico x Sistema (%)</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Variação percentual aceitável antes de exigir justificativa obrigatória do conferente.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="20"
                          value={divergenceTolerancePercent}
                          onChange={(e) => setDivergenceTolerancePercent(parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono font-bold text-center focus:outline-none focus:border-emerald-400"
                        />
                        <span className="text-xs text-slate-400">% de margem (padrão: 3.0%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Restrições de Contagem */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block">
                          Exigir Liberação do Superior em Dias Não Oficiais
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Conferente precisa de token/autorização do Gerente ou Administrador para iniciar contagem fora dos dias padrão.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={requireSupervisorAuthForOffDays}
                        onChange={(e) => setRequireSupervisorAuthForOffDays(e.target.checked)}
                        className="w-4 h-4 text-emerald-500 rounded border-slate-700 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-purple-400" />
                          <span>Modo de Contagem Cega (&quot;Blind Count&quot;)</span>
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Oculta o saldo teórico do sistema para o conferente, forçando a conferência real sem vícios de expectativa.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={blindCountMode}
                        onChange={(e) => setBlindCountMode(e.target.checked)}
                        className="w-4 h-4 text-purple-500 rounded border-slate-700 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Notificação via WhatsApp para Equipe de Contagem */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-900/40 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              Lembretes Automáticos via WhatsApp
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              whatsappNotification
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {whatsappNotification ? 'Ativado' : 'Desativado'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Permite enviar lembretes programados de contagem de estoque para a equipe e conferentes nos dias oficiais.
                          </p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={whatsappNotification}
                          onChange={(e) => setWhatsappNotification(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {whatsappNotification && (
                      <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Telefone ou Grupo da Equipe:</span>
                          </label>
                          <input
                            type="text"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            placeholder="Ex: (31) 98888-2222 ou Grupo Estoque"
                            className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Horário do Disparo do Lembrete:</span>
                          </label>
                          <input
                            type="time"
                            value={whatsappReminderTime}
                            onChange={(e) => setWhatsappReminderTime(e.target.value)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-400 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ACESSOS INDIVIDUAIS & SEGURANÇA */}
              {activeTab === 'seguranca' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-purple-400" />
                          <span>Exigir Login Individual Autenticado</span>
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Ativa a tela de login inicial com identificação por e-mail e senha/PIN individual de cada colaborador.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={requireIndividualLogin}
                        onChange={(e) => setRequireIndividualLogin(e.target.checked)}
                        className="w-4 h-4 text-purple-500 rounded border-slate-700 focus:ring-purple-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block">
                          Conferente Pode Visualizar Preços dos Itens
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Quando desativado, o conferente enxerga apenas quantidades físicas e lotes/validades.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={conferenteCanViewPrices}
                        onChange={(e) => setConferenteCanViewPrices(e.target.checked)}
                        className="w-4 h-4 text-purple-500 rounded border-slate-700 focus:ring-purple-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block">
                          Permitir ao Conferente Anotar Produtos Fora da Lista (Avulsos)
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Habilita o modal de anotação de itens encontrados fisicamente para posterior aprovação por Compras/Gerente.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowConferenteRegisterUnlisted}
                        onChange={(e) => setAllowConferenteRegisterUnlisted(e.target.checked)}
                        className="w-4 h-4 text-purple-500 rounded border-slate-700 focus:ring-purple-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block">
                          Permitir ao Comprador Cadastrar Fornecedor sem CNPJ
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Permite cadastros emergenciais (ex: feiras locais, pequenos produtores rurais com CPF).
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={buyerCanRegisterSupplierWithoutCnpj}
                        onChange={(e) => setBuyerCanRegisterSupplierWithoutCnpj(e.target.checked)}
                        className="w-4 h-4 text-purple-500 rounded border-slate-700 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: METAS CMV & INDICADORES FINANCEIROS */}
              {activeTab === 'financeiro' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-blue-400" />
                        <span>Meta Global de CMV do Restaurante / Bar (%)</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Custo de Mercadoria Vendida alvo para cálculo de performance nos dashboards executivos.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="15"
                          max="50"
                          value={targetCmvPercent}
                          onChange={(e) => setTargetCmvPercent(parseFloat(e.target.value) || 28.5)}
                          className="w-24 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400"
                        />
                        <span className="text-xs text-slate-400">% (médias de mercado: 28% a 32%)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Limiar de Alerta Crítico de Ruptura de Estoque</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Multiplicador sobre o estoque mínimo para disparo de alertas vermelhos no header e dashboards.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="2.0"
                          value={criticalAlertThreshold}
                          onChange={(e) => setCriticalAlertThreshold(parseFloat(e.target.value) || 1.0)}
                          className="w-24 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono font-bold text-center focus:outline-none focus:border-rose-400"
                        />
                        <span className="text-xs text-slate-400">x estoque mínimo</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: VINCULAR BANCO DE DADOS (MYSQL, POSTGRES, SQL SERVER) & CRIAR TABELAS */}
              {activeTab === 'database' && (
                <DatabaseLinkSection
                  initialConfig={activeCompany?.databaseConfig || databaseConfig}
                  onUpdateConfig={(cfg) => {
                    setDatabaseConfig(cfg);
                    if (activeCompany && onSaveCompany) {
                      onSaveCompany({
                        ...activeCompany,
                        databaseConfig: cfg,
                      });
                    }
                  }}
                  tenantId={activeCompany?.id}
                  companyName={activeCompany?.tradeName || activeCompany?.name}
                  companyCnpj={activeCompany?.cnpj}
                />
              )}

              {/* Audit timestamp footer inside form */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Última parametrização por: <strong className="text-slate-400">{settings.updatedBy || 'Administrador Geral'}</strong>
                </span>
                <span>
                  Data: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('pt-BR') : 'Padrão Inicial'}
                </span>
              </div>
            </form>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
                title="Restaurar valores de fábrica"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrões Recomendados</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>Salvo com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Parametrizações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
