import React, { useState, useMemo } from 'react';
import {
  Calculator,
  PlusCircle,
  Truck,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  MessageCircle,
  Mail,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Edit2,
  Building2,
  Clock,
  Layers,
  Award,
  AlertCircle,
  RefreshCw,
  Search,
  DollarSign,
  Package,
} from 'lucide-react';
import {
  BudgetItem,
  ItemCategory,
  StockItem,
  StockUnit,
  Supplier,
  SupplierBudgetComparison,
  UserRole,
} from '../types';
import { formatCurrency, formatQuantity, getCategoryLabel, getStockHealth } from '../utils/formatters';

interface BudgetQuotesViewProps {
  items: StockItem[];
  suppliers: Supplier[];
  companyName: string;
  currentRole: UserRole;
  onInitiateOrderFromBudget?: (supplier: Supplier, itemsToOrder: StockItem[], quantities: Record<string, number>) => void;
}

export const BudgetQuotesView: React.FC<BudgetQuotesViewProps> = ({
  items,
  suppliers,
  companyName,
  currentRole,
  onInitiateOrderFromBudget,
}) => {
  // Budget Items State
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() => {
    // Initialize with critical items needing replenishment by default
    const needingRestock = items.filter((it) => {
      const health = getStockHealth(it);
      return health.status === 'critico' || it.currentStock <= it.reorderPoint;
    });

    return needingRestock.map((it) => {
      const health = getStockHealth(it);
      return {
        id: `bud-${it.id}`,
        stockItemId: it.id,
        name: it.name,
        category: it.category,
        quantity: health.neededToOrder > 0 ? health.neededToOrder : it.minStock,
        unit: it.unit,
        targetUnitPrice: it.costPrice,
        notes: `Estoque atual: ${it.currentStock} ${it.unit}`,
      };
    });
  });

  // Modal / Form state for adding custom product to budget
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [selectedExistingStockId, setSelectedExistingStockId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<ItemCategory>('porcionamento');
  const [customQuantity, setCustomQuantity] = useState('10');
  const [customUnit, setCustomUnit] = useState<StockUnit>('kg');
  const [customTargetPrice, setCustomTargetPrice] = useState('25.00');
  const [customNotes, setCustomNotes] = useState('');

  // Pagination state (Requirement: > 10 suppliers -> paginate)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search / filter suppliers
  const [supplierSearch, setSupplierSearch] = useState('');
  const [onlySuppliersWithVariety, setOnlySuppliersWithVariety] = useState(true);

  // Copied quotation feedback
  const [copiedSupplierId, setCopiedSupplierId] = useState<string | null>(null);

  // Quick Action: Add all items needing replenishment
  const handleLoadReplenishmentItems = () => {
    const needingRestock = items.filter((it) => {
      const health = getStockHealth(it);
      return health.status === 'critico' || health.status === 'atencao';
    });

    const newBudgets: BudgetItem[] = needingRestock.map((it) => {
      const health = getStockHealth(it);
      return {
        id: `bud-${it.id}-${Date.now()}`,
        stockItemId: it.id,
        name: it.name,
        category: it.category,
        quantity: health.neededToOrder > 0 ? health.neededToOrder : it.minStock,
        unit: it.unit,
        targetUnitPrice: it.costPrice,
        notes: `Reposição automática (${health.label})`,
      };
    });

    // Merge without duplicates of stockItemId
    const existingIds = new Set(budgetItems.map((b) => b.stockItemId).filter(Boolean));
    const toAdd = newBudgets.filter((b) => !existingIds.has(b.stockItemId));

    setBudgetItems((prev) => [...prev, ...toAdd]);
  };

  // Add Item to Budget Basket
  const handleAddCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedExistingStockId) {
      const stock = items.find((i) => i.id === selectedExistingStockId);
      if (stock) {
        const item: BudgetItem = {
          id: `bud-${stock.id}-${Date.now()}`,
          stockItemId: stock.id,
          name: stock.name,
          category: stock.category,
          quantity: Math.max(0.1, parseFloat(customQuantity) || 1),
          unit: stock.unit,
          targetUnitPrice: parseFloat(customTargetPrice) || stock.costPrice,
          notes: customNotes.trim() || undefined,
        };
        setBudgetItems((prev) => [...prev, item]);
      }
    } else {
      if (!customName.trim()) return;
      const item: BudgetItem = {
        id: `bud-custom-${Date.now()}`,
        name: customName.trim(),
        category: customCategory,
        quantity: Math.max(0.1, parseFloat(customQuantity) || 1),
        unit: customUnit,
        targetUnitPrice: parseFloat(customTargetPrice) || 0,
        notes: customNotes.trim() || 'Novo produto avulso no orçamento',
      };
      setBudgetItems((prev) => [...prev, item]);
    }

    setIsAddCustomOpen(false);
    setSelectedExistingStockId('');
    setCustomName('');
    setCustomQuantity('10');
    setCustomTargetPrice('25.00');
    setCustomNotes('');
  };

  const handleRemoveBudgetItem = (id: string) => {
    setBudgetItems((prev) => prev.filter((b) => b.id !== id));
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    setBudgetItems((prev) =>
      prev.map((b) => (b.id === id ? { ...b, quantity: Math.max(0.1, qty) } : b))
    );
  };

  // Requirement: "AO INICIAR O ORÇAMENTO AGRUPE POR FORNECEDORES QUE TERÁ A MAIOR VARIEDADE DE PRODUTOS POIS ASSIM FICA MAIS FÁCIL FAZER UMA NEGOCIAÇÃO DE PREÇO"
  const supplierComparisons: SupplierBudgetComparison[] = useMemo(() => {
    if (budgetItems.length === 0) return [];

    return suppliers
      .map((supplier) => {
        let varietyCount = 0;
        let totalCost = 0;
        const coveredProducts: Array<{
          name: string;
          quantity: number;
          unit: string;
          estimatedUnitPrice: number;
          subtotal: number;
        }> = [];
        const missingProducts: string[] = [];

        budgetItems.forEach((bItem) => {
          // Check if supplier supplies this item
          let isSupplied = false;
          let unitPrice = bItem.targetUnitPrice;

          if (bItem.stockItemId) {
            const stockItem = items.find((i) => i.id === bItem.stockItemId);
            if (stockItem) {
              if (stockItem.primarySupplierId === supplier.id) {
                isSupplied = true;
                unitPrice = stockItem.costPrice;
              } else {
                const alt = stockItem.alternativeSuppliers?.find(
                  (a) => a.supplierId === supplier.id
                );
                if (alt) {
                  isSupplied = true;
                  unitPrice = alt.unitPrice;
                } else if (
                  supplier.category.toLowerCase().includes(stockItem.category.toLowerCase()) ||
                  supplier.category === 'Geral'
                ) {
                  // Fallback match based on supplier category specialization
                  isSupplied = true;
                  unitPrice = stockItem.costPrice;
                }
              }
            }
          } else {
            // Ad-hoc item: match category if supplier covers it
            if (
              supplier.category === 'Geral' ||
              supplier.category.toLowerCase().includes(bItem.category.toLowerCase())
            ) {
              isSupplied = true;
              unitPrice = bItem.targetUnitPrice;
            }
          }

          if (isSupplied) {
            varietyCount += 1;
            const subtotal = bItem.quantity * unitPrice;
            totalCost += subtotal;
            coveredProducts.push({
              name: bItem.name,
              quantity: bItem.quantity,
              unit: bItem.unit,
              estimatedUnitPrice: unitPrice,
              subtotal,
            });
          } else {
            missingProducts.push(bItem.name);
          }
        });

        const coveragePercentage =
          budgetItems.length > 0 ? (varietyCount / budgetItems.length) * 100 : 0;

        return {
          supplier,
          varietyCount,
          coveragePercentage,
          totalCost,
          coveredProducts,
          missingProducts,
        };
      })
      // Sort by highest variety first (Agrupar/Ordenar pela maior variedade de produtos para negociação)
      .sort((a, b) => {
        if (b.varietyCount !== a.varietyCount) {
          return b.varietyCount - a.varietyCount;
        }
        return a.totalCost - b.totalCost;
      });
  }, [budgetItems, suppliers, items]);

  // Filter comparisons (only suppliers that have items, plus search filter)
  const filteredComparisons = useMemo(() => {
    return supplierComparisons.filter((comp) => {
      if (onlySuppliersWithVariety && comp.varietyCount === 0) return false;
      if (supplierSearch) {
        const term = supplierSearch.toLowerCase();
        return (
          comp.supplier.name.toLowerCase().includes(term) ||
          comp.supplier.category.toLowerCase().includes(term) ||
          comp.supplier.contactName.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [supplierComparisons, onlySuppliersWithVariety, supplierSearch]);

  // Requirement: "SE A QUANTIDADE FOR MAIS QUE 10 FORNECEDORES SEPARE POR PAGINAÇÃO"
  const totalSuppliersCount = filteredComparisons.length;
  const needsPagination = totalSuppliersCount > itemsPerPage;
  const totalPages = Math.ceil(totalSuppliersCount / itemsPerPage);

  const paginatedSuppliers = useMemo(() => {
    if (!needsPagination) return filteredComparisons;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredComparisons.slice(start, start + itemsPerPage);
  }, [filteredComparisons, needsPagination, currentPage]);

  // Format quotation message for WhatsApp/Email
  const generateQuotationText = (comp: SupplierBudgetComparison) => {
    const lines = [
      `*SOLICITAÇÃO DE COTAÇÃO & ORÇAMENTO*`,
      `*Empresa:* ${companyName}`,
      `*Fornecedor:* ${comp.supplier.name} (A/C ${comp.supplier.contactName})`,
      `*Data:* ${new Date().toLocaleDateString('pt-BR')}`,
      `---------------------------------------`,
      `Olá ${comp.supplier.contactName}, gostaria de cotar os seguintes itens com melhores condições para fechamento em volume:`,
      ``,
    ];

    comp.coveredProducts.forEach((p, idx) => {
      lines.push(
        `${idx + 1}. *${p.name}* - Quantidade: ${p.quantity} ${p.unit} (Ref: ${formatCurrency(
          p.estimatedUnitPrice
        )}/${p.unit})`
      );
    });

    lines.push(``);
    lines.push(`*Total Estimado Inicial:* ${formatCurrency(comp.totalCost)}`);
    lines.push(`Prazo de entrega habitual: ${comp.supplier.deliveryDays} dias.`);
    lines.push(`Favor confirmar preços atualizados, disponibilidade e condição de pagamento.`);
    lines.push(`Obrigado!`);

    return lines.join('\n');
  };

  const handleCopyQuotation = (comp: SupplierBudgetComparison) => {
    const text = generateQuotationText(comp);
    navigator.clipboard.writeText(text);
    setCopiedSupplierId(comp.supplier.id);
    setTimeout(() => setCopiedSupplierId(null), 2500);
  };

  const handleSendToWhatsApp = (comp: SupplierBudgetComparison) => {
    const text = encodeURIComponent(generateQuotationText(comp));
    const phone = comp.supplier.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleInitiateOrder = (comp: SupplierBudgetComparison) => {
    if (!onInitiateOrderFromBudget) return;
    const stockItemsToOrder: StockItem[] = [];
    const quantities: Record<string, number> = {};

    comp.coveredProducts.forEach((cp) => {
      const existing = items.find((i) => i.name.toLowerCase() === cp.name.toLowerCase());
      if (existing) {
        stockItemsToOrder.push(existing);
        quantities[existing.id] = cp.quantity;
      }
    });

    onInitiateOrderFromBudget(comp.supplier, stockItemsToOrder, quantities);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Heading */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-purple-400" />
                Módulo Estratégico de Cotação
              </span>
              <span className="text-xs text-slate-400">
                Agrupamento por Mix & Variedade de Fornecedores
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-slate-100 mt-2">
              Painel de Orçamento & Negociação em Volume
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Monte sua lista com os itens de reposição e novos produtos. O sistema analisa e agrupa automaticamente os fornecedores que possuem a maior variedade do seu mix, permitindo barganhar descontos por concentração de compras.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadReplenishmentItems}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Puxar Itens de Reposição</span>
            </button>

            <button
              onClick={() => setIsAddCustomOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-md active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Incluir Produto no Orçamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cesta de Itens do Orçamento */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Cesta de Itens do Orçamento ({budgetItems.length} {budgetItems.length === 1 ? 'produto' : 'produtos'})
            </h3>
          </div>
          {budgetItems.length > 0 && (
            <button
              onClick={() => setBudgetItems([])}
              className="text-xs text-rose-400 hover:text-rose-300 underline"
            >
              Limpar Cesta
            </button>
          )}
        </div>

        {budgetItems.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
            <Calculator className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">
              Nenhum produto adicionado ao orçamento. Clique em <strong>"Puxar Itens de Reposição"</strong> ou <strong>"Incluir Produto"</strong> para iniciar a cotação comparativa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
            {budgetItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-slate-200 truncate">{item.name}</h4>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span>Preço Ref: {formatCurrency(item.targetUnitPrice)}</span>
                    <span>•</span>
                    <span className="text-purple-300 font-semibold">
                      Total: {formatCurrency(item.quantity * item.targetUnitPrice)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 1)}
                      className="w-16 py-1 px-1.5 rounded bg-slate-800 border border-slate-700 text-slate-100 font-bold text-center text-xs focus:outline-none focus:border-purple-500"
                      title="Alterar quantidade necessária"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveBudgetItem(item.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                    title="Remover do orçamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção Comparativa: Agrupamento por Fornecedores com Maior Variedade */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-slate-100">
                Ranking de Fornecedores por Variedade de Mix
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Fornecedores com maior cobertura de itens aparecem no topo para maximizar seu poder de barganha comercial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar fornecedor..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={() => setOnlySuppliersWithVariety(!onlySuppliersWithVariety)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                onlySuppliersWithVariety
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-850 text-slate-400 border-slate-700'
              }`}
            >
              {onlySuppliersWithVariety ? 'Ocultar sem mix' : 'Ver todos'}
            </button>
          </div>
        </div>

        {/* Listagem de Fornecedores Comparados */}
        {filteredComparisons.length === 0 ? (
          <div className="p-10 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            Nenhum fornecedor encontrado para os itens da sua cesta de orçamento.
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedSuppliers.map((comp, index) => {
              const isTopMix = index === 0 && currentPage === 1 && comp.varietyCount > 0;
              const hasAllItems = comp.varietyCount === budgetItems.length && budgetItems.length > 0;

              return (
                <div
                  key={comp.supplier.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isTopMix
                      ? 'bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border-purple-500/60 shadow-xl ring-1 ring-purple-500/30'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Supplier Info & Mix Stats */}
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isTopMix
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        #{((currentPage - 1) * itemsPerPage) + index + 1}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-100 text-base">
                            {comp.supplier.name}
                          </h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {comp.supplier.category}
                          </span>
                          {isTopMix && (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-400" />
                              Maior Variedade de Mix
                            </span>
                          )}
                          {hasAllItems && (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              100% dos Produtos Atendidos
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span>Contato: <strong className="text-slate-300">{comp.supplier.contactName}</strong></span>
                          <span>•</span>
                          <span>WhatsApp: <strong className="font-mono text-emerald-400">{comp.supplier.phone}</strong></span>
                          <span>•</span>
                          <span>Entrega: <strong className="text-slate-300">{comp.supplier.deliveryDays} dias úteis</strong></span>
                          <span>•</span>
                          <span>Ciclo de Preços: {comp.supplier.priceUpdateIntervalDays || 30}d (máx 45d)</span>
                        </div>

                        {/* Progress Bar of Coverage */}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">
                              Cobertura: <strong className="text-purple-300 font-bold">{comp.varietyCount} de {budgetItems.length} itens ({comp.coveragePercentage.toFixed(0)}%)</strong>
                            </span>
                            <span className="font-mono text-slate-300">
                              Estimado: <strong className="text-emerald-400 font-bold text-sm">{formatCurrency(comp.totalCost)}</strong>
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isTopMix ? 'bg-purple-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${comp.coveragePercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Covered Items Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-[10px] text-slate-500 font-medium mr-1">Produtos atendidos:</span>
                          {comp.coveredProducts.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1"
                            >
                              <span className="text-emerald-400 font-bold">✓</span>
                              {p.name} ({p.quantity} {p.unit})
                            </span>
                          ))}
                          {comp.missingProducts.length > 0 && (
                            <span className="text-[10px] text-slate-500 italic ml-1">
                              (+{comp.missingProducts.length} itens não fornecidos)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Negotiation Actions */}
                    <div className="flex flex-wrap lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyQuotation(comp)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-all"
                          title="Copiar texto da cotação para e-mail ou planilha"
                        >
                          {copiedSupplierId === comp.supplier.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Texto</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleSendToWhatsApp(comp)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Abrir WhatsApp com orçamento formatado para negociação"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Negociar no WhatsApp</span>
                        </button>
                      </div>

                      {onInitiateOrderFromBudget && comp.varietyCount > 0 && (
                        <button
                          onClick={() => handleInitiateOrder(comp)}
                          className="w-full px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-sm"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Gerar Pedido Direto</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação para mais de 10 fornecedores (Regra: SE A QUANTIDADE FOR MAIS QUE 10 FORNECEDORES SEPARE POR PAGINAÇÃO) */}
        {needsPagination && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Mostrando <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> a{' '}
              <strong>{Math.min(currentPage * itemsPerPage, totalSuppliersCount)}</strong> de{' '}
              <strong>{totalSuppliersCount}</strong> fornecedores comparados
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-750"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentPage(num)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    currentPage === num
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-750"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Incluir Novo Produto no Orçamento */}
      {isAddCustomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Incluir Produto no Orçamento
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecione um item do estoque cadastrado ou digite um novo produto avulso.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCustomOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Selecionar do Catálogo Existente (Opcional)
                </label>
                <select
                  value={selectedExistingStockId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedExistingStockId(val);
                    if (val) {
                      const found = items.find((i) => i.id === val);
                      if (found) {
                        setCustomName(found.name);
                        setCustomCategory(found.category);
                        setCustomUnit(found.unit);
                        setCustomTargetPrice(String(found.costPrice));
                      }
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Ou digite um novo produto avulso abaixo --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code}) - Estoque atual: {i.currentStock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedExistingStockId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex: Queijo Brie Artesanal 1kg"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Quantidade a Cotar *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Unidade
                  </label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as StockUnit)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="un">un</option>
                    <option value="pct">pct</option>
                    <option value="cx">cx</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="fd">fd</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Preço Unitário Alvo / Ref (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customTargetPrice}
                    onChange={(e) => setCustomTargetPrice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as ItemCategory)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="porcionamento">Porcionamento (Cozinha)</option>
                    <option value="petisco">Petiscos & Congelados</option>
                    <option value="bebida">Bebidas & Bar</option>
                    <option value="consumo">Consumo & Descartáveis</option>
                    <option value="limpeza">Limpeza & Químicos</option>
                    <option value="outro">Outro / Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Observações para a Cotação
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Ex: Exigência de embalagem a vácuo / Lote recente"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCustomOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm"
                >
                  Adicionar à Cesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
