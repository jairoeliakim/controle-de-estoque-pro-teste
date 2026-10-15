import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, LogOut, AlertTriangle } from 'lucide-react';
import { UserRole } from '../types';
import { ActiveTab } from './Navigation';

interface AccessDeniedViewProps {
  attemptedTab: ActiveTab;
  currentRole: UserRole;
  onNavigateToAllowed: () => void;
  onLogout?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  attemptedTab,
  currentRole,
  onNavigateToAllowed,
  onLogout,
}) => {
  const tabNames: Record<ActiveTab, string> = {
    estoque: 'Estoque Geral & Saldos',
    contagem: 'Contagem de Estoque',
    compras: 'Compras & Reposição de Fornecedores',
    orcamento: 'Orçamentos & Cotações',
    notas: 'Entrada de Notas Fiscais (NF-e / QR Code)',
    perdas: 'Perdas & Auditoria de CMV',
    dashboard: 'Dashboard Mensal Executivo',
    catalogo: 'Catálogo & Parâmetros do Sistema',
  };

  const roleLabels: Record<UserRole, string> = {
    conferente: 'Conferente de Estoque',
    compras: 'Setor de Compras',
    gerente: 'Gerente Geral',
    administrador: 'Administrador do Sistema',
  };

  const moduleName = tabNames[attemptedTab] || attemptedTab;
  const roleName = roleLabels[currentRole] || currentRole;

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-4 sm:px-6 text-center animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-rose-950/40 relative overflow-hidden backdrop-blur-md">
        {/* Ambient background glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Icon Badge */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400 animate-pulse" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Acesso Restrito / Não Permitido</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Acesso Não Permitido
            </h2>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              O perfil de <strong className="text-emerald-400 font-semibold">{roleName}</strong> possui permissão estritamente restrita à <strong>Contagem de Estoque</strong> e não possui autorização para acessar módulos de níveis superiores.
            </p>
          </div>

          {/* Security audit detail box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Auditoria de Segurança & Governança (RBAC)</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">HTTP 403 Forbidden</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[11px]">Módulo Solicitado:</span>
                <span className="font-bold text-slate-200">{moduleName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Seu Nível Atual:</span>
                <span className="font-bold text-emerald-400">{roleName}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal pt-1">
              Os módulos executivos, financeiros, cotações de compras e parametrizações são restritos à Gerência e Diretoria.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              id="btn-return-allowed-view"
              onClick={onNavigateToAllowed}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Contagem de Estoque</span>
            </button>

            {onLogout && (
              <button
                type="button"
                id="btn-access-denied-logout"
                onClick={onLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>Trocar de Usuário</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
