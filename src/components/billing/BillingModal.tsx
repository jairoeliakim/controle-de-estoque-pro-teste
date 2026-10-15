import React, { useState } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Calendar,
  Building2,
  Clock,
  ExternalLink,
  Lock,
  QrCode,
  Download,
  ShieldCheck,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { useBilling } from '../../context/BillingContext';
import { formatCurrency } from '../../utils/formatters';
import { UserRole, canAccessBilling } from '../../types';

interface BillingModalProps {
  currentRole?: UserRole;
}

export const BillingModal: React.FC<BillingModalProps> = ({ currentRole }) => {
  const {
    billingStatus,
    plans,
    invoicesHistory,
    isBillingModalOpen,
    setIsBillingModalOpen,
    payInvoice,
    setIsSimulationOpen,
  } = useBilling();

  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  if (!isBillingModalOpen || !billingStatus) return null;

  // Somente o adm e gerente tem acesso a assinatura
  if (currentRole && !canAccessBilling(currentRole)) {
    return (
      <div
        id="billing-access-denied-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div className="bg-slate-900 border border-amber-500/40 w-full max-w-md rounded-2xl shadow-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wide">
              <Lock className="w-3 h-3" />
              <span>Acesso Restrito: Adm & Gerente</span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Gestão de Assinatura Bloqueada
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Somente o <strong>Administrador</strong> e o <strong>Gerente</strong> têm autorização para visualizar dados financeiros, faturas, meios de pagamento e planos da assinatura SaaS.
            </p>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Seu perfil ativo:</span>
            <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">{currentRole}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsBillingModalOpen(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs transition-all border border-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const { subscription, tenant, pendingInvoice } = billingStatus;
  const currentPlan = plans.find((p) => p.id === subscription.plan_id) || plans[1] || {
    id: 'plano-pro',
    name: 'Pro Gastronomia & CMV',
    priceMonthly: 189.9,
    features: ['Itens ilimitados', 'NF-e e QR Code', 'Gestão de CMV'],
  };

  const periodEndFormatted = new Date(subscription.current_period_end).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handlePay = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    await payInvoice(invoiceId, 'pix');
    setPayingInvoiceId(null);
  };

  return (
    <div
      id="billing-management-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Assinatura & Faturamento</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {tenant.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Adm & Gerente
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie a mensalidade recorrente, visualize faturas e comprovantes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsBillingModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Plan Summary Card */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  Plano Contratado
                </span>
                {subscription.status === 'active' && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ativo</span>
                  </span>
                )}
                {subscription.status === 'past_due' && (
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Em Atraso</span>
                  </span>
                )}
                {subscription.status === 'canceled' && (
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Cancelado</span>
                  </span>
                )}
              </div>
              <h4 className="text-xl font-black text-slate-100">{currentPlan.name}</h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Próxima Renovação: <strong className="text-slate-200">{periodEndFormatted}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  ID Gateway: <strong className="text-slate-300">{subscription.gateway_subscription_id}</strong>
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-right shrink-0">
              <span className="text-xs text-slate-400 block">Mensalidade</span>
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-black text-emerald-400">
                  {formatCurrency(currentPlan.priceMonthly)}
                </span>
                <span className="text-xs text-slate-500">/mês</span>
              </div>
            </div>
          </div>

          {/* Pending Invoice Callout if any */}
          {pendingInvoice && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-amber-200">
                    Fatura Aberta com Vencimento Próximo
                  </h5>
                  <p className="text-xs text-amber-300/80">
                    Valor: {formatCurrency(pendingInvoice.amount)} • Vencimento: {new Date(pendingInvoice.due_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={payingInvoiceId === pendingInvoice.id}
                onClick={() => handlePay(pendingInvoice.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all self-end sm:self-auto disabled:opacity-50"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{payingInvoiceId === pendingInvoice.id ? 'Baixando...' : 'Pagar via PIX'}</span>
              </button>
            </div>
          )}

          {/* Invoices History Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-slate-400" />
              <span>Histórico de Faturas & Comprovantes</span>
            </h4>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3">Identificador</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invoicesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">
                        Nenhuma fatura encontrada.
                      </td>
                    </tr>
                  ) : (
                    invoicesHistory.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-slate-300 font-medium">
                          {inv.gateway_invoice_id || inv.id}
                        </td>
                        <td className="p-3 text-slate-300">
                          {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3 font-bold text-slate-100">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="p-3">
                          {inv.status === 'paid' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Paga
                            </span>
                          )}
                          {(inv.status === 'pending' || inv.status === 'failed') && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Pendente
                            </span>
                          )}
                          {inv.status === 'canceled' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                              Cancelada
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {inv.status === 'paid' ? (
                            <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Liquidada</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePay(inv.id)}
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all"
                            >
                              Pagar PIX
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={() => {
              setIsBillingModalOpen(false);
              setIsSimulationOpen(true);
            }}
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Abrir Painel de Simulação</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBillingModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
