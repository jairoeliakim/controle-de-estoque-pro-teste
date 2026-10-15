import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  AlertCircle,
  FileQuestion,
  Sparkles,
  ArrowRight,
  PlusCircle,
  X,
  Shield,
  Building2,
  DollarSign,
} from 'lucide-react';
import {
  ItemCategory,
  StockItem,
  Supplier,
  UnlistedCountItem,
  UserRole,
  canApproveUnlistedCount,
} from '../types';
import { formatCurrency, formatQuantity, getCategoryLabel } from '../utils/formatters';

interface UnlistedItemsApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlistedItems: UnlistedCountItem[];
  suppliers: Supplier[];
  companyName: string;
  currentRole: UserRole;
  onApproveItem: (
    unlistedItem: UnlistedCountItem,
    finalStockItem: Omit<StockItem, 'id'>
  ) => void;
  onRejectItem: (unlistedItemId: string, reason: string) => void;
}

export const UnlistedItemsApprovalModal: React.FC<UnlistedItemsApprovalModalProps> = ({
  isOpen,
  onClose,
  unlistedItems,
  suppliers,
  companyName,
  currentRole,
  onApproveItem,
  onRejectItem,
}) => {
  const [selectedItem, setSelectedItem] = useState<UnlistedCountItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Approval customization form
  const [costPrice, setCostPrice] = useState('10.00');
  const [minStock, setMinStock] = useState('5');
  const [reorderPoint, setReorderPoint] = useState('10');
  const [optimalStock, setOptimalStock] = useState('20');
  const [primarySupplierId, setPrimarySupplierId] = useState(suppliers[0]?.id || '');
  const [itemCode, setItemCode] = useState('');

  if (!isOpen) return null;

  const canApprove = canApproveUnlistedCount(currentRole);
  const pendingItems = unlistedItems.filter((i) => i.status === 'pendente');

  const handleStartApprove = (item: UnlistedCountItem) => {
    setSelectedItem(item);
    setIsRejecting(false);
    setItemCode(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
    setMinStock(String(Math.max(1, Math.round(item.quantity * 0.5))));
    setReorderPoint(String(Math.max(2, Math.round(item.quantity * 1))));
    setOptimalStock(String(Math.max(4, Math.round(item.quantity * 2))));
    setCostPrice('15.00');
    setPrimarySupplierId(suppliers[0]?.id || '');
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const newStockItem: Omit<StockItem, 'id'> = {
      name: selectedItem.name,
      code: itemCode.trim() || `PRD-${Date.now().toString().slice(-4)}`,
      category: selectedItem.category,
      unit: selectedItem.unit,
      currentStock: selectedItem.quantity,
      minStock: parseFloat(minStock) || 5,
      reorderPoint: parseFloat(reorderPoint) || 10,
      optimalStock: parseFloat(optimalStock) || 20,
      costPrice: parseFloat(costPrice) || 10,
      primarySupplierId: primarySupplierId || suppliers[0]?.id || 'sup-1',
      countDays: ['quarta', 'domingo'],
      lastCountDate: new Date().toISOString().split('T')[0],
      lastCountBy: selectedItem.recordedBy,
      currentBatchExpiry: selectedItem.expiryDate,
      location: selectedItem.location,
    };

    onApproveItem(selectedItem, newStockItem);
    setSelectedItem(null);
  };

  const handleConfirmRejection = () => {
    if (!selectedItem) return;
    onRejectItem(selectedItem.id, rejectionReason || 'Rejeitado pela Gerência/Compras');
    setSelectedItem(null);
    setIsRejecting(false);
    setRejectionReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Aprovação de Produtos Não Cadastrados
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  {pendingItems.length} {pendingItems.length === 1 ? 'pendente' : 'pendentes'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Itens encontrados fisicamente pelo conferente aguardando validação de Compras ou Gerência.
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

        <div className="p-6">
          {selectedItem ? (
            /* Modal interno de Aprovação/Rejeição */
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    {isRejecting ? 'Rejeitar Item da Contagem' : 'Aprovar e Integrar ao Estoque'}
                  </span>
                  <h4 className="text-base font-bold text-slate-100 mt-0.5">
                    {selectedItem.name}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Voltar à lista
                </button>
              </div>

              {isRejecting ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Ao rejeitar este item, a contagem não será integrada ao catálogo oficial e o registro será arquivado.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Motivo da Rejeição / Observação
                    </label>
                    <textarea
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ex: Item devolvido ao fornecedor / Pertence a evento particular / Descarte por violação."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRejection}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors"
                    >
                      Confirmar Rejeição
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulário de integração ao catálogo */
                <form onSubmit={handleConfirmApproval} className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Qtd Contada:</span>
                      <strong className="text-emerald-400 font-bold text-sm">
                        {formatQuantity(selectedItem.quantity, selectedItem.unit)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Categoria:</span>
                      <span className="text-slate-300 font-medium">
                        {getCategoryLabel(selectedItem.category)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Local:</span>
                      <span className="text-slate-300 font-medium">
                        {selectedItem.location || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Anotado por:</span>
                      <span className="text-slate-300 font-medium">
                        {selectedItem.recordedBy}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Código do Produto
                      </label>
                      <input
                        type="text"
                        required
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Custo Unitário Estimado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={costPrice}
                        onChange={(e) => setCostPrice(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Fornecedor Padrão
                      </label>
                      <select
                        value={primarySupplierId}
                        onChange={(e) => setPrimarySupplierId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      >
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Estoque Mínimo (Alerta)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Ponto de Reposição
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={reorderPoint}
                        onChange={(e) => setReorderPoint(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Estoque Alvo (Ideal)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={optimalStock}
                        onChange={(e) => setOptimalStock(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
                    >
                      Rejeitar Item
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprovar & Cadastrar no Catálogo</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Lista de Itens Pendentes */
            <div className="space-y-3">
              {pendingItems.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-200">
                    Nenhum Item Avulso Pendente
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Todas as anotações feitas por conferentes durante a contagem física foram validadas ou não há divergências pendentes no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 hover:bg-slate-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-100 text-sm">
                            {item.name}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="text-emerald-400 font-bold">
                            Contado: {formatQuantity(item.quantity, item.unit)}
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {item.location}
                            </span>
                          )}
                          {item.expiryDate && (
                            <span>Validade: {new Date(item.expiryDate).toLocaleDateString('pt-BR')}</span>
                          )}
                          <span>Anotado por: {item.recordedBy}</span>
                        </div>

                        {item.observations && (
                          <p className="text-xs text-slate-400/90 italic bg-slate-850 px-2 py-1 rounded border border-slate-800 mt-1">
                            Obs: "{item.observations}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setIsRejecting(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                        >
                          Rejeitar
                        </button>
                        <button
                          onClick={() => handleStartApprove(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-sm active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Validar & Cadastrar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>
              Aprovação autorizada para: <strong>Gerente</strong> e <strong>Compras</strong>.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
