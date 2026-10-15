import React from 'react';
import {
  Boxes,
  ClipboardCheck,
  ShoppingCart,
  TrendingDown,
  BarChart3,
  Layers,
  AlertCircle,
  QrCode,
  Calculator,
} from 'lucide-react';
import { UserRole, isTabAllowedForRole } from '../types';

export type ActiveTab = 'estoque' | 'contagem' | 'compras' | 'orcamento' | 'notas' | 'perdas' | 'dashboard' | 'catalogo';

interface NavigationProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  currentRole: UserRole;
  criticalCount: number;
  attentionCount: number;
  lossesCountMonth: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  currentRole,
  criticalCount,
  attentionCount,
  lossesCountMonth,
}) => {
  const tabs: {
    id: ActiveTab;
    label: string;
    description: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
    highlightRole?: UserRole[];
  }[] = [
    {
      id: 'estoque',
      label: 'Estoque Geral',
      description: 'Saldos em tempo real, valores e fornecedores vinculados',
      icon: <Boxes className="w-4 h-4" />,
      badge: criticalCount > 0 ? `${criticalCount} crítico${criticalCount > 1 ? 's' : ''}` : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
      highlightRole: ['gerente', 'administrador', 'compras'],
    },
    {
      id: 'contagem',
      label: 'Contagem de Estoque',
      description: 'Caminho Funcionário / Conferente',
      icon: <ClipboardCheck className="w-4 h-4" />,
      highlightRole: ['conferente'],
    },
    {
      id: 'compras',
      label: 'Compras & Reposição',
      description: 'Caminho Comprador / Proprietário',
      icon: <ShoppingCart className="w-4 h-4" />,
      badge: criticalCount + attentionCount > 0 ? `${criticalCount + attentionCount}` : undefined,
      badgeColor: criticalCount > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950',
      highlightRole: ['compras'],
    },
    {
      id: 'orcamento',
      label: 'Orçamento & Cotações',
      description: 'Agrupamento de compras por variedade',
      icon: <Calculator className="w-4 h-4" />,
      highlightRole: ['compras', 'gerente'],
    },
    {
      id: 'notas',
      label: 'Entrada NF-e / QR Code',
      description: 'Leitor e importador de notas fiscais',
      icon: <QrCode className="w-4 h-4" />,
      highlightRole: ['compras', 'gerente'],
    },
    {
      id: 'perdas',
      label: 'Perdas & Análise CMV',
      description: 'Quebras, queimas & descarte',
      icon: <TrendingDown className="w-4 h-4" />,
      badge: lossesCountMonth > 0 ? `${lossesCountMonth}` : undefined,
      badgeColor: 'bg-rose-500/30 text-rose-300 border border-rose-500/40',
      highlightRole: ['gerente'],
    },
    {
      id: 'dashboard',
      label: 'Dashboard Mensal',
      description: 'Gráficos e indicadores',
      icon: <BarChart3 className="w-4 h-4" />,
      highlightRole: ['gerente', 'administrador'],
    },
    {
      id: 'catalogo',
      label: 'Catálogo & Estoque',
      description: 'Itens, limites e configurações',
      icon: <Layers className="w-4 h-4" />,
      highlightRole: ['administrador'],
    },
  ];

  // Filtrar abas permitidas: usuário do tipo conferente não pode ver os acessos superiores
  const visibleTabs = tabs.filter((tab) => isTabAllowedForRole(tab.id, currentRole));

  return (
    <nav className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isRoleFocus = tab.highlightRole?.includes(currentRole);

            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap relative group ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <span className={isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-400'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>

                {isRoleFocus && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Aba principal do seu perfil" />
                )}

                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      isActive ? 'bg-slate-950 text-amber-400' : tab.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
