import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  QrCode,
  CreditCard,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { useBilling } from '../../context/BillingContext';
import { formatCurrency } from '../../utils/formatters';

export const BillingGracePeriodBanner: React.FC = () => {
  const { billingStatus, payInvoice, setIsBillingModalOpen, setIsSimulationOpen, refreshBillingStatus } = useBilling();
  const [copiedPix, setCopiedPix] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  if (!billingStatus || !billingStatus.inGracePeriod) {
    return null;
  }

  const { daysLeftInGrace, subscription, pendingInvoice } = billingStatus;
  const graceEndDate = subscription.grace_period_end
    ? new Date(subscription.grace_period_end).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'em breve';

  const amount = pendingInvoice?.amount || 189.9;
  const pixCode =
    pendingInvoice?.pix_copia_cola ||
    '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304ABCD';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleSimulateQuickPay = async () => {
    setIsPaying(true);
    const res = await payInvoice(pendingInvoice?.id, 'pix');
    setIsPaying(false);
    if (res.success) {
      setPaySuccess(true);
      setTimeout(() => setPaySuccess(false), 4000);
    }
  };

  return (
    <div
      id="billing-grace-period-banner"
      className="bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/40 text-amber-100 shadow-xl transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Tolerância de Atraso (Dunning)</span>
              </span>
              <span className="text-xs font-bold text-slate-200">
                Fatura de {formatCurrency(amount)} pendente
              </span>
              <span className="text-xs text-amber-400 font-bold bg-slate-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                Bloqueio em {daysLeftInGrace} dia{daysLeftInGrace !== 1 ? 's' : ''} ({graceEndDate})
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90 max-w-2xl leading-tight">
              O acesso ao estoque continua liberado temporariamente. Efetue a regularização antes do término do prazo para evitar o corte do sistema.
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {paySuccess ? (
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pagamento Confirmado!</span>
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCopyPix}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950/80 hover:bg-slate-900 text-amber-300 border border-amber-500/40 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Copiar código PIX Copia e Cola"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPix ? 'PIX Copiado!' : 'Copiar PIX'}</span>
              </button>

              <button
                type="button"
                disabled={isPaying}
                onClick={handleSimulateQuickPay}
                className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                title="Pagar fatura instantaneamente"
              >
                {isPaying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <QrCode className="w-3.5 h-3.5" />
                )}
                <span>{isPaying ? 'Processando...' : 'Regularizar Agora'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBillingModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/30 transition-all flex items-center gap-1"
                title="Ver detalhes da assinatura e opções de pagamento"
              >
                <span>Detalhes</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsSimulationOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-900/60 transition-all"
            title="Abrir Painel de Simulação SaaS"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
