import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  PlusCircle,
  TrendingDown,
  ShoppingCart,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Edit3,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Info,
  Check,
  Star,
  ExternalLink,
} from 'lucide-react';
import { StockItem, Supplier, UserRole, ItemCategory } from '../types';
import {
  formatCurrency,
  formatQuantity,
  formatDateBR,
  getStockHealth,
  getCategoryLabel,
} from '../utils/formatters';

export interface GeneralStockViewProps {
  items: StockItem[];
  suppliers: Supplier[];
  companyName: string;
  currentRole: UserRole;
  onUpdateItemStock?: (itemId: string, newStock: number, reason: string) => void;
  onOpenNewItemModal?: () => void;
  onOpenLossModal?: (preselectedItemId?: string) => void;
  onOpenSuppliersModal?: () => void;
  onNavigateToCompras?: (preselectedItemId?: string) => void;
}

export const GeneralStockView: React.FC<GeneralStockViewProps> = ({
  items,
  suppliers,
  companyName,
  currentRole,
  onUpdateItemStock,
  onOpenNewItemModal,
  onOpenLossModal,
  onOpenSuppliersModal,
  onNavigateToCompras,
}) => {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('todos');
  const [selectedLocation, setSelectedLocation] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'menor_estoque' | 'maior_valor' | 'nome' | 'validade'>('menor_estoque');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Quick Stock Adjustment Modal State
  const [adjustingItem, setAdjustingItem] = useState<StockItem | null>(null);
  const [adjustedStock, setAdjustedStock] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Inventário físico extraordinário');
  const [customReason, setCustomReason] = useState<string>('');

  // Print/Report View Modal State
  const [showPrintReport, setShowPrintReport] = useState(false);

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Extract unique locations
  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    items.forEach((it) => {
      if (it.location) locs.add(it.location);
    });
    return Array.from(locs).sort();
  }, [items]);

  // Financial and Operational KPIs
  const metrics = useMemo(() => {
    let totalValue = 0;
    let criticalCount = 0;
    let attentionCount = 0;
    let healthyCount = 0;
    let zeroCount = 0;
    let expiringSoonCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    items.forEach((item) => {
      const val = item.currentStock * item.costPrice;
      totalValue += val;

      if (item.currentStock <= 0) {
        zeroCount++;
        criticalCount++;
      } else if (item.currentStock <= item.minStock) {
        criticalCount++;
      } else if (item.currentStock <= (item.reorderPoint || item.minStock * 1.3)) {
        attentionCount++;
      } else {
        healthyCount++;
      }

      if (item.currentBatchExpiry) {
        const exp = new Date(item.currentBatchExpiry);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 15) {
          expiringSoonCount++;
        }
      }
    });

    return {
      totalValue,
      totalItems: items.length,
      criticalCount,
      attentionCount,
      healthyCount,
      zeroCount,
      expiringSoonCount,
    };
  }, [items]);

  // Helper to find all suppliers linked to an item (both primary and alternative/suppliedProductIds)
  const getSuppliersForItem = (item: StockItem) => {
    const primary = suppliers.find((s) => s.id === item.primarySupplierId);
    
    // Find other suppliers that either have this item in alternativeSuppliers OR in suppliedProductIds
    const alternatives = suppliers.filter((s) => {
      if (s.id === item.primarySupplierId) return false;
      const inProductIds = s.suppliedProductIds?.includes(item.id);
      const inAlternativeQuotes = item.alternativeSuppliers?.some((q) => q.supplierId === s.id);
      return inProductIds || inAlternativeQuotes;
    });

    return { primary, alternatives };
  };

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return items
      .filter((item) => {
        // Search term
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const matchName = item.name.toLowerCase().includes(query);
          const matchCode = item.code.toLowerCase().includes(query);
          const matchLocation = item.location?.toLowerCase().includes(query) || false;
          const matchBatch = item.currentBatchExpiry?.toLowerCase().includes(query) || false;
          if (!matchName && !matchCode && !matchLocation && !matchBatch) return false;
        }

        // Category
        if (selectedCategory !== 'todos' && item.category !== selectedCategory) {
          return false;
        }

        // Supplier filter (Check primary OR any linked supplier)
        if (selectedSupplierId !== 'todos') {
          const { primary, alternatives } = getSuppliersForItem(item);
          const isPrimary = primary?.id === selectedSupplierId;
          const isAlternative = alternatives.some((s) => s.id === selectedSupplierId);
          if (!isPrimary && !isAlternative) return false;
        }

        // Location filter
        if (selectedLocation !== 'todos' && item.location !== selectedLocation) {
          return false;
        }

        // Status filter
        if (selectedStatus !== 'todos') {
          const health = getStockHealth(item);
          if (selectedStatus === 'critico' && health.status !== 'critico') return false;
          if (selectedStatus === 'atencao' && health.status !== 'atencao') return false;
          if (selectedStatus === 'seguro' && health.status !== 'seguro') return false;
          if (selectedStatus === 'zerado' && item.currentStock > 0) return false;
          if (selectedStatus === 'vencendo') {
            if (!item.currentBatchExpiry) return false;
            const exp = new Date(item.currentBatchExpiry);
            const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0 || diffDays > 15) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'menor_estoque') {
          // Ratio of stock to minStock (smaller ratio first = most critical)
          const ratioA = a.minStock > 0 ? a.currentStock / a.minStock : a.currentStock;
          const ratioB = b.minStock > 0 ? b.currentStock / b.minStock : b.currentStock;
          return ratioA - ratioB;
        }
        if (sortBy === 'maior_valor') {
          return b.currentStock * b.costPrice - a.currentStock * a.costPrice;
        }
        if (sortBy === 'nome') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'validade') {
          if (!a.currentBatchExpiry) return 1;
          if (!b.currentBatchExpiry) return -1;
          return new Date(a.currentBatchExpiry).getTime() - new Date(b.currentBatchExpiry).getTime();
        }
        return 0;
      });
  }, [items, searchTerm, selectedCategory, selectedSupplierId, selectedLocation, selectedStatus, sortBy, suppliers]);

  // Open Quick Stock Adjustment Modal
  const handleOpenAdjustment = (item: StockItem) => {
    setAdjustingItem(item);
    setAdjustedStock(item.currentStock);
    setAdjustmentReason('Inventário físico extraordinário');
    setCustomReason('');
  };

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || !onUpdateItemStock) return;

    const finalReason =
      adjustmentReason === 'Outro' && customReason.trim()
        ? customReason.trim()
        : adjustmentReason;

    onUpdateItemStock(adjustingItem.id, adjustedStock, finalReason);
    showToast(`Estoque de "${adjustingItem.name}" atualizado para ${formatQuantity(adjustedStock, adjustingItem.unit)}.`);
    setAdjustingItem(null);
  };

  const canEditStock = currentRole === 'administrador' || currentRole === 'gerente';

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                    Estoque Geral
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    {companyName}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Visão consolidada de saldos operacionais, capital imobilizado, lotes e fornecedores vinculados
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPrintReport(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-all"
              title="Visualizar e Imprimir Posição de Estoque"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Relatório de Posição</span>
            </button>

            {onOpenSuppliersModal && (
              <button
                onClick={onOpenSuppliersModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 transition-all"
                title="Abrir Gestão de Fornecedores e Vínculo de Produtos"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Fornecedores & Vínculos</span>
              </button>
            )}

            {onOpenNewItemModal && canEditStock && (
              <button
                onClick={onOpenNewItemModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cadastrar Novo Item</span>
              </button>
            )}
          </div>
        </div>

        {/* Financial & Operational KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Capital em Estoque</span>
            <span className="text-base sm:text-lg font-black text-amber-400 block mt-0.5">
              {formatCurrency(metrics.totalValue)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {metrics.totalItems} itens ativos
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Estoque Crítico / Ruptura</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-rose-400">
                {metrics.criticalCount}
              </span>
              {metrics.zeroCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                  {metrics.zeroCount} zerados
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">Abaixo do estoque mínimo</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Ponto de Pedido</span>
            <span className="text-base sm:text-lg font-black text-amber-400 block mt-0.5">
              {metrics.attentionCount}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Atenção para reposição</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Estoque Saudável</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 block mt-0.5">
              {metrics.healthyCount}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Acima do ponto de pedido</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Vencimento em 15d</span>
            <span className={`text-base sm:text-lg font-black block mt-0.5 ${metrics.expiringSoonCount > 0 ? 'text-purple-400' : 'text-slate-300'}`}>
              {metrics.expiringSoonCount}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Lotes com alerta FIFO</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Fornecedores Ativos</span>
            <span className="text-base sm:text-lg font-black text-blue-400 block mt-0.5">
              {suppliers.length}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Parceiros cadastrados</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Views */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome do produto, SKU, lote, ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Supplier Selector Filter */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px]">
              <Truck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 appearance-none font-medium cursor-pointer"
              >
                <option value="todos">Todos os Fornecedores</option>
                {suppliers.map((s) => {
                  const countLinked = items.filter((it) => {
                    const { primary, alternatives } = getSuppliersForItem(it);
                    return primary?.id === s.id || alternatives.some((alt) => alt.id === s.id);
                  }).length;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({countLinked} itens)
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>

            {/* Storage Location Filter */}
            {availableLocations.length > 0 && (
              <div className="relative min-w-[160px]">
                <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 appearance-none font-medium cursor-pointer"
                >
                  <option value="todos">Todos os Locais</option>
                  {availableLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            )}

            {/* Sorting Select */}
            <div className="relative min-w-[160px]">
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 appearance-none font-medium cursor-pointer"
              >
                <option value="menor_estoque">Menor Estoque (Críticos)</option>
                <option value="maior_valor">Maior Valor em Estoque</option>
                <option value="nome">Nome (A-Z)</option>
                <option value="validade">Validade mais próxima</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Modo Tabela Detalhada"
              >
                Tabela
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Modo Cards"
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills & Health Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'todos', label: 'Todas as Categorias' },
              { id: 'porcionamento', label: 'Porcionamentos' },
              { id: 'petisco', label: 'Porções & Petiscos' },
              { id: 'consumo', label: 'Consumo & Embalagens' },
              { id: 'bebida', label: 'Bebidas & Bar' },
              { id: 'limpeza', label: 'Limpeza & Higiene' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5">
            {[
              { id: 'todos', label: 'Todos os Status', color: 'text-slate-300' },
              { id: 'critico', label: '🔴 Críticos', color: 'text-rose-400' },
              { id: 'atencao', label: '🟡 Atenção', color: 'text-amber-400' },
              { id: 'seguro', label: '🟢 Normal', color: 'text-emerald-400' },
              { id: 'zerado', label: '⚪ Zerados', color: 'text-slate-400' },
              { id: 'vencendo', label: '⏳ Vence em 15d', color: 'text-purple-400' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  selectedStatus === st.id
                    ? 'bg-slate-800 border-amber-500 text-slate-100 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count Banner */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Mostrando <strong>{filteredItems.length}</strong> de {items.length} itens no estoque
          {selectedSupplierId !== 'todos' && (
            <span className="text-amber-400 ml-1.5">
              (Fornecedor: {suppliers.find((s) => s.id === selectedSupplierId)?.name})
            </span>
          )}
        </span>

        {filteredItems.length > 0 && (
          <span className="text-slate-400">
            Subtotal imobilizado filtrado:{' '}
            <strong className="text-slate-200 font-mono">
              {formatCurrency(
                filteredItems.reduce((acc, it) => acc + it.currentStock * it.costPrice, 0)
              )}
            </strong>
          </span>
        )}
      </div>

      {/* Items List: Table or Cards */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200">Nenhum item encontrado no estoque</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Tente ajustar os termos de busca ou filtros de fornecedor, categoria ou status.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('todos');
              setSelectedStatus('todos');
              setSelectedSupplierId('todos');
              setSelectedLocation('todos');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-750"
          >
            Limpar todos os filtros
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Código / Item</th>
                  <th className="p-3.5">Categoria & Local</th>
                  <th className="p-3.5">Estoque Atual</th>
                  <th className="p-3.5">Mínimo / Ideal</th>
                  <th className="p-3.5">Custo Unitário</th>
                  <th className="p-3.5">Valor Imobilizado</th>
                  <th className="p-3.5">Fornecedor Principal & Vínculos</th>
                  <th className="p-3.5">Lote / Validade</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredItems.map((item) => {
                  const health = getStockHealth(item);
                  const { primary, alternatives } = getSuppliersForItem(item);
                  const totalValue = item.currentStock * item.costPrice;

                  // Expiry calculation
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  let daysToExpiry: number | null = null;
                  if (item.currentBatchExpiry) {
                    const exp = new Date(item.currentBatchExpiry);
                    daysToExpiry = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  }

                  // Progress percentage relative to optimal stock
                  const maxTarget = item.optimalStock || item.reorderPoint || item.minStock * 2 || 10;
                  const progressPct = Math.min(100, Math.max(0, (item.currentStock / maxTarget) * 100));

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-850/50 transition-colors group"
                    >
                      {/* Name & SKU */}
                      <td className="p-3.5">
                        <span className="font-mono text-[11px] font-bold text-amber-400 block">
                          {item.code}
                        </span>
                        <span className="font-bold text-slate-100 text-sm block">
                          {item.name}
                        </span>
                      </td>

                      {/* Category & Location */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60 inline-block mb-1">
                          {getCategoryLabel(item.category)}
                        </span>
                        {item.location && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {item.location}
                          </span>
                        )}
                      </td>

                      {/* Current Stock with Progress Bar */}
                      <td className="p-3.5 min-w-[140px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-black font-mono text-slate-100">
                            {formatQuantity(item.currentStock, item.unit)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${health.badgeClass}`}
                          >
                            {health.label}
                          </span>
                        </div>
                        {/* Visual stock bar */}
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all ${
                              health.status === 'critico'
                                ? 'bg-rose-500'
                                : health.status === 'atencao'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Min / Optimal */}
                      <td className="p-3.5 font-mono text-xs text-slate-400">
                        <div className="flex flex-col">
                          <span>
                            Mín: <strong className="text-slate-300">{formatQuantity(item.minStock, item.unit)}</strong>
                          </span>
                          {item.optimalStock && (
                            <span className="text-[11px] text-slate-500">
                              Ideal: {formatQuantity(item.optimalStock, item.unit)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit Cost */}
                      <td className="p-3.5 font-mono text-xs text-slate-300">
                        {formatCurrency(item.costPrice)}
                      </td>

                      {/* Total Value */}
                      <td className="p-3.5 font-mono text-xs font-bold text-amber-300">
                        {formatCurrency(totalValue)}
                      </td>

                      {/* Supplier & Links */}
                      <td className="p-3.5 max-w-[220px]">
                        {primary ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-slate-200 font-semibold text-xs">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                              <span className="truncate" title={primary.name}>
                                {primary.name}
                              </span>
                            </div>
                            {alternatives.length > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Truck className="w-2.5 h-2.5 text-blue-400" />
                                <span>+{alternatives.length} outro{alternatives.length > 1 ? 's' : ''} vinculado{alternatives.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            Sem fornecedor principal
                          </span>
                        )}
                      </td>

                      {/* Batch & Expiry */}
                      <td className="p-3.5">
                        {item.currentBatchExpiry ? (
                          <div>
                            <span className="text-xs text-slate-300 block">
                              {formatDateBR(item.currentBatchExpiry)}
                            </span>
                            {daysToExpiry !== null && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 ${
                                  daysToExpiry < 0
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : daysToExpiry <= 15
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                    : 'text-slate-400 border-slate-800'
                                }`}
                              >
                                {daysToExpiry < 0
                                  ? 'Vencido!'
                                  : daysToExpiry === 0
                                  ? 'Vence hoje!'
                                  : `${daysToExpiry} dias restantes`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEditStock && onUpdateItemStock && (
                            <button
                              onClick={() => handleOpenAdjustment(item)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                              title="Ajustar saldo de estoque manualmente"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                          )}

                          {onOpenLossModal && (
                            <button
                              onClick={() => onOpenLossModal(item.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-rose-400 border border-slate-700 transition-all"
                              title="Registrar perda / avaria deste item"
                            >
                              <TrendingDown className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onNavigateToCompras && (
                            <button
                              onClick={() => onNavigateToCompras(item.id)}
                              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 transition-all"
                              title="Enviar para Compras & Reposição"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const health = getStockHealth(item);
            const { primary, alternatives } = getSuppliersForItem(item);
            const totalValue = item.currentStock * item.costPrice;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-amber-400 block">
                        {item.code}
                      </span>
                      <h4 className="font-bold text-slate-100 text-sm group-hover:text-amber-300 transition-colors">
                        {item.name}
                      </h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${health.badgeClass}`}
                    >
                      {health.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60">
                      {getCategoryLabel(item.category)}
                    </span>
                    {item.location && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {item.location}
                      </span>
                    )}
                  </div>

                  {/* Stock Metrics */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Estoque Atual:</span>
                      <span className="text-base font-black font-mono text-slate-100">
                        {formatQuantity(item.currentStock, item.unit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Mínimo: {formatQuantity(item.minStock, item.unit)}</span>
                      <span>Valor: <strong className="text-amber-300">{formatCurrency(totalValue)}</strong></span>
                    </div>
                  </div>

                  {/* Supplier info */}
                  <div className="mt-3 text-xs space-y-1">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-slate-400">Principal:</span>
                      <strong className="text-slate-200 truncate">
                        {primary ? primary.name : 'Não informado'}
                      </strong>
                    </div>
                    {alternatives.length > 0 && (
                      <span className="text-[11px] text-slate-500 block pl-4">
                        +{alternatives.length} outro{alternatives.length > 1 ? 's' : ''} parceiro{alternatives.length > 1 ? 's' : ''} vinculado{alternatives.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    Custo: {formatCurrency(item.costPrice)}/{item.unit}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canEditStock && onUpdateItemStock && (
                      <button
                        onClick={() => handleOpenAdjustment(item)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700"
                        title="Ajustar saldo"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}
                    {onNavigateToCompras && (
                      <button
                        onClick={() => onNavigateToCompras(item.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Repor</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Ajuste de Estoque Físico</h3>
                  <p className="text-xs text-slate-400">Atualização manual com registro de auditoria</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAdjustment} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-mono text-[11px] font-bold text-amber-400 block">
                  {adjustingItem.code}
                </span>
                <span className="text-sm font-bold text-slate-100 block">
                  {adjustingItem.name}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Estoque Atual Registrado: <strong className="text-slate-200">{formatQuantity(adjustingItem.currentStock, adjustingItem.unit)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Novo Saldo Real de Estoque ({adjustingItem.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={adjustedStock}
                  onChange={(e) => setAdjustedStock(Number(e.target.value))}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-base font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-400"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Diferença:{' '}
                  <strong
                    className={
                      adjustedStock - adjustingItem.currentStock > 0
                        ? 'text-emerald-400'
                        : adjustedStock - adjustingItem.currentStock < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }
                  >
                    {adjustedStock - adjustingItem.currentStock > 0 ? '+' : ''}
                    {formatQuantity(adjustedStock - adjustingItem.currentStock, adjustingItem.unit)}
                  </strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo da Divergência / Ajuste *
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 mb-2"
                >
                  <option value="Inventário físico extraordinário">Inventário físico extraordinário</option>
                  <option value="Acerto de contagem e pesagem">Acerto de contagem e pesagem</option>
                  <option value="Ajuste por sobra física constatada">Ajuste por sobra física constatada</option>
                  <option value="Bonificação de fornecedor não lançada">Bonificação de fornecedor não lançada</option>
                  <option value="Consumo interno não faturado">Consumo interno não faturado</option>
                  <option value="Correção de lançamento de entrada NF-e">Correção de lançamento de entrada NF-e</option>
                  <option value="Outro">Outro (especificar)</option>
                </select>

                {adjustmentReason === 'Outro' && (
                  <input
                    type="text"
                    required
                    placeholder="Especifique a justificativa do ajuste..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT/EXPORT REPORT MODAL */}
      {showPrintReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="w-full max-w-4xl bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl p-6 space-y-6 print:bg-white print:text-black print:border-none print:shadow-none">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:border-black">
              <div>
                <h3 className="text-xl font-black text-slate-100 print:text-black">
                  Relatório de Posição de Estoque Geral
                </h3>
                <p className="text-xs text-slate-400 print:text-gray-600">
                  Empresa: <strong>{companyName}</strong> | Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </p>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  onClick={() => setShowPrintReport(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Print KPIs Summary */}
            <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-gray-100 print:border-gray-300">
              <div>
                <span className="text-[11px] text-slate-400 print:text-gray-600 block">Total de SKUs</span>
                <strong className="text-base font-black text-slate-100 print:text-black">{items.length} itens</strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 print:text-gray-600 block">Capital Imobilizado</span>
                <strong className="text-base font-black text-amber-400 print:text-black">{formatCurrency(metrics.totalValue)}</strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 print:text-gray-600 block">Itens Críticos</span>
                <strong className="text-base font-black text-rose-400 print:text-black">{metrics.criticalCount}</strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 print:text-gray-600 block">Fornecedores Vinculados</span>
                <strong className="text-base font-black text-blue-400 print:text-black">{suppliers.length}</strong>
              </div>
            </div>

            {/* Print Table */}
            <div className="overflow-x-auto max-h-[60vh] print:max-h-none">
              <table className="w-full text-left text-xs text-slate-300 print:text-black border-collapse">
                <thead className="bg-slate-950 print:bg-gray-200 text-[10px] uppercase font-bold text-slate-400 print:text-gray-700 border-b border-slate-800 print:border-gray-400">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Item</th>
                    <th className="p-2">Categoria</th>
                    <th className="p-2">Local</th>
                    <th className="p-2 text-right">Estoque</th>
                    <th className="p-2 text-right">Mínimo</th>
                    <th className="p-2 text-right">Custo Un.</th>
                    <th className="p-2 text-right">Total R$</th>
                    <th className="p-2">Fornecedor Principal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                  {items.map((it) => {
                    const sup = suppliers.find((s) => s.id === it.primarySupplierId);
                    return (
                      <tr key={it.id} className="print:border-b print:border-gray-200">
                        <td className="p-2 font-mono text-[11px]">{it.code}</td>
                        <td className="p-2 font-bold">{it.name}</td>
                        <td className="p-2">{getCategoryLabel(it.category)}</td>
                        <td className="p-2">{it.location || '-'}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatQuantity(it.currentStock, it.unit)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {formatQuantity(it.minStock, it.unit)}
                        </td>
                        <td className="p-2 text-right font-mono">{formatCurrency(it.costPrice)}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatCurrency(it.currentStock * it.costPrice)}
                        </td>
                        <td className="p-2">{sup ? sup.name : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
