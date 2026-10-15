import React, { useState } from 'react';
import {
  Layers,
  Search,
  PlusCircle,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  MapPin,
  Tag,
  Lock,
} from 'lucide-react';
import { StockItem, Supplier, UserRole, canChangeCountSchedule, canRegisterEntities } from '../types';
import {
  formatCurrency,
  formatDateBR,
  formatQuantity,
  getCategoryLabel,
  getStockHealth,
} from '../utils/formatters';

interface ItemsCatalogViewProps {
  items: StockItem[];
  suppliers: Supplier[];
  onOpenNewItemModal: () => void;
  onEditItem: (item: StockItem) => void;
  onDeleteItem: (id: string) => void;
  currentRole: UserRole;
  onOpenScheduleModal?: () => void;
}

export const ItemsCatalogView: React.FC<ItemsCatalogViewProps> = ({
  items,
  suppliers,
  onOpenNewItemModal,
  onEditItem,
  onDeleteItem,
  currentRole,
  onOpenScheduleModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const canRegister = canRegisterEntities(currentRole);
  const canEditSchedule = canChangeCountSchedule(currentRole);

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'todos' && item.category !== selectedCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.location?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Catálogo & Parâmetros de Estoque
              </span>
              <span className="text-xs text-slate-400">Nível Administrador / Gerente</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-100 mt-2">
              Itens Cadastrados, Limites Mínimos & Dias de Contagem
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Gerencie a base de produtos do restaurante, configure os limites mínimos de disparo para compras, custos de aquisição e dias pré-definidos de contagem (ex: Quarta e Domingo).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditSchedule && onOpenScheduleModal && (
              <button
                onClick={onOpenScheduleModal}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Configurar Dias de Contagem</span>
              </button>
            )}

            {canRegister ? (
              <button
                onClick={onOpenNewItemModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Adicionar Novo Item</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Modo Leitura (Conferente)</span>
              </div>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'todos', label: 'Todos os Itens' },
              { id: 'porcionamento', label: 'Porcionamentos' },
              { id: 'petisco', label: 'Porções & Petiscos' },
              { id: 'consumo', label: 'Consumo & Embalagens' },
            ].map((tab) => (
              <button
                key={tab.id}
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

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Código / Item</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Estoque Atual</th>
                <th className="p-3.5">Mínimo / Ideal</th>
                <th className="p-3.5">Custo Unitário</th>
                <th className="p-3.5">Dias de Contagem</th>
                <th className="p-3.5">Fornecedor Principal</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredItems.map((item) => {
                const health = getStockHealth(item);
                const supplier = suppliers.find((s) => s.id === item.primarySupplierId);

                return (
                  <tr key={item.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono text-[11px] font-bold text-amber-400 block">
                        {item.code}
                      </span>
                      <span className="font-bold text-slate-100 text-sm">{item.name}</span>
                      {item.location && (
                        <span className="text-[11px] text-slate-500 block flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {item.location}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                        {getCategoryLabel(item.category)}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <strong className="text-sm font-bold text-slate-100">
                        {formatQuantity(item.currentStock, item.unit)}
                      </strong>
                      <span className={`block text-[10px] font-medium mt-0.5 px-1.5 py-0.2 rounded w-max ${health.badgeClass}`}>
                        {health.label}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="text-slate-300">
                        Mín: <strong className="text-rose-400">{formatQuantity(item.minStock, item.unit)}</strong>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Ideal: {formatQuantity(item.optimalStock, item.unit)}
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-slate-200 font-bold">
                      {formatCurrency(item.costPrice)} / {item.unit}
                    </td>

                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.countDays.map((d, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold capitalize"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="font-semibold text-slate-200 block truncate max-w-xs">
                        {supplier?.name || 'Não vinculado'}
                      </span>
                      {supplier && (
                        <span className="text-[11px] font-mono text-emerald-400 block">
                          {supplier.phone}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canRegister ? (
                          <>
                            <button
                              onClick={() => onEditItem(item)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                              title="Editar item"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteItem(item.id)}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-all"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Leitura</span>
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
    </div>
  );
};
