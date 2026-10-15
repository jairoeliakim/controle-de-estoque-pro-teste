import React, { useState } from 'react';
import {
  Lock,
  AlertOctagon,
  QrCode,
  CreditCard,
  Copy,
  Check,
  RefreshCw,
  MessageCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Receipt,
  Building2,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useBilling } from '../../context/BillingContext';
import { formatCurrency } from '../../utils/formatters';
import { UserRole, canAccessBilling } from '../../types';

interface BillingOverduePaywallProps {
  currentRole?: UserRole;
}

export const BillingOverduePaywall: React.FC<BillingOverduePaywallProps> = ({ currentRole }) => {
  const { billingStatus, payInvoice, refreshBillingStatus, setIsSimulationOpen } = useBilling();
  const [activeTab, setActiveTab] = useState<'pix' | 'card'>('pix');
  const [copiedPix, setCopiedPix] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  // Cartão fictício para simulação
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [cardName, setCardName] = useState('RESTAURANTE LTDA');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('•••');

  if (!billingStatus || !billingStatus.isBlocked) {
    return null;
  }

  const { subscription, tenant, pendingInvoice, reason } = billingStatus;
  const isCanceled = subscription.status === 'canceled';

  const amount = pendingInvoice?.amount || 189.9;
  const invoiceId = pendingInvoice?.gateway_invoice_id || 'FAT-89218-GW';
  const dueDateFormatted = pendingInvoice?.due_date
    ? new Date(pendingInvoice.due_date).toLocaleDateString('pt-BR')
    : 'Ontem';

  const pixCode =
    pendingInvoice?.pix_copia_cola ||
    '00020126580014br.gov.bcb.pix0136987e6543-b21a-34d5-c789-9876543210005204000053039865405189.905802BR5925SaaS Controle de Estoque6009Sao Paulo62070503***6304WXYZ';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleConfirmPay = async (method: 'pix' | 'credit_card') => {
    setIsVerifying(true);
    setPaymentSuccessMessage(null);

    const res = await payInvoice(pendingInvoice?.id, method);
    setIsVerifying(false);

    if (res.success) {
      setPaymentSuccessMessage(res.message);
      // O estado é atualizado e o componente será desmontado automaticamente quando o status for 'active'
    }
  };

  return (
    <div
      id="billing-paywall-screen"
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-3xl bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-red-950 via-red-900/90 to-red-950 border-b border-red-500/30 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0 shadow-inner">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-300 bg-red-500/30 px-2.5 py-0.5 rounded border border-red-500/50">
                  {isCanceled ? 'Assinatura Cancelada' : 'Acesso Bloqueado por Inadimplência'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {tenant.name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 mt-1">
                {isCanceled
                  ? 'Reative seu plano para continuar operando o estoque'
                  : 'Prazo de tolerância de 5 dias expirado'}
              </h2>
            </div>
          </div>

          {canAccessBilling(currentRole || 'administrador') && (
            <button
              type="button"
              onClick={() => setIsSimulationOpen(true)}
              className="self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950/70 text-amber-300 border border-amber-500/40 hover:bg-slate-950 transition-all flex items-center gap-1.5"
              title="Abrir Painel de Simulação SaaS (Exclusivo Adm e Gerente)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulador SaaS</span>
            </button>
          )}
        </div>

        {/* Message description */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-slate-300">
                {isCanceled
                  ? 'A sua assinatura foi desativada. Seus dados de estoque, fornecedores e histórico continuam armazenados em segurança e serão restaurados no momento da reativação.'
                  : 'O acesso às funcionalidades de estoque, conferência e pedidos foi temporariamente restringido devido à pendência financeira da mensalidade.'}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Fatura: <strong className="text-slate-200">{invoiceId}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Vencimento: <strong className="text-red-400">{dueDateFormatted}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  ID Cliente: <strong className="text-slate-300">{tenant.gateway_customer_id}</strong>
                </span>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-right shrink-0">
              <span className="text-xs text-slate-400 block">Total a Regularizar</span>
              <span className="text-2xl font-black text-red-400">
                {formatCurrency(amount)}
              </span>
            </div>
          </div>

          {/* Payment Method Tabs (Exclusivo Administrador e Gerente) */}
          {!canAccessBilling(currentRole || 'administrador') ? (
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-amber-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">
                  Acesso à Regularização Financeira Restrito
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Somente o <strong>Administrador</strong> e o <strong>Gerente</strong> têm autorização para acessar os dados de cobrança, faturas pendentes e realizar pagamentos (PIX / Cartão).
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
                <span>Perfil conectado:</span>
                <span className="font-bold text-amber-400 capitalize">{currentRole}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Por favor, solicite ao seu gerente ou administrador a regularização do plano para desbloquear o estoque.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
            <div className="flex border-b border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('pix')}
                className={`flex items-center gap-2 pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'pix'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>PIX Instantâneo (Liberação Automática)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                  Imediato
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`flex items-center gap-2 pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'card'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Cartão de Crédito</span>
              </button>
            </div>

            {/* TAB: PIX */}
            {activeTab === 'pix' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                {/* Visual QR Code Box */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-lg border border-slate-200">
                  <div className="w-44 h-44 bg-white p-2 flex flex-col items-center justify-center relative">
                    {/* SVG Stylized QR Code */}
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full text-slate-900 fill-current"
                      aria-label="QR Code PIX"
                    >
                      {/* Standard QR finder patterns */}
                      <rect x="5" y="5" width="28" height="28" fill="#0f172a" />
                      <rect x="9" y="9" width="20" height="20" fill="#ffffff" />
                      <rect x="13" y="13" width="12" height="12" fill="#0f172a" />

                      <rect x="67" y="5" width="28" height="28" fill="#0f172a" />
                      <rect x="71" y="9" width="20" height="20" fill="#ffffff" />
                      <rect x="75" y="13" width="12" height="12" fill="#0f172a" />

                      <rect x="5" y="67" width="28" height="28" fill="#0f172a" />
                      <rect x="9" y="71" width="20" height="20" fill="#ffffff" />
                      <rect x="13" y="75" width="12" height="12" fill="#0f172a" />

                      {/* Random realistic QR grid dots */}
                      <rect x="38" y="8" width="8" height="8" fill="#0f172a" />
                      <rect x="50" y="12" width="6" height="6" fill="#0f172a" />
                      <rect x="40" y="24" width="16" height="6" fill="#0f172a" />
                      <rect x="8" y="40" width="8" height="8" fill="#0f172a" />
                      <rect x="22" y="44" width="8" height="8" fill="#0f172a" />
                      <rect x="36" y="38" width="26" height="26" fill="#0f172a" />
                      <rect x="42" y="44" width="14" height="14" fill="#ffffff" />
                      <rect x="46" y="48" width="6" height="6" fill="#10b981" />
                      <rect x="68" y="40" width="8" height="8" fill="#0f172a" />
                      <rect x="80" y="46" width="12" height="6" fill="#0f172a" />
                      <rect x="38" y="70" width="8" height="14" fill="#0f172a" />
                      <rect x="52" y="76" width="18" height="8" fill="#0f172a" />
                      <rect x="74" y="72" width="16" height="16" fill="#0f172a" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 mt-2">
                    Abra o app do banco e aponte a câmera
                  </span>
                </div>

                {/* PIX Copia e Cola & Confirm */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Código PIX Copia e Cola
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={pixCode}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pr-24 text-xs font-mono text-slate-300 truncate focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-200">
                      ⚡ Conciliação por Webhook Automático:
                    </p>
                    <p>
                      Assim que o PIX for pago, o gateway enviará o evento <code className="text-emerald-400 font-mono">payment_succeeded</code> e a liberação acontecerá em menos de 10 segundos.
                    </p>
                  </div>

                  {/* Manual trigger / verify button */}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleConfirmPay('pix')}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Verificando baixa com o gateway...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>Confirmar Pagamento Realizado (Baixa Instantânea)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: CARTÃO */}
            {activeTab === 'card' && (
              <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Número do Cartão
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Titular do Cartão
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Validade
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-emerald-500 outline-none text-center"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        CVV
                      </label>
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-emerald-500 outline-none text-center"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleConfirmPay('credit_card')}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Processando cobrança no gateway...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pagar {formatCurrency(amount)} e Desbloquear</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

          {/* Feedback message */}
          {paymentSuccessMessage && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{paymentSuccessMessage}</span>
            </div>
          )}

          {/* Bottom Support contacts */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Dúvidas ou precisa de boleto faturado?</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://wa.me/5511987654321?text=Olá,%20preciso%20de%20ajuda%20com%20a%20minha%20assinatura%20do%20SaaS%20de%20Estoque"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp do Suporte</span>
              </a>
              <button
                type="button"
                onClick={() => refreshBillingStatus()}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Status</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
