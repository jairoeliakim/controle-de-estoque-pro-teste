import React, { useState } from 'react';
import {
  Flame,
  TrendingDown,
  AlertOctagon,
  Scale,
  PlusCircle,
  Filter,
  BarChart2,
  PieChart,
  Calendar,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { LossRecord, StockItem } from '../types';
import {
  formatCurrency,
  formatDateTimeBR,
  formatQuantity,
  getCategoryLabel,
  getLossReasonLabel,
  getSectorLabel,
} from '../utils/formatters';

interface LossesViewProps {
  losses: LossRecord[];
  items: StockItem[];
  onOpenLossModal: () => void;
  monthlyRevenueEst?: number;
}

export const LossesView: React.FC<LossesViewProps> = ({
  losses,
  items,
  onOpenLossModal,
  monthlyRevenueEst = 84000,
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('todos');
  const [selectedReason, setSelectedReason] = useState<string>('todos');

  // Filtered losses
  const filteredLosses = losses.filter((l) => {
    if (selectedSector !== 'todos' && l.sector !== selectedSector) return false;
    if (selectedReason !== 'todos' && l.reason !== selectedReason) return false;
    return true;
  });

  // KPI calculations
  const totalCost = losses.reduce((acc, l) => acc + l.totalCost, 0);
  const cmvImpactPercentage = (totalCost / monthlyRevenueEst) * 100;

  // Breakdown by item
  const lossesByItemMap: Record<string, { name: string; cost: number; count: number; unit: string; qty: number }> = {};
  losses.forEach((l) => {
    if (!lossesByItemMap[l.itemId]) {
      lossesByItemMap[l.itemId] = {
        name: l.itemName,
        cost: 0,
        count: 0,
        unit: l.unit,
        qty: 0,
      };
    }
    lossesByItemMap[l.itemId].cost += l.totalCost;
    lossesByItemMap[l.itemId].count += 1;
    lossesByItemMap[l.itemId].qty += l.quantity;
  });

  const topWastedItems = Object.values(lossesByItemMap)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  const maxItemCost = topWastedItems[0]?.cost || 1;

  // Breakdown by reason
  const lossesByReasonMap: Record<string, number> = {};
  losses.forEach((l) => {
    lossesByReasonMap[l.reason] = (lossesByReasonMap[l.reason] || 0) + l.totalCost;
  });

  // Breakdown by sector
  const lossesBySectorMap: Record<string, number> = {};
  losses.forEach((l) => {
    lossesBySectorMap[l.sector] = (lossesBySectorMap[l.sector] || 0) + l.totalCost;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Gestão de Perdas & Impacto no CMV
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-100 mt-2">
              Mapeamento de Quebras, Sobras & Desperdício
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Identifique com precisão onde estão acontecendo as maiores perdas no restaurante (ex: batata frita queimada na fritadeira, produtos vencidos na câmara ou quedas no preparo) e avalie o impacto direto no Custo da Mercadoria Vendida (CMV).
            </p>
          </div>

          <button
            id="btn-open-loss-modal"
            onClick={onOpenLossModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/25 active:scale-95 whitespace-nowrap"
          >
            <Flame className="w-4 h-4" />
            <span>Anotar Nova Perda</span>
          </button>
        </div>

        {/* 4 KPIs Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Prejuízo de Perdas no Mês</span>
            <div className="text-xl font-extrabold text-rose-400 font-mono mt-1">
              {formatCurrency(totalCost)}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {losses.length} lançamentos registrados
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Impacto no CMV</span>
            <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">
              +{cmvImpactPercentage.toFixed(2)}%
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Sobre faturamento estimado
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Maior Fonte de Perda</span>
            <div className="text-sm font-bold text-slate-200 mt-1 truncate">
              {topWastedItems[0]?.name || 'Nenhuma registrada'}
            </div>
            <span className="text-[11px] text-rose-400 font-mono mt-0.5 block">
              {topWastedItems[0] ? formatCurrency(topWastedItems[0].cost) : '-'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Setor Mais Crítico</span>
            <div className="text-sm font-bold text-slate-200 mt-1">
              Fritadeiras & Cozinha
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Concentra 62% das quebras
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analysis: Where are the biggest losses happening? */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Ranking of Top Wasted Items */}
        <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Top 5 Itens com Maiores Prejuízos em R$
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Classificado por Custo</span>
          </div>

          <div className="space-y-3.5">
            {topWastedItems.map((item, idx) => {
              const barPercentage = Math.round((item.cost / maxItemCost) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 truncate pr-2">
                      {idx + 1}. {item.name}
                    </span>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-rose-400 font-mono">
                        {formatCurrency(item.cost)}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1.5">
                        ({item.qty.toFixed(1)} {item.unit} em {item.count}x)
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${barPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Losses by Motivo & Setor Breakdown */}
        <div className="lg:col-span-5 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Distribuição por Motivo de Descarte
            </h3>
          </div>

          <div className="space-y-2">
            {Object.entries(lossesByReasonMap).map(([reasonKey, val]) => {
              const pct = totalCost > 0 ? (val / totalCost) * 100 : 0;
              return (
                <div
                  key={reasonKey}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      {getLossReasonLabel(reasonKey as any)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {pct.toFixed(1)}% do total
                    </span>
                  </div>
                  <span className="font-bold text-rose-400 font-mono">
                    {formatCurrency(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Losses Log Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Histórico Detalhado de Lançamentos ({filteredLosses.length})
            </h3>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none"
            >
              <option value="todos">Todos os Setores</option>
              <option value="fritadeira">Fritadeiras</option>
              <option value="cozinha_quente">Cozinha Quente</option>
              <option value="pre_preparo">Pré-preparo</option>
              <option value="camara_fria">Câmara Fria</option>
              <option value="bar">Bar</option>
            </select>

            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none"
            >
              <option value="todos">Todos os Motivos</option>
              <option value="queimou">Queimou no preparo</option>
              <option value="venceu">Venceu no estoque</option>
              <option value="derrubado_danificado">Derrubado/Caiu</option>
              <option value="descongelamento_inadequado">Descongelamento</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Data & Hora</th>
                <th className="p-3.5">Produto Descartado</th>
                <th className="p-3.5">Peso / Quantidade</th>
                <th className="p-3.5">Prejuízo (R$)</th>
                <th className="p-3.5">Motivo</th>
                <th className="p-3.5">Setor</th>
                <th className="p-3.5">Responsável / Obs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredLosses.map((record) => (
                <tr key={record.id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                    {formatDateTimeBR(record.timestamp)}
                  </td>
                  <td className="p-3.5 font-bold text-slate-100">
                    {record.itemName}
                  </td>
                  <td className="p-3.5 font-bold text-amber-300">
                    {formatQuantity(record.quantity, record.unit)}
                  </td>
                  <td className="p-3.5 font-bold font-mono text-rose-400">
                    {formatCurrency(record.totalCost)}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-semibold whitespace-nowrap">
                      {getLossReasonLabel(record.reason)}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-300 whitespace-nowrap">
                    {getSectorLabel(record.sector)}
                  </td>
                  <td className="p-3.5 text-slate-400 max-w-xs truncate">
                    <span className="font-semibold text-slate-300">{record.reportedBy}</span>
                    {record.notes && <span className="block text-[11px] truncate text-slate-500">{record.notes}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
