import React, { useState } from 'react';
import {
  FileQuestion,
  PlusCircle,
  MapPin,
  Calendar,
  Layers,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ItemCategory, StockUnit, UnlistedCountItem } from '../types';

interface RecordUnlistedItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  conferenteName: string;
  onSaveUnlistedItem: (item: UnlistedCountItem) => void;
}

export const RecordUnlistedItemModal: React.FC<RecordUnlistedItemModalProps> = ({
  isOpen,
  onClose,
  companyId,
  conferenteName,
  onSaveUnlistedItem,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('porcionamento');
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState<StockUnit>('kg');
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('Câmara Fria 01');
  const [observations, setObservations] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const unlistedItem: UnlistedCountItem = {
      id: `unl-${Date.now()}`,
      companyId,
      name: name.trim(),
      category,
      quantity: Math.max(0.01, parseFloat(quantity) || 1),
      unit,
      expiryDate: expiryDate.trim() || undefined,
      location: location.trim() || undefined,
      observations: observations.trim() || undefined,
      recordedBy: conferenteName || 'Conferente',
      recordedAt: new Date().toISOString(),
      status: 'pendente',
    };

    onSaveUnlistedItem(unlistedItem);
    setSuccessNotice(true);
    setTimeout(() => {
      setSuccessNotice(false);
      onClose();
      // Reset form
      setName('');
      setQuantity('1');
      setExpiryDate('');
      setObservations('');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Anotar Produto Fora da Lista
              </h3>
              <p className="text-xs text-slate-400">
                Encontrou um item não cadastrado durante a conferência física?
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

        {successNotice ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-100">
              Item Anotado com Sucesso!
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              A contagem foi enviada para o setor de <strong>Compras</strong> ou <strong>Gerente</strong> aprovar e integrar ao catálogo oficial de estoque.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
              <span>
                Este produto ficará pendente de validação pela Gerência ou Compras para aprovar a contagem e cadastrar o produto no estoque oficial.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome do Produto Encontrado *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Molho Especial Trufado 500g"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ItemCategory)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="porcionamento">Porcionamento (Carnes/Cozinha)</option>
                  <option value="petisco">Petiscos & Congelados</option>
                  <option value="bebida">Bebidas & Bar</option>
                  <option value="consumo">Consumo & Embalagens</option>
                  <option value="limpeza">Limpeza & Químicos</option>
                  <option value="outro">Outro / Geral</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Qtd Contada *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Unidade
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as StockUnit)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Local Onde Foi Encontrado
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Câmara Fria 01, Gaveta 3"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Validade do Lote (Se houver)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Observações do Conferente
              </label>
              <textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Chegou como amostra de fornecedor, sem etiqueta fiscal ou código de barras."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-sm"
              >
                Enviar para Aprovação
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
