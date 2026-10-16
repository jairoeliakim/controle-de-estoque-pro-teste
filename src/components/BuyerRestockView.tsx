import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  ShoppingCart,
  Send,
  Mail,
  MessageCircle,
  Truck,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  Filter,
  Package,
  TrendingDown,
  Sparkles,
  Store,
  DollarSign,
  Phone,
  HelpCircle,
  QrCode,
  ArrowRightLeft,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Check,
  Building2,
  Clock,
  CheckCheck,
  Save,
  Printer,
} from 'lucide-react';
import {
  formatCurrency,
  formatQuantity,
  generateEmailOrderLink,
  generateWhatsAppOrderLink,
  getCategoryLabel,
  getStockHealth,
} from '../utils/formatters';
import { StockItem, Supplier, PurchaseOrder, UserRole, canMakePurchaseOrders, SystemSettings } from '../types';
import { PrintOrderModal } from './PrintOrderModal';

interface BuyerRestockViewProps {
  items: StockItem[];
  suppliers: Supplier[];
  onOrderCreated: (order: PurchaseOrder) => void;
  ordersHistory: PurchaseOrder[];
  restaurantName?: string;
  currentRole: UserRole;
  onSwitchRole?: (role: UserRole) => void;
  onOpenInvoiceImporter?: (orderId?: string) => void;
  onUpdateItemSupplier?: (itemIds: string[], supplierId: string) => void;
  systemSettings?: SystemSettings;
  onOpenSystemSettings?: () => void;
}

