import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Invoice, Plan, SubscriptionCheckResult, SubscriptionStatus } from '../types/billing';

interface BillingContextType {
  billingStatus: SubscriptionCheckResult | null;
  isLoading: boolean;
  error: string | null;
  plans: Plan[];
  invoicesHistory: Invoice[];
  isSimulationOpen: boolean;
  setIsSimulationOpen: (open: boolean) => void;
  isBillingModalOpen: boolean;
  setIsBillingModalOpen: (open: boolean) => void;
  refreshBillingStatus: () => Promise<void>;
  payInvoice: (invoiceId?: string, method?: 'pix' | 'credit_card') => Promise<{ success: boolean; message: string }>;
  setScenario: (scenario: 'active' | 'grace_period' | 'blocked' | 'canceled') => Promise<void>;
  triggerSimulatedWebhook: (eventType: string, failureReason?: string) => Promise<void>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [billingStatus, setBillingStatus] = useState<SubscriptionCheckResult | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoicesHistory, setInvoicesHistory] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSimulationOpen, setIsSimulationOpen] = useState<boolean>(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState<boolean>(false);

  // Carrega status da assinatura da API
  const refreshBillingStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/billing/status?tenantId=tenant-restaurante-01');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: SubscriptionCheckResult = await res.json();
      setBillingStatus(data);

      // Busca histórico de faturas
      const invRes = await fetch('/api/billing/invoices?tenantId=tenant-restaurante-01');
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoicesHistory(invData.invoices || []);
      }
    } catch (err: any) {
      console.warn('Fallback para mock local se o endpoint backend estiver inicializando:', err);
      // Fallback gracioso caso dev server ainda esteja inicializando
      if (!billingStatus) {
        const fallbackStatus: SubscriptionCheckResult = {
          allowed: true,
          status: 'active',
          inGracePeriod: false,
          daysLeftInGrace: 0,
          isBlocked: false,
          reason: 'ACTIVE',
          message: 'Assinatura ativa e em dia.',
          subscription: {
            id: 'sub-demo-local',
            tenant_id: 'tenant-restaurante-01',
            gateway_subscription_id: 'sub_gw_demo',
            plan_id: 'plano-pro',
            status: 'active',
            current_period_end: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            grace_period_end: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          tenant: {
            id: 'tenant-restaurante-01',
            name: 'Desenvolvimento de Software',
            email: 'financeiro@restaurantedemo.com.br',
            gateway_customer_id: 'cus_demo',
            created_at: new Date().toISOString(),
          },
        };
        setBillingStatus(fallbackStatus);
      }
    } finally {
      setIsLoading(false);
    }
  }, [billingStatus]);

  // Carrega planos na montagem
  useEffect(() => {
    refreshBillingStatus();

    fetch('/api/billing/plans')
      .then((r) => r.json())
      .then((d) => {
        if (d.plans) setPlans(d.plans);
      })
      .catch(() => {});
  }, []);

  // Liquidar Fatura / Pagar
  const payInvoice = async (invoiceId?: string, method: 'pix' | 'credit_card' = 'pix') => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/billing/pay-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-restaurante-01',
          invoiceId,
          paymentMethod: method,
        }),
      });

      const data = await res.json();
      await refreshBillingStatus();
      return { success: true, message: data.message || 'Pagamento confirmado!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao processar pagamento' };
    } finally {
      setIsLoading(false);
    }
  };

  // Alternar Cenários de Simulação
  const setScenario = async (scenario: 'active' | 'grace_period' | 'blocked' | 'canceled') => {
    try {
      setIsLoading(true);
      await fetch('/api/billing/simulate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      await refreshBillingStatus();
    } catch (err) {
      console.error('Erro ao definir cenário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Disparar Webhook Simulado
  const triggerSimulatedWebhook = async (eventType: string, failureReason?: string) => {
    try {
      setIsLoading(true);
      await fetch('/api/billing/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, failureReason }),
      });
      await refreshBillingStatus();
    } catch (err) {
      console.error('Erro ao disparar webhook simulado:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BillingContext.Provider
      value={{
        billingStatus,
        isLoading,
        error,
        plans,
        invoicesHistory,
        isSimulationOpen,
        setIsSimulationOpen,
        isBillingModalOpen,
        setIsBillingModalOpen,
        refreshBillingStatus,
        payInvoice,
        setScenario,
        triggerSimulatedWebhook,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
};
