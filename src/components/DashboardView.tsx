import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Percent,
  Sparkles,
} from 'lucide-react';
import { MonthlyPerformance, StockItem, LossRecord } from '../types';
import { formatCurrency } from '../utils/formatters';

interface DashboardViewProps {
  monthlyData: MonthlyPerformance[];
  items: StockItem[];
  losses: LossRecord[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  monthlyData,
  items,
  losses,
}) => {
  const safeMonthlyData = monthlyData && monthlyData.length > 0 ? monthlyData : [
    {
      month: 'Mês Atual',
      cmvPercentage: 28.5,
      cmvTarget: 29.0,
      totalPurchases: 0,
      totalSales: 0,
      totalLosses: 0,
      countAccuracy: 100,
      inventoryTurnover: 0,
      categories: {},
    }
  ];

  const [activeMonthIndex, setActiveMonthIndex] = useState<number>(safeMonthlyData.length - 1);
  const activeMonth = safeMonthlyData[activeMonthIndex] || safeMonthlyData[0];

  // Total stock value in warehouse
  const totalStockValue = items.reduce((acc, i) => acc + i.currentStock * i.costPrice, 0);

  // Stock value by category
  const categoryStockValues = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.currentStock * item.costPrice;
    return acc;
  }, {} as Record<string, number>);

  const categoryLabels: Record<string, string> = {
    porcionamento: 'Porcionamentos & Carnes',
    petisco: 'Porções & Petiscos',
    consumo: 'Itens de Consumo',
    bebida: 'Bebidas & Bar',
    limpeza: 'Higiene & Limpeza',
  };

  // SVG Chart Dimensions
  const chartHeight = 180;
  const chartWidth = 560;

  // CMV line chart calculations
  const minCmv = 27;
  const maxCmv = 33;
  const getY = (val: number) => {
    return chartHeight - ((val - minCmv) / (maxCmv - minCmv)) * (chartHeight - 30) - 15;
  };

  const cmvPoints = safeMonthlyData.map((d, idx) => {
    const x = safeMonthlyData.length > 1 ? 40 + idx * ((chartWidth - 80) / (safeMonthlyData.length - 1)) : chartWidth / 2;
    const y = getY(d.cmvPercentage);
    return { x, y, data: d };
  });

  const pathD = cmvPoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const targetY = getY(29.0);

  // Max purchases for bar chart
  const maxPurchases = Math.max(...safeMonthlyData.map((d) => d.totalPurchases), 40000);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                Inteligência Gerencial & Indicadores
              </span>
              <span className="text-xs text-slate-400">Dashboard Mensal</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-100 mt-2">
              Desempenho Financeiro, CMV & Giro de Estoque
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Acompanhe a curva de Custo da Mercadoria Vendida (CMV), a evolução de compras mensais, o valor imobilizado em estoque e o impacto direto das perdas na margem líquida.
            </p>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar className="w-4 h-4 text-amber-400" />
            <select
              value={activeMonthIndex}
              onChange={(e) => setActiveMonthIndex(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
            >
              {safeMonthlyData.map((m, idx) => (
                <option key={idx} value={idx} className="bg-slate-900 text-slate-200">
                  {m.month}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Essential KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Valor Total em Estoque</span>
            <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">
              {formatCurrency(totalStockValue)}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {items.length} itens cadastrados
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">CMV Real do Mês</span>
            <div className="text-xl font-extrabold text-slate-100 font-mono mt-1 flex items-center gap-1.5">
              <span>{activeMonth.cmvPercentage.toFixed(1)}%</span>
              <span className={`text-xs px-1.5 py-0.2 rounded font-semibold ${
                activeMonth.cmvPercentage <= activeMonth.cmvTarget
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}>
                Meta: {activeMonth.cmvTarget}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Custo da Mercadoria Vendida
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Compras Faturadas</span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
              {formatCurrency(activeMonth.totalPurchases)}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Pedidos de reposição atendidos
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Acurácia de Contagem</span>
            <div className="text-xl font-extrabold text-blue-400 font-mono mt-1">
              {activeMonth.countAccuracy}%
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Conformidade Quartas & Domingos
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Chart 1: CMV Trend Line Chart */}
        <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                Evolução Mensal do CMV (%) vs Meta
              </h3>
              <p className="text-[11px] text-slate-400">
                Histórico dos últimos 6 meses com linha de corte em 29.0%
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <span className="w-3 h-1 bg-amber-400 rounded-full" />
                CMV Real
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-3 h-0.5 border-t border-dashed border-emerald-400" />
                Meta (29%)
              </span>
            </div>
          </div>

          {/* Responsive SVG */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-48 select-none"
            >
              {/* Grid Lines */}
              {[28, 29, 30, 31, 32].map((lvl) => {
                const y = getY(lvl);
                return (
                  <g key={lvl}>
                    <line
                      x1="30"
                      y1={y}
                      x2={chartWidth - 20}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    <text
                      x="10"
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {lvl}%
                    </text>
                  </g>
                );
              })}

              {/* Target Line (29%) */}
              <line
                x1="35"
                y1={targetY}
                x2={chartWidth - 20}
                y2={targetY}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.7"
              />

              {/* CMV Gradient Area */}
              <defs>
                <linearGradient id="cmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <path
                d={`${pathD} L ${cmvPoints[cmvPoints.length - 1].x} ${chartHeight - 15} L ${cmvPoints[0].x} ${chartHeight - 15} Z`}
                fill="url(#cmvGrad)"
              />

              {/* Main Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dots and Labels */}
              {cmvPoints.map((pt, idx) => {
                const isSelected = activeMonthIndex === idx;
                return (
                  <g key={idx} className="cursor-pointer" onClick={() => setActiveMonthIndex(idx)}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? '#f59e0b' : '#0f172a'}
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                    {/* Value label */}
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      fill="#f1f5f9"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {pt.data.cmvPercentage.toFixed(1)}%
                    </text>
                    {/* Month label */}
                    <text
                      x={pt.x}
                      y={chartHeight - 2}
                      fill={isSelected ? '#f59e0b' : '#94a3b8'}
                      fontSize="10"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {pt.data.shortMonth}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Chart 2: Compras vs Perdas por Mês */}
        <div className="lg:col-span-5 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Volume de Compras por Mês
              </h3>
              <p className="text-[11px] text-slate-400">
                Total de aquisições de reposição
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {formatCurrency(activeMonth.totalPurchases)}
            </span>
          </div>

          {/* Bar comparison */}
          <div className="space-y-2.5">
            {safeMonthlyData.map((m, idx) => {
              const widthPct = Math.round((m.totalPurchases / maxPurchases) * 100);
              const isSelected = activeMonthIndex === idx;

              return (
                <div
                  key={idx}
                  onClick={() => setActiveMonthIndex(idx)}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isSelected ? 'bg-slate-800/80 border border-slate-700' : 'hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-slate-300'}`}>
                      {m.month}
                    </span>
                    <span className="font-mono text-slate-300 font-bold">
                      {formatCurrency(m.totalPurchases)}
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSelected ? 'bg-amber-400' : 'bg-emerald-500/70'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stock Value by Category Breakdown */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Distribuição do Valor em Estoque por Grupo de Itens
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total Imobilizado: <strong className="text-amber-400">{formatCurrency(totalStockValue)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(categoryStockValues).map(([catKey, val]) => {
            const pct = totalStockValue > 0 ? (val / totalStockValue) * 100 : 0;
            return (
              <div
                key={catKey}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block truncate">
                    {categoryLabels[catKey] || catKey}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                    {pct.toFixed(1)}% do estoque total
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100 font-mono">
                    {formatCurrency(val)}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
