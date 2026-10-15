import React, { useState } from 'react';
import {
  Flame,
  Scale,
  DollarSign,
  AlertOctagon,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { ItemCategory, LossReason, LossRecord, StockItem, StockUnit } from '../types';
import { formatCurrency, formatQuantity, getLossReasonLabel, getSectorLabel } from '../utils/formatters';

interface LossRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StockItem[];
  onSaveLoss: (loss: Omit<LossRecord, 'id' | 'timestamp'>) => void;
  defaultReporter?: string;
}

export const LossRegisterModal: React.FC<LossRegisterModalProps> = ({
  isOpen,
  onClose,
  items,
  onSaveLoss,
  defaultReporter = 'Thiago Fritadeira',
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(items[4]?.id || items[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(0.85); // Default example matching prompt: 0.85 kg batata
  const [reason, setReason] = useState<LossReason>('queimou');
  const [sector, setSector] = useState<
    'cozinha_quente' | 'fritadeira' | 'pre_preparo' | 'bar' | 'salao' | 'camara_fria' | 'estoque_seco'
  >('fritadeira');
  const [reportedBy, setReportedBy] = useState<string>(defaultReporter);
  const [notes, setNotes] = useState<string>('Batata frita queimou na fritadeira durante o pico.');

  if (!isOpen) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0];
  const unitCost = selectedItem?.costPrice || 0;
  const calculatedTotalCost = quantity * unitCost;

  // Preset quick buttons for instant fast kitchen entry
  const presets = [
    {
      label: 'Batata frita queimou',
      itemId: items.find((i) => i.name.toLowerCase().includes('batata'))?.id || selectedItemId,
      qty: 0.85,
      reason: 'queimou' as LossReason,
      sector: 'fritadeira' as const,
      notes: 'Batata frita queimou por alta temperatura na fritadeira.',
    },
    {
      label: 'Carne venceu / estragou',
      itemId: items.find((i) => i.category === 'porcionamento')?.id || selectedItemId,
      qty: 0.5,
      reason: 'venceu' as LossReason,
      sector: 'camara_fria' as const,
      notes: 'Produto ultrapassou a data limite de consumo interno.',
    },
    {
      label: 'Hambúrguer / Prato derrubado',
      itemId: items.find((i) => i.name.toLowerCase().includes('hambúrguer'))?.id || selectedItemId,
      qty: 2,
      reason: 'derrubado_danificado' as LossReason,
      sector: 'cozinha_quente' as const,
      notes: 'Item caiu no chão durante o empratamento.',
    },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    if (p.itemId) setSelectedItemId(p.itemId);
    setQuantity(p.qty);
    setReason(p.reason);
    setSector(p.sector);
    setNotes(p.notes);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || quantity <= 0) return;

    onSaveLoss({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      category: selectedItem.category,
      quantity,
      unit: selectedItem.unit,
      unitCost,
      totalCost: calculatedTotalCost,
      reason,
      sector,
      reportedBy,
      notes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-rose-500/40 shadow-2xl shadow-rose-950/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-rose-950/40 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Anotar Perda & Descarte de Alimento
              </h3>
              <p className="text-xs text-slate-400">
                Pese o produto descartado e registre para monitorar o CMV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Quick Presets */}
        <div className="px-5 pt-4 pb-1">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Lançamento Rápido com 1 Clique:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 active:scale-95 transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Select Item */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Item / Produto do Estoque
            </label>
            <select
              id="select-loss-item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.unit}) - Custo: {formatCurrency(it.costPrice)}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity and Calculated Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                Quantidade ou Peso Pesado ({selectedItem?.unit || 'kg'})
              </label>
              <input
                id="input-loss-quantity"
                type="number"
                step={selectedItem?.unit === 'kg' || selectedItem?.unit === 'l' ? '0.01' : '1'}
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-slate-100 focus:outline-none focus:border-rose-500"
                placeholder="Ex: 0.85"
                required
              />
            </div>

            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col justify-center">
              <span className="text-[11px] text-rose-300 font-medium">Prejuízo Financeiro Estimado:</span>
              <span className="text-lg font-extrabold text-rose-400 font-mono">
                {formatCurrency(calculatedTotalCost)}
              </span>
            </div>
          </div>

          {/* Reason and Sector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo da Perda
              </label>
              <select
                id="select-loss-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as LossReason)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="queimou">Queimou no preparo / fritura</option>
                <option value="venceu">Venceu no estoque / câmara</option>
                <option value="derrubado_danificado">Derrubado / Caiu no chão</option>
                <option value="erro_preparo">Erro de preparo / montagem</option>
                <option value="descongelamento_inadequado">Descongelamento incorreto</option>
                <option value="contaminacao">Contaminação cruzada</option>
                <option value="sobra_descarte">Sobra de prato / devolução</option>
                <option value="outro">Outro motivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Setor / Área da Cozinha
              </label>
              <select
                id="select-loss-sector"
                value={sector}
                onChange={(e) => setSector(e.target.value as any)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="fritadeira">Fritadeiras / Chapa</option>
                <option value="cozinha_quente">Cozinha Quente / Fogão</option>
                <option value="pre_preparo">Pré-preparo / Cortes</option>
                <option value="bar">Bar & Bebidas</option>
                <option value="camara_fria">Câmara Fria / Freezers</option>
                <option value="estoque_seco">Estoque Seco</option>
                <option value="salao">Salão</option>
              </select>
            </div>
          </div>

          {/* Reporter & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Funcionário / Responsável
              </label>
              <input
                id="input-loss-reporter"
                type="text"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="Ex: Thiago Fritadeira"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observação / Detalhes
              </label>
              <input
                id="input-loss-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="Ex: Batata frita queimou..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300"
            >
              Cancelar
            </button>
            <button
              id="btn-submit-loss"
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/25 active:scale-95 flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Registrar Perda no CMV</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
