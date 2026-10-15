import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Layers, DollarSign, Calendar, MapPin, Tag, Shield, Lock } from 'lucide-react';
import {
  CountDay,
  ItemCategory,
  StockItem,
  StockUnit,
  Supplier,
  UserRole,
  canChangeCountSchedule,
  canRegisterEntities,
} from '../types';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: StockItem) => void;
  suppliers: Supplier[];
  editingItem?: StockItem | null;
  currentRole: UserRole;
  defaultCountDays: CountDay[];
}

const ALL_WEEK_DAYS: { id: CountDay; label: string; short: string }[] = [
  { id: 'domingo', label: 'Domingo', short: 'Dom' },
  { id: 'segunda', label: 'Segunda', short: 'Seg' },
  { id: 'terca', label: 'Terça', short: 'Ter' },
  { id: 'quarta', label: 'Quarta', short: 'Qua' },
  { id: 'quinta', label: 'Quinta', short: 'Qui' },
  { id: 'sexta', label: 'Sexta', short: 'Sex' },
  { id: 'sabado', label: 'Sábado', short: 'Sáb' },
];

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  suppliers,
  editingItem,
  currentRole,
  defaultCountDays,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<ItemCategory>('porcionamento');
  const [unit, setUnit] = useState<StockUnit>('kg');
  const [currentStock, setCurrentStock] = useState<number>(10);
  const [minStock, setMinStock] = useState<number>(5);
  const [reorderPoint, setReorderPoint] = useState<number>(8);
  const [optimalStock, setOptimalStock] = useState<number>(20);
  const [costPrice, setCostPrice] = useState<number>(15.0);
  const [primarySupplierId, setPrimarySupplierId] = useState<string>('');
  const [countDays, setCountDays] = useState<CountDay[]>(defaultCountDays);
  const [location, setLocation] = useState('');
  const [currentBatchExpiry, setCurrentBatchExpiry] = useState('');

  const canEditSchedule = canChangeCountSchedule(currentRole);
  const canRegister = canRegisterEntities(currentRole);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setCode(editingItem.code);
      setCategory(editingItem.category);
      setUnit(editingItem.unit);
      setCurrentStock(editingItem.currentStock);
      setMinStock(editingItem.minStock);
      setReorderPoint(editingItem.reorderPoint);
      setOptimalStock(editingItem.optimalStock);
      setCostPrice(editingItem.costPrice);
      setPrimarySupplierId(editingItem.primarySupplierId || '');
      setCountDays(editingItem.countDays || defaultCountDays);
      setLocation(editingItem.location || '');
      setCurrentBatchExpiry(editingItem.currentBatchExpiry || '');
    } else {
      setName('');
      setCode(`ITM-${Math.floor(100 + Math.random() * 900)}`);
      setCategory('porcionamento');
      setUnit('kg');
      setCurrentStock(10);
      setMinStock(5);
      setReorderPoint(8);
      setOptimalStock(20);
      setCostPrice(15.0);
      setPrimarySupplierId(suppliers[0]?.id || '');
      setCountDays(defaultCountDays);
      setLocation('');
      setCurrentBatchExpiry('');
    }
  }, [editingItem, suppliers, isOpen, defaultCountDays]);

  if (!isOpen) return null;

  const toggleDay = (day: CountDay) => {
    if (!canEditSchedule) return;
    if (countDays.includes(day)) {
      if (countDays.length === 1) return; // keep at least 1
      setCountDays(countDays.filter((d) => d !== day));
    } else {
      setCountDays([...countDays, day]);
    }
  };

  const handleResetToDefaultSchedule = () => {
    if (!canEditSchedule) return;
    setCountDays(defaultCountDays);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRegister) {
      alert('Apenas Compras, Gerente e Administrador podem cadastrar ou editar itens.');
      return;
    }
    if (!name.trim()) return;

    const item: StockItem = {
      id: editingItem ? editingItem.id : `item-${Date.now()}`,
      name: name.trim(),
      code: code.trim() || `ITM-${Date.now().toString().slice(-4)}`,
      category,
      unit,
      currentStock,
      minStock,
      reorderPoint: reorderPoint || minStock * 1.3,
      optimalStock: optimalStock || minStock * 2,
      costPrice,
      primarySupplierId: primarySupplierId || suppliers[0]?.id || 'sup-1',
      countDays: countDays.length > 0 ? countDays : defaultCountDays,
      location: location.trim(),
      currentBatchExpiry: currentBatchExpiry || undefined,
      lastCountDate: editingItem?.lastCountDate || new Date().toISOString().split('T')[0],
      alternativeSuppliers: editingItem?.alternativeSuppliers,
    };

    onSave(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              {editingItem ? <Edit className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {editingItem ? 'Editar Item do Estoque' : 'Cadastrar Novo Item'}
              </h3>
              <p className="text-xs text-slate-400">
                Defina os limites de reposição, fornecedor e dias de contagem
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Produto / Insumo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Batata Frita Palito Especial"
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Código SKU
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: PET-001"
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Aba / Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="porcionamento">Itens de Porcionamento</option>
                <option value="petisco">Itens de Porções & Petiscos</option>
                <option value="consumo">Itens de Consumo Geral</option>
                <option value="bebida">Bebidas & Bar</option>
                <option value="limpeza">Limpeza & Descartáveis</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unidade de Medida
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as StockUnit)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="kg">Quilograma (kg)</option>
                <option value="g">Gramas (g)</option>
                <option value="un">Unidade (un)</option>
                <option value="pct">Pacote (pct)</option>
                <option value="cx">Caixa (cx)</option>
                <option value="l">Litro (l)</option>
              </select>
            </div>
          </div>

          {/* Stock limits */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Estoque Atual
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-rose-400 mb-1">
                Mínimo (Alerta)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(parseFloat(e.target.value) || 0)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-rose-300 font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                Pto. de Atenção
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(parseFloat(e.target.value) || 0)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-amber-300 font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                Estoque Ideal
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={optimalStock}
                onChange={(e) => setOptimalStock(parseFloat(e.target.value) || 0)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-emerald-300 font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Cost Price & Primary Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custo Unitário de Aquisição (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fornecedor Principal
              </label>
              <select
                value={primarySupplierId}
                onChange={(e) => setPrimarySupplierId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.contactName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pre-defined Count Days */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Dias de Contagem deste Item</span>
                {canEditSchedule ? (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    ADM & Gerente Editável
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    Padrão Estabelecido
                  </span>
                )}
              </label>
              {canEditSchedule && (
                <button
                  type="button"
                  onClick={handleResetToDefaultSchedule}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline"
                >
                  Usar cronograma padrão ({defaultCountDays.length} dias)
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              {canEditSchedule
                ? 'Selecione os dias da semana em que este item deve ser conferido pelo conferente:'
                : 'Definido pelo Gerente / Administrador. Usuários de Compras mantêm os dias preestabelecidos.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {ALL_WEEK_DAYS.map((day) => {
                const isSelected = countDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    disabled={!canEditSchedule}
                    onClick={() => toggleDay(day.id)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all border text-center ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                    } ${!canEditSchedule ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location & Initial Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Localização / Armazenamento
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Freezer 01, Câmara Fria A..."
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data de Validade do Lote Atual
              </label>
              <input
                type="date"
                value={currentBatchExpiry}
                onChange={(e) => setCurrentBatchExpiry(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95"
            >
              {editingItem ? 'Salvar Alterações' : 'Cadastrar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
