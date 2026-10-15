import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Send,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Tag,
  MapPin,
  FileCheck,
  Shield,
  Lock,
  FileQuestion,
} from 'lucide-react';
import {
  CountDay,
  ItemCategory,
  StockItem,
  StockUnit,
  SupervisorAuthorization,
  UserRole,
  canChangeCountSchedule,
} from '../types';
import {
  checkExpiryStatus,
  formatDateBR,
  formatQuantity,
  getCategoryLabel,
  getStockHealth,
} from '../utils/formatters';

interface EmployeeCountViewProps {
  items: StockItem[];
  onFinishCount: (
    counts: Record<string, { count: number; expiry: string; obs: string }>,
    conferenteName: string,
    supervisorAuth?: SupervisorAuthorization
  ) => void;
  lastSessionDate?: string;
  conferenteName: string;
  currentRole: UserRole;
  defaultCountDays: CountDay[];
  supervisorAuthorization: SupervisorAuthorization | null;
  onRequestSupervisorRelease: () => void;
  onOpenScheduleModal: () => void;
  onOpenRecordUnlisted?: () => void;
}

export const EmployeeCountView: React.FC<EmployeeCountViewProps> = ({
  items,
  onFinishCount,
  lastSessionDate,
  conferenteName: initialConferente,
  currentRole,
  defaultCountDays,
  supervisorAuthorization,
  onRequestSupervisorRelease,
  onOpenScheduleModal,
  onOpenRecordUnlisted,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyScheduledForToday, setOnlyScheduledForToday] = useState(false);
  const [conferenteInput, setConferenteInput] = useState(initialConferente || 'Lucas Santos (Conferente)');

  // Local counting state: itemId -> { count, expiry, obs }
  const [counts, setCounts] = useState<
    Record<string, { count: number; expiry: string; obs: string; touched: boolean }>
  >(() => {
    const initial: Record<string, { count: number; expiry: string; obs: string; touched: boolean }> = {};
    items.forEach((item) => {
      initial[item.id] = {
        count: item.currentStock,
        expiry: item.currentBatchExpiry || '',
        obs: '',
        touched: false,
      };
    });
    return initial;
  });

  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Today check using dynamic schedule
  const today = new Date();
  const dayIndex = today.getDay();
  const dayNamesMap: Record<number, CountDay> = {
    0: 'domingo',
    1: 'segunda',
    2: 'terca',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sabado',
  };
  const dayLabelsMap: Record<CountDay, string> = {
    domingo: 'Domingo',
    segunda: 'Segunda-feira',
    terca: 'Terça-feira',
    quarta: 'Quarta-feira',
    quinta: 'Quinta-feira',
    sexta: 'Sexta-feira',
    sabado: 'Sábado',
  };
  const currentDayKey = dayNamesMap[dayIndex];
  const currentDayLabel = dayLabelsMap[currentDayKey];

  // Dynamic scheduled count day check
  const isCountDay = defaultCountDays.includes(currentDayKey);
  const isConferente = currentRole === 'conferente';
  const isSupervisorRole = currentRole === 'administrador' || currentRole === 'gerente';
  const requiresSupervisorRelease = !isCountDay && isConferente;
  const isAuthorized = !requiresSupervisorRelease || !!supervisorAuthorization?.isAuthorized;

  // Formatted default days label
  const formattedDefaultDays = defaultCountDays
    .map((d) => dayLabelsMap[d])
    .join(' e ');

  // Filter items
  const filteredItems = items.filter((item) => {
    // Category filter
    if (selectedCategory !== 'todos' && item.category !== selectedCategory) {
      return false;
    }
    // Scheduled for today filter
    if (onlyScheduledForToday && !item.countDays.includes(currentDayKey)) {
      return false;
    }
    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCode = item.code.toLowerCase().includes(q);
      const matchLoc = item.location?.toLowerCase().includes(q) || false;
      return matchName || matchCode || matchLoc;
    }
    return true;
  });

  const handleCountChange = (itemId: string, val: number) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        count: Math.max(0, Number(val)),
        touched: true,
      },
    }));
  };

  const handleExpiryChange = (itemId: string, expiryVal: string) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        expiry: expiryVal,
        touched: true,
      },
    }));
  };

  const handleObsChange = (itemId: string, obsVal: string) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        obs: obsVal,
        touched: true,
      },
    }));
  };

  // Calculate stats for current count session
  const touchedCount = Object.values(counts).filter((c) => c.touched).length;
  const divergentCount = items.filter((item) => {
    const entry = counts[item.id];
    return entry && entry.touched && entry.count !== item.currentStock;
  }).length;

  const criticalItemsIdentified = items.filter((item) => {
    const entry = counts[item.id];
    const val = entry ? entry.count : item.currentStock;
    return val <= item.minStock;
  }).length;

  const handleConfirmSubmit = () => {
    onFinishCount(counts, conferenteInput, supervisorAuthorization || undefined);
    setIsFinalizeModalOpen(false);
    setSubmittedSuccess(true);
    setTimeout(() => {
      setSubmittedSuccess(false);
    }, 6000);
  };

  const handleOpenFinalize = () => {
    if (requiresSupervisorRelease && !supervisorAuthorization?.isAuthorized) {
      onRequestSupervisorRelease();
      return;
    }
    setIsFinalizeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {submittedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between shadow-lg shadow-emerald-500/10">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-emerald-200">Contagem de Estoque Finalizada & Enviada com Sucesso!</h4>
              <p className="text-xs text-emerald-300/80">
                Os dados foram atualizados no sistema. Alertas de reposição foram disparados para o setor de Compras.
                {supervisorAuthorization?.isAuthorized && (
                  <span className="block mt-0.5 text-amber-300 font-semibold">
                    ✓ Registrada autorização de {supervisorAuthorization.authorizedBy} para esta contagem extraordinária.
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSubmittedSuccess(false)}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200"
          >
            Fechar
          </button>
        </div>
      )}

      {/* UNSCHEDULED COUNT DAY ALERT: For Conferente needing release */}
      {!isCountDay && isConferente && !supervisorAuthorization?.isAuthorized && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-100">
                  Dia Fora do Cronograma Padrão: {currentDayLabel}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-rose-500/30 text-rose-300 border border-rose-500/40">
                  Liberação Obrigatória
                </span>
              </div>
              <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                Os dias oficiais de conferência são <strong>{formattedDefaultDays}</strong>. O conferente pode efetuar a contagem hoje, porém é necessária a <strong>Liberação de Conferência de Superior (Gerente ou ADM)</strong> com registro de justificativa.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-request-supervisor-release"
            onClick={onRequestSupervisorRelease}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95 shrink-0 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>Liberar com Superior (ADM / Gerente)</span>
          </button>
        </div>
      )}

      {/* UNSCHEDULED COUNT DAY: Authorized state */}
      {!isCountDay && isConferente && supervisorAuthorization?.isAuthorized && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-emerald-100 block">
                Conferência Extraordinária Liberada por {supervisorAuthorization.authorizedBy}
              </span>
              <span className="text-emerald-300/80 block mt-0.5">
                Motivo: {supervisorAuthorization.reason} • Autorizada às{' '}
                {new Date(supervisorAuthorization.authorizedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestSupervisorRelease}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 transition-all self-start sm:self-auto"
          >
            Ver / Alterar Liberação
          </button>
        </div>
      )}

      {/* UNSCHEDULED COUNT DAY: Info for Gerente or Administrador */}
      {!isCountDay && isSupervisorRole && (
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Hoje é <strong>{currentDayLabel}</strong> (dias padrão configurados: <strong>{formattedDefaultDays}</strong>). Como você é{' '}
              <strong className="text-amber-400 capitalize">{currentRole}</strong>, a contagem e alterações estão liberadas.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-semibold text-xs transition-all whitespace-nowrap self-start sm:self-auto"
          >
            Alterar Dias Padrão
          </button>
        </div>
      )}

      {/* Routine Count Header Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Caminho do Funcionário / Conferente
              </span>
              {isCountDay ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Hoje é dia oficial ({formattedDefaultDays})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Dia fora da rotina ({currentDayLabel})
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-100 mt-2">
              Contagem Física & Validade de Lotes
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Realize a conferência dos itens porcionados, petiscos e insumos de consumo. Informe a quantidade real encontrada e insira a data de validade dos produtos no freezer ou câmara.
            </p>
          </div>

          {/* Quick Stats, Schedule & Finalize Button */}
          <div className="flex flex-wrap items-center gap-3">
            {canChangeCountSchedule(currentRole) && (
              <button
                type="button"
                id="btn-edit-count-schedule"
                onClick={onOpenScheduleModal}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 transition-all flex items-center gap-1.5"
                title="Gerente e Administrador podem alterar os dias padrão de contagem"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Configurar Dias ({defaultCountDays.length})</span>
              </button>
            )}

            {onOpenRecordUnlisted && (
              <button
                type="button"
                id="btn-record-unlisted-item"
                onClick={onOpenRecordUnlisted}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                title="Anotar produto encontrado fisicamente que não está pré-cadastrado no sistema"
              >
                <FileQuestion className="w-3.5 h-3.5 text-amber-400" />
                <span>Anotar Fora da Lista</span>
              </button>
            )}

            <div className="bg-slate-950/70 px-3.5 py-2 rounded-xl border border-slate-800 text-right">
              <span className="text-[11px] text-slate-400 block font-medium">Itens conferidos</span>
              <span className="text-sm font-bold text-amber-400">
                {touchedCount} <span className="text-slate-500 font-normal">/ {items.length}</span>
              </span>
            </div>

            <button
              id="btn-finalize-stock-count"
              onClick={handleOpenFinalize}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 ${
                requiresSupervisorRelease && !supervisorAuthorization?.isAuthorized
                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-600/25'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-600/25'
              }`}
            >
              {requiresSupervisorRelease && !supervisorAuthorization?.isAuthorized ? (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Liberar com Superior & Enviar</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Finalização de Estoque & Enviar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters and Tabs Bar */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'todos', label: 'Todos os Itens' },
              { id: 'porcionamento', label: 'Porcionamentos' },
              { id: 'petisco', label: 'Porções & Petiscos' },
              { id: 'consumo', label: 'Itens de Consumo' },
            ].map((tab) => (
              <button
                key={tab.id}
                id={`cat-tab-${tab.id}`}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search and Day Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="search-count-items"
                type="text"
                placeholder="Buscar por nome, código ou local..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => setOnlyScheduledForToday(!onlyScheduledForToday)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                onlyScheduledForToday
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Filtrar apenas itens agendados para a rotina de hoje"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dia de Contagem</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items List Table / Cards */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-850/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Itens para Conferência ({filteredItems.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Última contagem registrada:{' '}
            <strong className="text-slate-300">{formatDateBR(lastSessionDate || '2026-09-17')}</strong>
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {filteredItems.map((item) => {
            const entry = counts[item.id] || {
              count: item.currentStock,
              expiry: item.currentBatchExpiry || '',
              obs: '',
              touched: false,
            };

            const health = getStockHealth({ ...item, currentStock: entry.count });
            const expiryStatus = checkExpiryStatus(entry.expiry);
            const hasDivergence = entry.touched && entry.count !== item.currentStock;

            return (
              <div
                key={item.id}
                id={`item-row-${item.id}`}
                className={`p-4 transition-all ${
                  entry.touched ? 'bg-slate-850/40' : 'hover:bg-slate-850/20'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Item Description */}
                  <div className="lg:col-span-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-400/90 font-semibold">
                        {item.code}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 mt-1">
                      {item.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      {item.location && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.location}
                        </span>
                      )}
                      <span>
                        Estoque anterior:{' '}
                        <strong className="text-slate-300">{formatQuantity(item.currentStock, item.unit)}</strong>
                      </span>
                      <span>
                        Mínimo:{' '}
                        <strong className="text-slate-300">{formatQuantity(item.minStock, item.unit)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Quantity Counting Controls */}
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                      Quantidade Contada ({item.unit})
                    </label>
                    <div className="flex items-center gap-2">
                      {/* Quick Stepper Minus */}
                      <button
                        type="button"
                        onClick={() => handleCountChange(item.id, Math.max(0, entry.count - (item.unit === 'kg' || item.unit === 'l' ? 0.5 : 1)))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center border border-slate-700 text-sm active:scale-95"
                      >
                        -
                      </button>

                      <div className="relative flex-1">
                        <input
                          id={`input-count-${item.id}`}
                          type="number"
                          step={item.unit === 'kg' || item.unit === 'l' ? '0.1' : '1'}
                          min="0"
                          value={entry.count}
                          onChange={(e) => handleCountChange(item.id, parseFloat(e.target.value) || 0)}
                          className={`w-full py-1.5 px-3 rounded-lg text-sm font-bold text-center bg-slate-950 border ${
                            hasDivergence
                              ? 'border-amber-500 text-amber-300'
                              : 'border-slate-700 text-white'
                          } focus:outline-none focus:border-amber-400`}
                        />
                      </div>

                      {/* Quick Stepper Plus */}
                      <button
                        type="button"
                        onClick={() => handleCountChange(item.id, entry.count + (item.unit === 'kg' || item.unit === 'l' ? 0.5 : 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center border border-slate-700 text-sm active:scale-95"
                      >
                        +
                      </button>

                      <span className="text-xs font-semibold text-slate-400 w-7 text-left">
                        {item.unit}
                      </span>
                    </div>

                    {/* Stock Status Badge */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${health.badgeClass}`}>
                        {health.label}
                      </span>
                      {hasDivergence && (
                        <span className="text-[11px] text-amber-400/90 font-medium">
                          (Divergência: {entry.count > item.currentStock ? '+' : ''}
                          {(entry.count - item.currentStock).toFixed(1)} {item.unit})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expiration Date Input */}
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Data de Validade do Lote
                    </label>
                    <input
                      id={`input-expiry-${item.id}`}
                      type="date"
                      value={entry.expiry}
                      onChange={(e) => handleExpiryChange(item.id, e.target.value)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                    <div className="mt-1.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded ${expiryStatus.badgeClass}`}>
                        {expiryStatus.label}
                      </span>
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                      Observação
                    </label>
                    <input
                      id={`input-obs-${item.id}`}
                      type="text"
                      placeholder="Ex: Embalagem violada, gelo..."
                      value={entry.obs}
                      onChange={(e) => handleObsChange(item.id, e.target.value)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Floating Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>{touchedCount}</strong> itens modificados nesta sessão. Todos os valores não editados mantêm o estoque anterior.
            </span>
          </div>

          <button
            onClick={handleOpenFinalize}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 ${
              requiresSupervisorRelease && !supervisorAuthorization?.isAuthorized
                ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-600/20'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
            }`}
          >
            {requiresSupervisorRelease && !supervisorAuthorization?.isAuthorized ? (
              <>
                <Shield className="w-4 h-4" />
                <span>Liberar com Superior & Enviar...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Finalização de Estoque & Enviar...</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL: Finalização de Estoque & Envio */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Finalização de Estoque</h3>
                  <p className="text-xs text-slate-400">
                    Confirme os dados antes de enviar para a Gerência e Compras
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block">Total de Itens</span>
                  <span className="text-base font-bold text-slate-100">{items.length}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block">Divergências</span>
                  <span className="text-base font-bold text-amber-400">{divergentCount}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block">Itens Críticos</span>
                  <span className="text-base font-bold text-rose-400">{criticalItemsIdentified}</span>
                </div>
              </div>

              {/* Unscheduled day supervisor approval display */}
              {!isCountDay && supervisorAuthorization?.isAuthorized && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Conferência Extraordinária Liberada</span>
                  </div>
                  <p className="mt-1 text-slate-300 text-[11px] leading-relaxed">
                    Autorizada por: <strong>{supervisorAuthorization.authorizedBy}</strong> ({supervisorAuthorization.authorizedRole === 'administrador' ? 'Administrador' : 'Gerente'})<br />
                    Motivo: <em>{supervisorAuthorization.reason}</em>
                  </p>
                </div>
              )}

              {/* Responsible user */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Conferente / Responsável
                </label>
                <input
                  type="text"
                  value={conferenteInput}
                  onChange={(e) => setConferenteInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: Lucas Santos (Conferente)"
                />
              </div>

              {/* Notice */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                <strong>O que acontece ao clicar em Enviar:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-300">
                  <li>O estoque oficial do sistema será atualizado com as contagens.</li>
                  <li>As datas de validade serão registradas para monitoramento de vencimento.</li>
                  <li>O setor de Compras receberá os alertas dos itens com necessidade de reposição imediata.</li>
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                Voltar à Conferência
              </button>
              <button
                id="btn-confirm-send-count"
                type="button"
                onClick={handleConfirmSubmit}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar e Enviar Estoque</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