export const BuyerRestockView: React.FC<BuyerRestockViewProps> = ({
  items,
  suppliers,
  onOrderCreated,
  ordersHistory,
  restaurantName = 'Desenvolvimento de Software',
  currentRole,
  onSwitchRole,
  onOpenInvoiceImporter,
  onUpdateItemSupplier,
  systemSettings,
  onOpenSystemSettings,
}) => {
  const [filterType, setFilterType] = useState<'todos_alertas' | 'reposicao' | 'atencao' | 'pedidos_historico'>('todos_alertas');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('todos');
  const [selectedItemsForOrder, setSelectedItemsForOrder] = useState<Record<string, boolean>>({});

  // Active Order Modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [activeSupplierForOrder, setActiveSupplierForOrder] = useState<Supplier | null>(null);
  const [orderItemIds, setOrderItemIds] = useState<string[]>([]);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [updatePrimarySupplierOnOrder, setUpdatePrimarySupplierOnOrder] = useState(false);
  const [batchTargetSupplierId, setBatchTargetSupplierId] = useState<string>('');
  const [orderUrgent, setOrderUrgent] = useState(true);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [orderSentSuccess, setOrderSentSuccess] = useState<string | null>(null);

  // Printable Order State & Modal
  const [printingOrder, setPrintingOrder] = useState<PurchaseOrder | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Group items by health status
  const analyzedItems = items.map((item) => {
    const health = getStockHealth(item);
    const supplier = suppliers.find((s) => s.id === item.primarySupplierId);
    return {
      ...item,
      health,
      supplier,
    };
  });

  const criticalItems = analyzedItems.filter((i) => i.health.status === 'critico');
  const attentionItems = analyzedItems.filter((i) => i.health.status === 'atencao');

  // Most recent supplier registered in the company (Regra: AO ENVIAR UM NOVO PEDIDO POR PADRÃO APRESENTAR OS DADOS DO FORNECEDOR CADASTRADO MAIS RECENTE)
  const mostRecentSupplier = React.useMemo(() => {
    if (!suppliers || suppliers.length === 0) return null;
    return [...suppliers].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })[0];
  }, [suppliers]);

  // Filter based on UI state
  const displayedItems = analyzedItems.filter((item) => {
    if (filterType === 'reposicao' && item.health.status !== 'critico') return false;
    if (filterType === 'atencao' && item.health.status !== 'atencao') return false;
    if (filterType === 'todos_alertas' && item.health.status === 'seguro') return false;
    if (selectedSupplierId !== 'todos' && item.primarySupplierId !== selectedSupplierId) return false;
    return true;
  });

  // Toggle selection
  const toggleItemSelection = (id: string) => {
    setSelectedItemsForOrder((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAllFiltered = () => {
    const next: Record<string, boolean> = {};
    displayedItems.forEach((i) => {
      next[i.id] = true;
    });
    setSelectedItemsForOrder(next);
  };

  const clearSelection = () => {
    setSelectedItemsForOrder({});
  };

  // Helper to determine pricing for an item given the active supplier
  const getItemPricing = (item: StockItem, supplier: Supplier | null) => {
    if (!supplier) {
      return {
        unitPrice: item.costPrice,
        isAlternative: false,
        isPrimary: false,
        diff: 0,
        altQuote: undefined,
      };
    }

    const isPrimary = item.primarySupplierId === supplier.id;

    // Check if the item has an alternative quotation matching this supplier
    const altQuote = item.alternativeSuppliers?.find(
      (alt) =>
        alt.supplierId === supplier.id ||
        alt.supplierName.toLowerCase().trim() === supplier.name.toLowerCase().trim() ||
        supplier.name.toLowerCase().includes(alt.supplierName.toLowerCase()) ||
        alt.supplierName.toLowerCase().includes(supplier.name.toLowerCase())
    );

    if (altQuote && altQuote.unitPrice > 0) {
      return {
        unitPrice: altQuote.unitPrice,
        isAlternative: true,
        isPrimary,
        diff: altQuote.unitPrice - item.costPrice,
        altQuote,
      };
    }

    return {
      unitPrice: item.costPrice,
      isAlternative: false,
      isPrimary,
      diff: 0,
      altQuote: undefined,
    };
  };

  // Open modal for specific supplier with items
  const handleOpenOrderForSupplier = (supplier: Supplier, preselectedItems?: StockItem[]) => {
    setActiveSupplierForOrder(supplier);

    let targetItems: StockItem[] = [];
    if (preselectedItems && preselectedItems.length > 0) {
      targetItems = preselectedItems;
      const next: Record<string, boolean> = { ...selectedItemsForOrder };
      preselectedItems.forEach((i) => (next[i.id] = true));
      setSelectedItemsForOrder(next);
    } else {
      const selectedList = items.filter((it) => selectedItemsForOrder[it.id]);
      if (selectedList.length > 0) {
        targetItems = selectedList;
      } else {
        targetItems = items.filter((it) => it.primarySupplierId === supplier.id && it.currentStock <= it.reorderPoint);
      }
    }

    // Default to at least one item if empty
    if (targetItems.length === 0 && items.length > 0) {
      targetItems = [items[0]];
    }

    setOrderItemIds(targetItems.map((i) => i.id));

    const initialQuantities: Record<string, number> = {};
    targetItems.forEach((it) => {
      const health = getStockHealth(it);
      initialQuantities[it.id] = health.neededToOrder > 0 ? health.neededToOrder : it.minStock;
    });
    setCustomQuantities(initialQuantities);
    setUpdatePrimarySupplierOnOrder(false);
    setIsOrderModalOpen(true);
  };

  // Switch supplier inside the modal without losing ordered items
  const handleSwitchSupplier = (newSupplierId: string) => {
    const nextSup = suppliers.find((s) => s.id === newSupplierId);
    if (nextSup) {
      setActiveSupplierForOrder(nextSup);
    }
  };

  // Quantity adjustment inside modal
  const handleQuantityChange = (itemId: string, newQty: number) => {
    setCustomQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0.1, Number(newQty.toFixed(2))),
    }));
  };

  // Remove item from active order
  const handleRemoveItemFromOrder = (itemId: string) => {
    setOrderItemIds((prev) => prev.filter((id) => id !== itemId));
  };

  // Items currently being ordered in modal (independent of primarySupplierId)
  const modalSupplierItems = items.filter((item) => orderItemIds.includes(item.id));

  const totalEstimatedCost = modalSupplierItems.reduce((acc, it) => {
    const health = getStockHealth(it);
    const defaultQty = health.neededToOrder > 0 ? health.neededToOrder : it.minStock;
    const qty = customQuantities[it.id] !== undefined ? customQuantities[it.id] : defaultQty;
    const pricing = getItemPricing(it, activeSupplierForOrder);
    return acc + qty * pricing.unitPrice;
  }, 0);

  // Generate order text for clipboard or sending
  const getOrderItemsPayload = () => {
    return modalSupplierItems.map((it) => {
      const health = getStockHealth(it);
      const defaultQty = health.neededToOrder > 0 ? health.neededToOrder : it.minStock;
      const qty = customQuantities[it.id] !== undefined ? customQuantities[it.id] : defaultQty;
      const pricing = getItemPricing(it, activeSupplierForOrder);
      return {
        name: it.name,
        quantity: qty,
        unit: it.unit,
        unitPrice: pricing.unitPrice,
        notes: `Estoque atual: ${formatQuantity(it.currentStock, it.unit)} (Mínimo: ${formatQuantity(it.minStock, it.unit)})`,
      };
    });
  };

  const handleCopyOrderText = () => {
    if (!activeSupplierForOrder) return;
    const itemsPayload = getOrderItemsPayload();
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const text = `*PEDIDO DE COMPRA - ${restaurantName.toUpperCase()}*\nData: ${dateStr}\nFornecedor: ${activeSupplierForOrder.name}\nContato: ${activeSupplierForOrder.contactName} (${activeSupplierForOrder.phone})\nE-mail: ${activeSupplierForOrder.email}\n\nITENS SOLICITADOS:\n${itemsPayload
      .map((it, idx) => `${idx + 1}. ${it.name}: ${formatQuantity(it.quantity, it.unit)} x ${formatCurrency(it.unitPrice)} = ${formatCurrency(it.quantity * it.unitPrice)} (${it.notes})`)
      .join('\n')}\n\nTotal estimado do pedido: ${formatCurrency(totalEstimatedCost)}\nPor favor confirmar recebimento e prazo de entrega.`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  const handlePrintDraftOrder = () => {
    if (!activeSupplierForOrder) return;
    const itemsPayload = modalSupplierItems.map((it) => {
      const health = getStockHealth(it);
      const defaultQty = health.neededToOrder > 0 ? health.neededToOrder : it.minStock;
      const qty = customQuantities[it.id] !== undefined ? customQuantities[it.id] : defaultQty;
      const pricing = getItemPricing(it, activeSupplierForOrder);
      return {
        itemId: it.id,
        itemName: it.name,
        unit: it.unit,
        currentStock: it.currentStock,
        minStock: it.minStock,
        quantityToOrder: qty,
        estimatedUnitPrice: pricing.unitPrice,
        totalCost: qty * pricing.unitPrice,
      };
    });

    const nextOrderNum = `PED-2026-${String(ordersHistory.length + 1).padStart(3, '0')}`;
    const draftOrder: PurchaseOrder = {
      id: `draft-${Date.now()}`,
      orderNumber: `${nextOrderNum} (Prévia)`,
      supplierId: activeSupplierForOrder.id,
      supplierName: activeSupplierForOrder.name,
      supplierPhone: activeSupplierForOrder.phone,
      supplierEmail: activeSupplierForOrder.email,
      createdAt: new Date().toISOString(),
      createdBy: 'Setor de Compras / Emissão',
      items: itemsPayload,
      totalValue: totalEstimatedCost,
      status: 'pendente',
      channelSent: 'direto',
      notes: orderUrgent ? 'URGENTE: Reforço prioritário para suprir estoque mínimo.' : undefined,
    };

    setPrintingOrder(draftOrder);
    setIsPrintModalOpen(true);
  };

  const handleRecordOrder = (channel: 'whatsapp' | 'email' | 'direto') => {
    if (!activeSupplierForOrder) return;
    const itemsPayload = modalSupplierItems.map((it) => {
      const health = getStockHealth(it);
      const defaultQty = health.neededToOrder > 0 ? health.neededToOrder : it.minStock;
      const qty = customQuantities[it.id] !== undefined ? customQuantities[it.id] : defaultQty;
      const pricing = getItemPricing(it, activeSupplierForOrder);
      return {
        itemId: it.id,
        itemName: it.name,
        unit: it.unit,
        currentStock: it.currentStock,
        minStock: it.minStock,
        quantityToOrder: qty,
        estimatedUnitPrice: pricing.unitPrice,
        totalCost: qty * pricing.unitPrice,
      };
    });

    const interval = activeSupplierForOrder.priceUpdateIntervalDays || systemSettings?.defaultPriceValidityDays || 30;
    const lastUpdate = activeSupplierForOrder.lastPriceUpdateDate
      ? new Date(activeSupplierForOrder.lastPriceUpdateDate)
      : (activeSupplierForOrder.createdAt ? new Date(activeSupplierForOrder.createdAt) : new Date('2026-03-01'));
    const daysPassed = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysPassed > interval;
    const pricePolicy = systemSettings?.outdatedPricePolicy || 'alertar';

    if (isOverdue && pricePolicy === 'bloquear') {
      alert(`Emissão bloqueada por parametrização sistêmica: Os preços do fornecedor ${activeSupplierForOrder.name} estão desatualizados há ${daysPassed} dias (limite: ${interval} dias). Atualize os preços de cotação para prosseguir.`);
      return;
    }

    if (systemSettings?.blockOrdersBelowMinSupplierValue && activeSupplierForOrder.minOrderValue && totalEstimatedCost < activeSupplierForOrder.minOrderValue) {
      alert(`Emissão bloqueada por parametrização sistêmica: O valor total do pedido (${formatCurrency(totalEstimatedCost)}) está abaixo do pedido mínimo do fornecedor (${formatCurrency(activeSupplierForOrder.minOrderValue)}).`);
      return;
    }

    const newOrderNumber = `PED-2026-${String(ordersHistory.length + 1).padStart(3, '0')}`;
    const requiresApproval = isOverdue && pricePolicy === 'exigir_aprovacao';

    const newOrder: PurchaseOrder = {
      id: `po-${Date.now()}`,
      orderNumber: newOrderNumber,
      supplierId: activeSupplierForOrder.id,
      supplierName: activeSupplierForOrder.name,
      supplierPhone: activeSupplierForOrder.phone,
      supplierEmail: activeSupplierForOrder.email,
      createdAt: new Date().toISOString(),
      createdBy: 'Setor de Compras / Proprietário',
      items: itemsPayload,
      totalValue: totalEstimatedCost,
      status: channel === 'direto' ? 'pendente' : channel === 'whatsapp' ? 'enviado_whatsapp' : 'enviado_email',
      channelSent: channel,
      notes: requiresApproval
        ? `Aguardando autorização gerencial (Preço há ${daysPassed} dias sem atualização)`
        : orderUrgent
        ? 'URGENTE: Reforço prioritário para suprir estoque mínimo.'
        : undefined,
    };

    onOrderCreated(newOrder);

    // If buyer chose to make this supplier permanent for the ordered items
    if (updatePrimarySupplierOnOrder && onUpdateItemSupplier) {
      onUpdateItemSupplier(
        modalSupplierItems.map((i) => i.id),
        activeSupplierForOrder.id
      );
    }

    setOrderSentSuccess(
      channel === 'direto'
        ? `Pedido ${newOrderNumber} salvo diretamente no sistema (status: Pendente)! Disponível para conciliação ao receber a NF-e.`
        : `Pedido registrado com sucesso para ${activeSupplierForOrder.name} via ${channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}!`
    );
    setTimeout(() => {
      setOrderSentSuccess(null);
      setIsOrderModalOpen(false);
      setUpdatePrimarySupplierOnOrder(false);
    }, 2500);
  };

  // Requirement: apenas o compras, gerente e adm podem fazer pedido, ver fornecedores e cadastrar
  if (!canMakePurchaseOrders(currentRole)) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-2xl mx-auto my-8 shadow-2xl animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Acesso Restrito ao Setor de Compras & Gerência
          </span>
          <h3 className="text-xl font-extrabold text-slate-100">
            Apenas Compras, Gerente e ADM podem fazer pedidos e ver fornecedores
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Seu perfil atual é <strong className="text-amber-400 uppercase">{currentRole}</strong>. O perfil de Conferente é focado exclusivamente na contagem física, conferência de validades e registro de perdas operacionais.
          </p>
        </div>

        {onSwitchRole && (
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-medium block">
              Alterne o perfil no topo ou selecione abaixo para acessar a área de compras:
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => onSwitchRole('compras')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md"
              >
                Acessar como Compras
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole('gerente')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all border border-slate-700"
              >
                Acessar como Gerente
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole('administrador')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all border border-slate-700"
              >
                Acessar como Administrador
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Caminho do Comprador ou Proprietário
              </span>
              <span className="text-xs text-slate-400">
                Central de Reposição & Despacho de Pedidos
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-slate-100 mt-2">
              Disparador de Compras & Gestão de Fornecedores
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Quando o estoque atinge o limite pré-estabelecido, o sistema calcula a quantidade mínima sugerida para reposição e possibilita o envio direto do pedido para o WhatsApp ou E-mail do fornecedor com cotações alternativas.
            </p>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              onClick={() => setFilterType('reposicao')}
              className={`cursor-pointer px-4 py-2.5 rounded-xl border transition-all ${
                filterType === 'reposicao'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Reposição Imediata</span>
                  <span className="text-sm font-bold text-rose-400">{criticalItems.length} itens</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setFilterType('atencao')}
              className={`cursor-pointer px-4 py-2.5 rounded-xl border transition-all ${
                filterType === 'atencao'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Necessidade de Atenção</span>
                  <span className="text-sm font-bold text-amber-400">{attentionItems.length} itens</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setFilterType('todos_alertas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === 'todos_alertas'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
              }`}
            >
              Todos os Alertas ({criticalItems.length + attentionItems.length})
            </button>
            <button
              onClick={() => setFilterType('reposicao')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === 'reposicao'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
              }`}
            >
              Reposição Imediata ({criticalItems.length})
            </button>
            <button
              onClick={() => setFilterType('atencao')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === 'atencao'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
              }`}
            >
              Necessidade de Atenção ({attentionItems.length})
            </button>
            <button
              onClick={() => setFilterType('pedidos_historico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterType === 'pedidos_historico'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Pedidos de Compra ({ordersHistory.length})</span>
            </button>
          </div>

          {/* Supplier Selector & Invoice Import */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenInvoiceImporter && (
              <button
                type="button"
                onClick={() => onOpenInvoiceImporter()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                title="Dar entrada no estoque lendo a Nota Fiscal ou QR Code do fornecedor"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Receber / Importar NF-e</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos os Fornecedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Feed & Item Cards OR Orders History */}
      {filterType === 'pedidos_historico' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                <span>Histórico de Pedidos de Compra & Conciliação de NF-e</span>
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhe os pedidos despachados para fornecedores e seus respectivos status de atendimento e fechamento por notas fiscais.
              </p>
            </div>
            {onOpenInvoiceImporter && (
              <button
                type="button"
                onClick={() => onOpenInvoiceImporter()}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Dar Entrada por NF-e</span>
              </button>
            )}
          </div>

          {ordersHistory.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800">
              <ShoppingCart className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-200">
                Nenhum pedido de compra registrado ainda
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Gere pedidos selecionando os itens em reposição urgente ou atenção nos filtros acima.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordersHistory.map((order) => {
                const isDelivered = order.status === 'entregue' || order.status === 'recebido';
                const isPartial = order.status === 'parcial';

                return (
                  <div
                    key={order.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isDelivered
                        ? 'bg-slate-900/90 border-emerald-500/30'
                        : isPartial
                        ? 'bg-slate-900/90 border-amber-500/40 shadow-lg'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-extrabold text-amber-400">
                            {order.orderNumber || order.id}
                          </span>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                              isDelivered
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : isPartial
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : order.channelSent === 'whatsapp'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : order.channelSent === 'email'
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isDelivered
                              ? 'Entregue / Fechado'
                              : isPartial
                              ? 'Atendido Parcialmente'
                              : order.channelSent === 'whatsapp'
                              ? 'Enviado WhatsApp'
                              : order.channelSent === 'email'
                              ? 'Enviado E-mail'
                              : 'Salvo / Pendente'}
                          </span>
                          {order.linkedInvoiceNumbers && order.linkedInvoiceNumbers.length > 0 && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1">
                              <QrCode className="w-3 h-3 text-amber-400" />
                              <span>NF-e nº {order.linkedInvoiceNumbers.join(', ')}</span>
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-400" />
                          <span>{order.supplierName}</span>
                        </h4>

                        <p className="text-xs text-slate-400">
                          Criado em {new Date(order.createdAt).toLocaleDateString('pt-BR')} por {order.createdBy} • Total Previsto: <strong className="text-emerald-400 font-mono">{formatCurrency(order.totalValue)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setPrintingOrder(order);
                            setIsPrintModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                          title="Imprimir espelho do pedido ou salvar em PDF"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Imprimir / PDF</span>
                        </button>

                        {!isDelivered && onOpenInvoiceImporter && (
                          <button
                            type="button"
                            onClick={() => onOpenInvoiceImporter(order.id)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Vincular Nota Fiscal</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="pt-3">
                      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/70">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 px-3">Produto</th>
                              <th className="py-2 px-3 text-right">Qtd Pedida</th>
                              <th className="py-2 px-3 text-right">Qtd Entregue</th>
                              <th className="py-2 px-3 text-right">Saldo Restante</th>
                              <th className="py-2 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {order.items.map((it) => {
                              const rec = it.receivedQuantity || 0;
                              const rem = Math.max(0, it.quantityToOrder - rec);
                              const isItemDone = rec >= it.quantityToOrder;
                              return (
                                <tr key={it.itemId} className="hover:bg-slate-900/40">
                                  <td className="py-2 px-3 font-medium text-slate-200">
                                    {it.itemName}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-300">
                                    {formatQuantity(it.quantityToOrder, it.unit)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">
                                    {rec > 0 ? formatQuantity(rec, it.unit) : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">
                                    {rem === 0 ? (
                                      <span className="text-emerald-400">0 {it.unit}</span>
                                    ) : (
                                      <span className="text-amber-400">{formatQuantity(rem, it.unit)}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {isItemDone ? (
                                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        Entregue
                                      </span>
                                    ) : rec > 0 ? (
                                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                        Parcial
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                        Aguardando
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {order.notes && (
                        <p className="text-[11px] text-slate-400 mt-2 italic">
                          Obs: {order.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">
            Nenhum item em estado de alerta neste filtro
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Todos os itens monitorados estão dentro da margem segura de estoque ou você não selecionou itens para este fornecedor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item) => {
            const supplier = suppliers.find((s) => s.id === item.primarySupplierId);
            const isSelected = !!selectedItemsForOrder[item.id];
            const isCritical = item.health.status === 'critico';

            return (
              <div
                key={item.id}
                id={`restock-card-${item.id}`}
                className={`p-4 rounded-2xl border transition-all ${
                  isCritical
                    ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-500/70 shadow-lg shadow-rose-950/20'
                    : 'bg-slate-900/80 border-amber-500/30 hover:border-amber-500/50'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Checkbox & Name */}
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItemSelection(item.id)}
                      className="mt-1 w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-900 cursor-pointer"
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {item.code}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {getCategoryLabel(item.category)}
                        </span>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${item.health.badgeClass}`}>
                          {item.health.label}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-100 mt-1">
                        {item.name}
                      </h4>

                      {/* Stock metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Estoque Atual:</span>
                          <strong className={isCritical ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                            {formatQuantity(item.currentStock, item.unit)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Limite Mínimo:</span>
                          <strong className="text-slate-300">
                            {formatQuantity(item.minStock, item.unit)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Reposição Sugerida:</span>
                          <strong className="text-emerald-400 font-bold">
                            {formatQuantity(item.health.neededToOrder, item.unit)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Custo Unitário:</span>
                          <span className="text-slate-300 font-mono">
                            {formatCurrency(item.costPrice)} / {item.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Supplier info & Suggestions */}
                  <div className="lg:w-80 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Truck className="w-3 h-3 text-amber-400" />
                        Fornecedor Principal:
                      </span>
                      {supplier && (
                        <span className="text-[11px] text-slate-400">
                          Prazo: {supplier.deliveryDays}d
                        </span>
                      )}
                    </div>

                    {supplier ? (
                      <div>
                        <h5 className="text-xs font-bold text-slate-200 truncate">
                          {supplier.name}
                        </h5>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{supplier.contactName}</span>
                          <span>•</span>
                          <span className="font-mono text-emerald-400">{supplier.phone}</span>
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-rose-400">Sem fornecedor cadastrado</span>
                    )}

                    {/* Alternative Suppliers Suggestions */}
                    {item.alternativeSuppliers && item.alternativeSuppliers.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-semibold text-amber-400/90 flex items-center justify-between">
                          <span>Opções alternativas de fornecedor:</span>
                          <span className="text-[9px] text-slate-400">Troca rápida</span>
                        </span>
                        {item.alternativeSuppliers.map((alt, idx) => {
                          const matchedSupplier =
                            suppliers.find((s) => s.id === alt.supplierId) ||
                            suppliers.find((s) => s.name.toLowerCase().trim() === alt.supplierName.toLowerCase().trim()) ||
                            {
                              id: alt.supplierId || `alt-${idx}`,
                              name: alt.supplierName,
                              phone: supplier?.phone || '5511999999999',
                              email: supplier?.email || 'compras@fornecedor.com',
                              contactName: alt.supplierName,
                              category: 'Alternativo',
                              deliveryDays: 2,
                              minOrderValue: 0,
                            };

                          return (
                            <div
                              key={idx}
                              className="text-[11px] text-slate-300 flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800"
                            >
                              <div className="truncate pr-1">
                                <span className="font-medium text-slate-200 block truncate">{alt.supplierName}</span>
                                <span className="font-mono text-[10px] text-amber-400">
                                  {formatCurrency(alt.unitPrice)}/{item.unit}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenOrderForSupplier(matchedSupplier, [item])}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                title={`Montar pedido direto com ${alt.supplierName}`}
                              >
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                <span>Pedir Deste</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Direct Purchase Action */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenOrderForSupplier(supplier || suppliers[0], [item])}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Montar Pedido</span>
                    </button>

                    {supplier && (
                      <a
                        href={generateWhatsAppOrderLink(
                          supplier.phone,
                          supplier.name,
                          supplier.contactName,
                          restaurantName,
                          [
                            {
                              name: item.name,
                              quantity: item.health.neededToOrder,
                              unit: item.unit,
                              notes: `Reposição imediata - Estoque atual: ${formatQuantity(item.currentStock, item.unit)}`,
                            },
                          ],
                          isCritical
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition-all active:scale-95 whitespace-nowrap"
                        title="Enviar mensagem direta via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Zap Rápido</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Order Floating Bar when items are selected */}
      {Object.values(selectedItemsForOrder).filter(Boolean).length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-3xl bg-slate-900/95 border border-amber-500/40 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-extrabold flex items-center justify-center text-xs">
              {Object.values(selectedItemsForOrder).filter(Boolean).length}
            </span>
            <div>
              <span className="text-xs font-bold text-slate-100 block">
                {Object.values(selectedItemsForOrder).filter(Boolean).length} itens selecionados para pedido
              </span>
              <span className="text-[11px] text-slate-400">
                Você pode escolher e trocar o fornecedor a qualquer momento
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Desmarcar
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={batchTargetSupplierId || (suppliers[0]?.id ?? '')}
                onChange={(e) => setBatchTargetSupplierId(e.target.value)}
                className="py-1.5 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 max-w-[170px] truncate cursor-pointer"
                title="Selecione o fornecedor destinatário"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const targetSup = suppliers.find((s) => s.id === (batchTargetSupplierId || suppliers[0]?.id)) || suppliers[0];
                  if (targetSup) {
                    const selectedList = items.filter((it) => selectedItemsForOrder[it.id]);
                    handleOpenOrderForSupplier(targetSup, selectedList);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Fazer Pedido</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Envio de Pedido de Compra com Troca de Fornecedor */}
      {isOrderModalOpen && activeSupplierForOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <span>Pedido de Compra</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                      Troca de Fornecedor Ativa
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Altere o fornecedor, ajuste quantidades e envie via WhatsApp ou E-mail
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {orderSentSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{orderSentSuccess}</span>
                </div>
              )}

              {/* SEÇÃO PRINCIPAL: SELETOR E TROCA DE FORNECEDOR */}
              <div className="p-4 rounded-2xl bg-slate-950 border-2 border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="modal-supplier-select" className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fornecedor do Pedido:</span>
                  </label>
                  <span className="text-[11px] text-amber-400 font-medium">
                    Clique para trocar
                  </span>
                </div>

                {/* Dropdown Geral de Fornecedores */}
                <div className="relative">
                  <select
                    id="modal-supplier-select"
                    value={activeSupplierForOrder.id}
                    onChange={(e) => handleSwitchSupplier(e.target.value)}
                    className="w-full py-2.5 px-3.5 pr-8 rounded-xl bg-slate-900 border border-amber-500/50 text-slate-100 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.category || 'Fornecedor'} (Prazo: {s.deliveryDays}d)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Switch Pills based on items in this order */}
                {(() => {
                  // Find all suppliers related to the items in the order
                  const relatedSupplierIds = new Set<string>();
                  modalSupplierItems.forEach((it) => {
                    if (it.primarySupplierId) relatedSupplierIds.add(it.primarySupplierId);
                    it.alternativeSuppliers?.forEach((alt) => {
                      if (alt.supplierId) relatedSupplierIds.add(alt.supplierId);
                    });
                  });

                  const quickSuppliers = suppliers.filter((s) => relatedSupplierIds.has(s.id));

                  if (quickSuppliers.length <= 1) return null;

                  return (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Sugestões rápidas de cotação para estes itens:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {quickSuppliers.map((s) => {
                          const isCurrent = s.id === activeSupplierForOrder.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSwitchSupplier(s.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                  : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-amber-400/50 hover:text-slate-100'
                              }`}
                            >
                              {isCurrent ? <Check className="w-3 h-3" /> : <Building2 className="w-3 h-3 text-slate-400" />}
                              <span>{s.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Fornecedor Details Card */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{activeSupplierForOrder.name}</span>
                      {mostRecentSupplier && activeSupplierForOrder.id === mostRecentSupplier.id && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                          Fornecedor Mais Recente Cadastrado
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Prazo de entrega: <strong className="text-slate-200">{activeSupplierForOrder.deliveryDays} dias úteis</strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <strong className="text-slate-300">{activeSupplierForOrder.contactName}:</strong> {activeSupplierForOrder.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-400" />
                      {activeSupplierForOrder.email}
                    </span>
                  </div>

                  {/* Verificação de validade das cotações deste fornecedor & Parametrização Sistêmica */}
                  {(() => {
                    const interval = activeSupplierForOrder.priceUpdateIntervalDays || systemSettings?.defaultPriceValidityDays || 30;
                    const lastUpdate = activeSupplierForOrder.lastPriceUpdateDate
                      ? new Date(activeSupplierForOrder.lastPriceUpdateDate)
                      : (activeSupplierForOrder.createdAt ? new Date(activeSupplierForOrder.createdAt) : new Date('2026-03-01'));
                    const daysPassed = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysPassed > interval;
                    const pricePolicy = systemSettings?.outdatedPricePolicy || 'alertar';

                    if (!isOverdue) return null;

                    if (pricePolicy === 'bloquear') {
                      return (
                        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex flex-col gap-1.5 shadow-sm">
                          <div className="flex items-center gap-2 font-bold text-rose-200">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>🛑 Pedido Bloqueado: Preços Desatualizados</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Os preços deste fornecedor não são atualizados há <strong>{daysPassed} dias</strong> (limite configurado: {interval} dias).
                            A <strong>parametrização sistêmica estipulada pelo Administrador</strong> bloqueia pedidos para fornecedores com preços desatualizados. Atualize os preços de cotação para prosseguir.
                          </p>
                          {currentRole === 'administrador' && onOpenSystemSettings && (
                            <button
                              type="button"
                              onClick={onOpenSystemSettings}
                              className="text-[11px] font-bold text-purple-300 hover:text-purple-200 underline w-fit"
                            >
                              Configurar políticas na Parametrização Sistêmica &rarr;
                            </button>
                          )}
                        </div>
                      );
                    }

                    if (pricePolicy === 'exigir_aprovacao') {
                      return (
                        <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-blue-400" />
                          <span>
                            <strong>📋 Exige Aprovação Gerencial:</strong> Preços há <strong>{daysPassed} dias</strong> sem renovação. O pedido será registrado com marcação de aprovação obrigatória do Gerente/Administrador.
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>
                          <strong>Alerta de Cotação:</strong> Os preços deste fornecedor estão há <strong>{daysPassed} dias</strong> sem renovação (ciclo configurado: {interval} dias). Recomenda-se confirmar valores antes de fechar o pedido.
                        </span>
                      </div>
                    );
                  })()}

                  {activeSupplierForOrder.minOrderValue && activeSupplierForOrder.minOrderValue > 0 && (
                    <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Pedido Mínimo do Fornecedor:</span>
                      <span className={`font-mono font-bold ${totalEstimatedCost < activeSupplierForOrder.minOrderValue ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(activeSupplierForOrder.minOrderValue)}
                      </span>
                    </div>
                  )}

                  {activeSupplierForOrder.minOrderValue && totalEstimatedCost < activeSupplierForOrder.minOrderValue && (
                    <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      systemSettings?.blockOrdersBelowMinSupplierValue
                        ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${
                        systemSettings?.blockOrdersBelowMinSupplierValue ? 'text-rose-400' : 'text-amber-400'
                      }`} />
                      <span>
                        {systemSettings?.blockOrdersBelowMinSupplierValue ? (
                          <>
                            <strong>🛑 Pedido Bloqueado por Pedido Mínimo:</strong> O total atual ({formatCurrency(totalEstimatedCost)}) está abaixo do pedido mínimo ({formatCurrency(activeSupplierForOrder.minOrderValue)}). A política do Administrador bloqueia pedidos abaixo do valor estipulado.
                          </>
                        ) : (
                          <>
                            <strong>Atenção:</strong> O total atual ({formatCurrency(totalEstimatedCost)}) está abaixo do pedido mínimo deste fornecedor ({formatCurrency(activeSupplierForOrder.minOrderValue)}).
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Option to make this supplier permanent in inventory */}
                {onUpdateItemSupplier && (
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/30 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={updatePrimarySupplierOnOrder}
                      onChange={(e) => setUpdatePrimarySupplierOnOrder(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Definir {activeSupplierForOrder.name} como fornecedor padrão para estes itens
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Atualiza o cadastro permanente de estoque do restaurante com este fornecedor.
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {/* Urgency checkbox */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Marcar pedido como Prioridade URGENTE / Reposição Imediata
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={orderUrgent}
                  onChange={(e) => setOrderUrgent(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-500 bg-slate-900 border-slate-700 focus:ring-rose-400 cursor-pointer"
                />
              </div>

              {/* Items in this order */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400">
                    Itens no Pedido ({modalSupplierItems.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Preços e quantidades ajustáveis
                  </span>
                </div>

                <div className="space-y-2">
                  {modalSupplierItems.map((item) => {
                    const health = getStockHealth(item);
                    const defaultQty = health.neededToOrder > 0 ? health.neededToOrder : item.minStock;
                    const qty = customQuantities[item.id] !== undefined ? customQuantities[item.id] : defaultQty;
                    const pricing = getItemPricing(item, activeSupplierForOrder);
                    const itemTotal = qty * pricing.unitPrice;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              <span>{item.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {item.code}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>Estoque Atual: {formatQuantity(item.currentStock, item.unit)}</span>
                              <span>•</span>
                              <span>Mínimo: {formatQuantity(item.minStock, item.unit)}</span>
                            </div>
                          </div>

                          {modalSupplierItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromOrder(item.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="Remover este item deste pedido"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Pricing and Quantity row */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                          {/* Unit pricing indicator */}
                          <div className="flex items-center gap-1.5">
                            {pricing.isAlternative ? (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                Cotação deste Fornecedor: {formatCurrency(pricing.unitPrice)}/{item.unit}
                                {pricing.diff !== 0 && (
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    ({pricing.diff > 0 ? `+${formatCurrency(pricing.diff)}` : `${formatCurrency(pricing.diff)}`})
                                  </span>
                                )}
                              </span>
                            ) : pricing.isPrimary ? (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                Fornecedor Padrão: {formatCurrency(pricing.unitPrice)}/{item.unit}
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                                Preço Base: {formatCurrency(pricing.unitPrice)}/{item.unit}
                              </span>
                            )}
                          </div>

                          {/* Editable Quantity */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">Qtd:</span>
                            <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, qty - 1)}
                                className="px-2 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                step="any"
                                min="0.1"
                                value={qty}
                                onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                                className="w-14 text-center bg-transparent text-xs font-bold text-slate-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, qty + 1)}
                                className="px-2 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-xs text-slate-400">{item.unit}</span>

                            <div className="ml-2 font-mono font-bold text-emerald-400 text-xs">
                              = {formatCurrency(itemTotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total estimation */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Total Estimado do Pedido:</span>
                  <span className="text-[11px] text-slate-500">
                    {modalSupplierItems.length} {modalSupplierItems.length === 1 ? 'item' : 'itens'} para {activeSupplierForOrder.name}
                  </span>
                </div>
                <span className="text-lg font-extrabold text-amber-400 font-mono">
                  {formatCurrency(totalEstimatedCost)}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-850 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleCopyOrderText}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>{copiedSuccess ? 'Texto Copiado!' : 'Copiar Texto'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintDraftOrder}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                  title="Visualizar e imprimir formato simplificado para PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>

              {(() => {
                const interval = activeSupplierForOrder.priceUpdateIntervalDays || systemSettings?.defaultPriceValidityDays || 30;
                const lastUpdate = activeSupplierForOrder.lastPriceUpdateDate
                  ? new Date(activeSupplierForOrder.lastPriceUpdateDate)
                  : (activeSupplierForOrder.createdAt ? new Date(activeSupplierForOrder.createdAt) : new Date('2026-03-01'));
                const daysPassed = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysPassed > interval;
                const pricePolicy = systemSettings?.outdatedPricePolicy || 'alertar';
                const isPriceBlocked = isOverdue && pricePolicy === 'bloquear';
                const isMinOrderBlocked = !!(
                  systemSettings?.blockOrdersBelowMinSupplierValue &&
                  activeSupplierForOrder.minOrderValue &&
                  totalEstimatedCost < activeSupplierForOrder.minOrderValue
                );
                const isBlocked = isPriceBlocked || isMinOrderBlocked;

                return (
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {/* Salvar Pedido Diretamente no Sistema */}
                    <button
                      type="button"
                      disabled={isBlocked}
                      onClick={() => handleRecordOrder('direto')}
                      className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                        isBlocked
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      }`}
                      title={
                        isPriceBlocked
                          ? 'Envio bloqueado por política de preços desatualizados'
                          : isMinOrderBlocked
                          ? 'Envio bloqueado: valor abaixo do pedido mínimo do fornecedor'
                          : 'Salvar o pedido diretamente no sistema sem enviar WhatsApp ou E-mail (fica como pendente aguardando conferência pela nota fiscal)'
                      }
                    >
                      <Save className="w-4 h-4" />
                      <span>Salvar Pedido Diretamente</span>
                    </button>

                    {/* Send via WhatsApp */}
                    {isBlocked ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
                        title={
                          isPriceBlocked
                            ? 'Envio bloqueado por política de preços desatualizados'
                            : 'Envio bloqueado: valor abaixo do pedido mínimo'
                        }
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Enviar WhatsApp</span>
                      </button>
                    ) : (
                      <a
                        href={generateWhatsAppOrderLink(
                          activeSupplierForOrder.phone,
                          activeSupplierForOrder.name,
                          activeSupplierForOrder.contactName,
                          restaurantName,
                          getOrderItemsPayload(),
                          orderUrgent
                        )}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleRecordOrder('whatsapp')}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                        title={`Enviar pedido via WhatsApp para ${activeSupplierForOrder.name} (${activeSupplierForOrder.phone})`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Enviar WhatsApp</span>
                      </a>
                    )}

                    {/* Send via Email */}
                    {isBlocked ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
                        title={
                          isPriceBlocked
                            ? 'Envio bloqueado por política de preços desatualizados'
                            : 'Envio bloqueado: valor abaixo do pedido mínimo'
                        }
                      >
                        <Mail className="w-4 h-4" />
                        <span>Enviar E-mail</span>
                      </button>
                    ) : (
                      <a
                        href={generateEmailOrderLink(
                          activeSupplierForOrder.email,
                          activeSupplierForOrder.name,
                          activeSupplierForOrder.contactName,
                          restaurantName,
                          getOrderItemsPayload(),
                          orderUrgent
                        )}
                        onClick={() => handleRecordOrder('email')}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
                        title={`Enviar pedido por e-mail para ${activeSupplierForOrder.email}`}
                      >
                        <Mail className="w-4 h-4" />
                        <span>Enviar E-mail</span>
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Impressão / PDF Simplificado do Pedido */}
      <PrintOrderModal
        order={printingOrder}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintingOrder(null);
        }}
        companyName={restaurantName}
        supplier={suppliers.find((s) => s.id === printingOrder?.supplierId)}
      />
    </div>
  );
};
