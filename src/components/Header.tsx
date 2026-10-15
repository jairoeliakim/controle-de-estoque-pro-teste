import React from 'react';
import {
  Shield,
  UserCheck,
  Briefcase,
  ShoppingCart,
  Calendar,
  AlertTriangle,
  Flame,
  PlusCircle,
  Truck,
  Settings,
  QrCode,
  CreditCard,
  Sparkles,
  Database,
  Building2,
  Users,
  FileQuestion,
  Sun,
  Moon,
} from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { useTheme } from '../context/ThemeContext';
import {
  CountDay,
  UserRole,
  canChangeCountSchedule,
  canImportInvoices,
  canRegisterEntities,
  canViewSuppliers,
  canAccessBilling,
  canAccessApiAndDatabase,
  canManageCompanies,
  canManageEmployees,
  canApproveUnlistedCount,
  canAccessSystemSettings,
  AuthUser,
} from '../types';
import { Sliders, LogOut } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  criticalCount: number;
  attentionCount: number;
  onOpenLossModal: () => void;
  onOpenNewItemModal: () => void;
  onOpenSuppliersModal: () => void;
  onOpenScheduleModal: () => void;
  onOpenInvoiceImporter?: () => void;
  onOpenApiWorkbench?: () => void;
  onOpenSystemSettings?: () => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  defaultCountDays: CountDay[];
  activeCompanyName?: string;
  onOpenCompanyModal?: () => void;
  onOpenEmployeesModal?: () => void;
  pendingUnlistedCount?: number;
  onOpenUnlistedApprovalModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onSelectRole,
  criticalCount,
  attentionCount,
  onOpenLossModal,
  onOpenNewItemModal,
  onOpenSuppliersModal,
  onOpenScheduleModal,
  onOpenInvoiceImporter,
  onOpenApiWorkbench,
  onOpenSystemSettings,
  authUser,
  onLogout,
  defaultCountDays,
  activeCompanyName = 'Restaurante & Bar Gourmet',
  onOpenCompanyModal,
  onOpenEmployeesModal,
  pendingUnlistedCount = 0,
  onOpenUnlistedApprovalModal,
}) => {
  const dayIndexMap: Record<number, CountDay> = {
    0: 'domingo',
    1: 'segunda',
    2: 'terca',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sabado',
  };
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dayLabelsMap: Record<CountDay, string> = {
    domingo: 'Domingo',
    segunda: 'Segunda-feira',
    terca: 'Terça-feira',
    quarta: 'Quarta-feira',
    quinta: 'Quinta-feira',
    sexta: 'Sexta-feira',
    sabado: 'Sábado',
  };

  const { setIsBillingModalOpen, setIsSimulationOpen, billingStatus } = useBilling();
  const { theme, toggleTheme } = useTheme();

  const today = new Date();
  const dayOfWeekNumber = today.getDay();
  const currentDayKey = dayIndexMap[dayOfWeekNumber];
  const isScheduledCountDay = defaultCountDays.includes(currentDayKey);
  const currentDayName = dayNames[dayOfWeekNumber];

  const formattedDefaultDays = defaultCountDays
    .map((d) => dayLabelsMap[d])
    .join(' e ');

  const rolesConfig: Record<
    UserRole,
    { title: string; desc: string; icon: React.ReactNode; color: string; badge: string }
  > = {
    administrador: {
      title: 'Administrador',
      desc: 'Acesso total a todos os módulos e parâmetros',
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
    conferente: {
      title: 'Conferente',
      desc: 'Foco na contagem física, validade e envio',
      icon: <UserCheck className="w-4 h-4 text-emerald-400" />,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    gerente: {
      title: 'Gerente',
      desc: 'Acompanhamento do CMV, perdas e auditoria',
      icon: <Briefcase className="w-4 h-4 text-blue-400" />,
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    },
    compras: {
      title: 'Compras',
      desc: 'Reposição, fornecedores e envio WhatsApp/E-mail',
      icon: <ShoppingCart className="w-4 h-4 text-amber-400" />,
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 gap-4">
          
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300/30">
              <span className="font-extrabold text-slate-950 text-xl tracking-tight">CE</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Controle de Estoque & CMV
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                  Restaurante Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentDayName}, {today.toLocaleDateString('pt-BR')}</span>
                <span className="text-slate-600">•</span>
                {isScheduledCountDay ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/15 px-1.5 py-0.2 rounded text-[11px] border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Dia oficial de contagem!
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">
                    Dias padrão: <strong className="text-slate-300 font-medium">{formattedDefaultDays}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions & Role Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Loss button (Perdas - Batata queimou) - Apenas perfis com permissão gerencial */}
            {currentRole !== 'conferente' && (
              <button
                id="btn-quick-loss"
                onClick={onOpenLossModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-all shadow-sm active:scale-95"
                title="Registrar perda de alimento ou descarte"
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Anotar Perda</span>
              </button>
            )}

            {/* Gerente & Administrador: Configuração dos Dias Padrão de Contagem */}
            {canChangeCountSchedule(currentRole) && (
              <button
                id="btn-schedule-modal"
                onClick={onOpenScheduleModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all active:scale-95"
                title="Alterar dias padrão de contagem (Exclusivo Gerente e ADM)"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Dias de Contagem</span>
              </button>
            )}

            {/* Troca e Gestão de Empresas / Filiais (Administrador) */}
            {canManageCompanies(currentRole) && onOpenCompanyModal && (
              <button
                id="btn-open-companies-modal"
                onClick={onOpenCompanyModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all shadow-sm active:scale-95"
                title="Administrador: Cadastrar empresas e transitar entre filiais para suporte"
              >
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <span className="max-w-[130px] truncate">{activeCompanyName}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/25 text-purple-200 border border-purple-500/40">
                  Filial
                </span>
              </button>
            )}

            {/* Gestão de Funcionários (Gerente e Administrador) */}
            {canManageEmployees(currentRole) && onOpenEmployeesModal && (
              <button
                id="btn-open-employees-modal"
                onClick={onOpenEmployeesModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-all active:scale-95 shadow-sm"
                title="Quadro de funcionários: Gerente, Compras e Conferente (Bloqueio / Exclusão de Gerente restrito)"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Funcionários</span>
              </button>
            )}

            {/* Aprovação de Itens Avulsos (Compras e Gerente) */}
            {canApproveUnlistedCount(currentRole) && onOpenUnlistedApprovalModal && pendingUnlistedCount > 0 && (
              <button
                id="btn-open-unlisted-approval"
                onClick={onOpenUnlistedApprovalModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all active:scale-95 animate-pulse shadow-sm"
                title="Itens não cadastrados anotados pelo conferente aguardando aprovação"
              >
                <FileQuestion className="w-3.5 h-3.5 text-amber-400" />
                <span>{pendingUnlistedCount} Avulso{pendingUnlistedCount > 1 ? 's' : ''}</span>
              </button>
            )}

            {/* Fornecedores: Compras, Gerente e Administrador */}
            {canViewSuppliers(currentRole) && (
              <button
                id="btn-suppliers-modal"
                onClick={onOpenSuppliersModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 hover:text-white transition-all active:scale-95"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Fornecedores</span>
              </button>
            )}

            {/* Cadastro de Itens: Compras, Gerente e Administrador */}
            {canRegisterEntities(currentRole) && (
              <button
                id="btn-add-item-modal"
                onClick={onOpenNewItemModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 hover:text-white transition-all active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Novo Item</span>
              </button>
            )}

            {/* Importador de Nota Fiscal / QR Code */}
            {onOpenInvoiceImporter && canImportInvoices(currentRole) && (
              <button
                id="btn-import-invoice-header"
                onClick={onOpenInvoiceImporter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all active:scale-95 shadow-sm"
                title="Ler chave, QR Code ou XML de Nota Fiscal (NF-e/NFC-e)"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Importar NF-e</span>
              </button>
            )}

            {/* SaaS Billing & Assinatura: Somente Administrador e Gerente */}
            {canAccessBilling(currentRole) && (
              <button
                id="btn-billing-modal"
                onClick={() => setIsBillingModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-sm ${
                  billingStatus?.inGracePeriod
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 animate-pulse'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750'
                }`}
                title="Gerenciar assinatura, faturas e cobrança recorrente (Exclusivo Adm e Gerente)"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Assinatura</span>
                {billingStatus?.inGracePeriod && (
                  <span className="text-[10px] bg-slate-950 text-amber-400 font-bold px-1 rounded">
                    Atraso
                  </span>
                )}
              </button>
            )}

            {/* API REST & DB Workbench Button (Somente Administrador) */}
            {onOpenApiWorkbench && canAccessApiAndDatabase(currentRole) && (
              <button
                id="btn-open-api-workbench"
                onClick={onOpenApiWorkbench}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all active:scale-95 shadow-sm"
                title="Acesso Técnico: API REST, Transações Atômicas e Schema SQL (Exclusivo Administrador)"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">API & Banco 100% Online</span>
                <span className="sm:hidden">API/DB</span>
              </button>
            )}

            {/* Parametrização Sistêmica: Exclusivo Administrador */}
            {onOpenSystemSettings && canAccessSystemSettings(currentRole) && (
              <button
                id="btn-system-settings"
                onClick={onOpenSystemSettings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all active:scale-95 shadow-sm"
                title="Parametrização Sistêmica: Preços desatualizados, dias de contagem e governança (Exclusivo Administrador)"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>Parametrização</span>
              </button>
            )}

            {/* Usuário Autenticado & Logout */}
            {authUser && (
              <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs shadow-inner">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-[11px] shrink-0">
                  {authUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <span className="font-bold text-slate-200 block text-[11px] truncate max-w-[120px]">{authUser.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{authUser.role}</span>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer ml-0.5"
                    title="Encerrar sessão ou trocar acesso individual"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Botão de Alternar Tema (Claro / Escuro) */}
            <button
              id="btn-theme-toggle"
              type="button"
              onClick={toggleTheme}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-sm border ${
                theme === 'dark'
                  ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-750 hover:text-amber-200'
                  : 'bg-slate-100 text-indigo-600 border-slate-300 hover:bg-slate-200/80 hover:text-indigo-700'
              }`}
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              aria-label={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Tema Escuro</span>
                </>
              )}
            </button>

            {/* Nível do Usuário Autenticado */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-inner ${rolesConfig[currentRole]?.badge || 'bg-slate-800 text-slate-300'}`}>
              {rolesConfig[currentRole]?.icon}
              <span>Nível: <strong className="capitalize">{rolesConfig[currentRole]?.title || currentRole}</strong></span>
            </div>

            {/* Critical alert pill */}
            {criticalCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold animate-pulse"
                title={`${criticalCount} itens abaixo do estoque mínimo`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{criticalCount} crítico{criticalCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
