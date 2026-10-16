import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lock,
  XCircle,
  Zap,
  Activity,
  Bell,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building,
  Terminal,
} from 'lucide-react';
import { useBilling } from '../../context/BillingContext';

export const BillingSimulationDrawer: React.FC = () => {
  const {
    billingStatus,
    isSimulationOpen,
    setIsSimulationOpen,
    setScenario,
    triggerSimulatedWebhook,
    refreshBillingStatus,
    isLoading,
  } = useBilling();

  const [dunningLogs, setDunningLogs] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'scenarios' | 'webhooks' | 'logs'>('scenarios');
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/billing/dunning-logs');
      if (res.ok) {
        const data = await res.json();
        setDunningLogs(data.logs || []);
        setWebhookLogs(data.webhooks || []);
      }
    } catch (err) {
      console.warn('Erro ao carregar logs:', err);
    }
  };

  useEffect(() => {
    if (isSimulationOpen) {
      fetchLogs();
    }
  }, [isSimulationOpen]);

  if (!isSimulationOpen) return null;

  const currentStatus = billingStatus?.status || 'active';
  const inGrace = billingStatus?.inGracePeriod;
  const isBlocked = billingStatus?.isBlocked;

  const handleApplyScenario = async (scenario: 'active' | 'grace_period' | 'blocked' | 'canceled') => {
    await setScenario(scenario);
    await fetchLogs();
    setLastActionMessage(`Cenário alterado para: ${scenario.toUpperCase()}`);
    setTimeout(() => setLastActionMessage(null), 3000);
  };

  const handleFireWebhook = async (eventType: string, failureReason?: string) => {
    await triggerSimulatedWebhook(eventType, failureReason);
    await fetchLogs();
    setLastActionMessage(`Webhook disparado: ${eventType}`);
    setTimeout(() => setLastActionMessage(null), 3000);
  };

  return (
    <div
      id="billing-simulation-drawer"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-amber-500/40 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 p-4 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                <span>Simulador SaaS & Arquitetura de Cobrança</span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                  DEV TOOL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Alterne os estados de assinatura, dispare webhooks e teste as regras de bloqueio e carência
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSimulationOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Pill Bar */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Estado Atual:</span>
            {currentStatus === 'active' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ativo (Livre)</span>
              </span>
            )}
            {currentStatus === 'past_due' && inGrace && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Em Carência ({billingStatus?.daysLeftInGrace} dias restantes)</span>
              </span>
            )}
            {currentStatus === 'past_due' && !inGrace && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Bloqueado (Paywall Ativo)</span>
              </span>
            )}
            {currentStatus === 'canceled' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancelado</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => refreshBillingStatus()}
            className="text-slate-400 hover:text-amber-300 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Recarregar API</span>
          </button>
        </div>

        {/* Action feedback */}
        {lastActionMessage && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-1.5 text-xs text-amber-300 font-medium animate-in fade-in">
            {lastActionMessage}
          </div>
        )}

        {/* Tab selection */}
        <div className="flex border-b border-slate-800 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('scenarios')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'scenarios'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Cenários Pré-configurados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'webhooks'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Testar Webhooks do Gateway
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('logs');
              fetchLogs();
            }}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'logs'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Régua de Cobrança & Logs
          </button>
        </div>

        {/* Content area */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: CENÁRIOS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Selecione um cenário para simular instantaneamente o comportamento do sistema e as interfaces do usuário:
              </p>

              {/* Scenario 1: Active */}
              <div
                onClick={() => handleApplyScenario('active')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  currentStatus === 'active'
                    ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">
                      Cenário A: Assinatura Ativa (Normal)
                    </h4>
                    {currentStatus === 'active' && (
                      <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-1.5 rounded">
                        Ativo Agora
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assinatura em dia, próximo ciclo em +30 dias. Nenhum alerta exibido, acesso 100% liberado a todas as rotas e funcionalidades.
                  </p>
                </div>
              </div>

              {/* Scenario 2: In Grace */}
              <div
                onClick={() => handleApplyScenario('grace_period')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  currentStatus === 'past_due' && inGrace
                    ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">
                      Cenário B: Atraso dentro da Tolerância (Grace Period / Dunning)
                    </h4>
                    {currentStatus === 'past_due' && inGrace && (
                      <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 rounded">
                        Ativo Agora
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Fatura atrasada há 2 dias. Faltam 3 dias de tolerância antes do corte. Injeta o banner amarelo de alerta no topo com botão direto para PIX Copia e Cola.
                  </p>
                </div>
              </div>

              {/* Scenario 3: Blocked Paywall */}
              <div
                onClick={() => handleApplyScenario('blocked')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  currentStatus === 'past_due' && isBlocked
                    ? 'bg-red-950/40 border-red-500/60 ring-1 ring-red-500/40'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">
                      Cenário C: Inadimplente Bloqueado (Paywall / Tolerância Expirada)
                    </h4>
                    {currentStatus === 'past_due' && isBlocked && (
                      <span className="text-[10px] bg-red-500 text-slate-950 font-bold px-1.5 rounded">
                        Ativo Agora
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Atrasado há mais de 5 dias (tolerância esgotada). O middleware backend bloqueia requisições com HTTP 402 e o frontend renderiza a tela cheia de Paywall.
                  </p>
                </div>
              </div>

              {/* Scenario 4: Canceled */}
              <div
                onClick={() => handleApplyScenario('canceled')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  currentStatus === 'canceled'
                    ? 'bg-slate-800/60 border-slate-600 ring-1 ring-slate-500'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">
                      Cenário D: Assinatura Cancelada
                    </h4>
                    {currentStatus === 'canceled' && (
                      <span className="text-[10px] bg-slate-600 text-slate-100 font-bold px-1.5 rounded">
                        Ativo Agora
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assinatura desativada. Bloqueia o acesso solicitando a reativação do plano.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Endpoint de Webhook Ativo:</span>
                  <code className="text-amber-300 font-mono text-[11px]">POST /api/webhooks/payment</code>
                </p>
                <p>
                  Dispare os eventos sintéticos enviados pelos gateways (Asaas, Stripe, Mercado Pago) para verificar o ciclo de vida e a transição de estados:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleFireWebhook('payment_succeeded')}
                  className="p-3 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 rounded-xl text-left space-y-1 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      payment_succeeded
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 group-hover:text-slate-300">
                    Ativa assinatura, estende +30 dias e remove carência.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleFireWebhook('payment_failed', 'Cartão recusado por limite')}
                  className="p-3 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 text-amber-200 rounded-xl text-left space-y-1 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      payment_failed
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 group-hover:text-slate-300">
                    Muda para past_due e define tolerância de 5 dias.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleFireWebhook('subscription_canceled')}
                  className="p-3 bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-200 rounded-xl text-left space-y-1 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                      subscription_canceled
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 group-hover:text-slate-300">
                    Muda status para canceled e bloqueia o acesso.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LOGS & DUNNING */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>Régua de Cobrança (Notificações de Dunning Disparadas)</span>
                </h4>
                {dunningLogs.length === 0 ? (
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                    Nenhuma notificação de inadimplência disparada ainda.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dunningLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-bold text-amber-400 uppercase">
                            Canal: {log.type}
                          </span>
                          <span>{new Date(log.sent_at).toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <p className="font-semibold text-slate-200 text-[11px]">{log.subject}</p>
                        <p className="text-[11px] text-slate-400 font-mono leading-tight">
                          {log.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Histórico de Eventos de Webhook Recebidos</span>
                </h4>
                {webhookLogs.length === 0 ? (
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                    Nenhum webhook recebido recentemente.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
                    {webhookLogs.map((wh) => (
                      <div
                        key={wh.id}
                        className="p-2 bg-slate-950/90 border border-slate-800 rounded flex items-center justify-between"
                      >
                        <span className="text-emerald-400 font-bold">{wh.event}</span>
                        <span className="text-slate-500 text-[10px]">{wh.gateway}</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(wh.receivedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Tenant: <strong className="text-slate-300">Desenvolvimento de Software</strong></span>
          <button
            type="button"
            onClick={() => setIsSimulationOpen(false)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
