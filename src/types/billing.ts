// SaaS Billing & Subscription Types
// Spec: Multi-tenant recurring subscriptions, automated billing, dunning (grace period) & access control

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export type InvoiceStatus = 'pending' | 'paid' | 'failed' | 'canceled';

export interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  currency: string;
  features: string[];
  maxItems?: number;
  maxUsers?: number;
  supportLevel: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  cnpj?: string;
  phone?: string;
  gateway_customer_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  gateway_subscription_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_end: string; // ISO date string (ex: '2026-10-20T00:00:00.000Z')
  grace_period_end: string | null; // ISO date string or null if not past_due
  created_at: string;
  updated_at: string;
  canceled_at?: string | null;
  cancel_reason?: string | null;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  tenant_id: string;
  gateway_invoice_id: string;
  amount: number;
  status: InvoiceStatus;
  payment_url: string;
  pix_qrcode_base64?: string;
  pix_copia_cola?: string;
  due_date: string; // ISO date
  paid_at?: string | null;
  payment_method?: 'pix' | 'credit_card' | 'boleto';
  pdf_url?: string;
  created_at: string;
  attempt_count?: number;
  failure_reason?: string;
}

export interface SubscriptionCheckResult {
  allowed: boolean;
  status: SubscriptionStatus;
  inGracePeriod: boolean;
  daysLeftInGrace: number;
  isBlocked: boolean;
  reason?: 'ACTIVE' | 'TRIALING' | 'IN_GRACE_PERIOD' | 'GRACE_PERIOD_EXPIRED' | 'CANCELED';
  message: string;
  subscription: Subscription;
  tenant: Tenant;
  pendingInvoice?: Invoice | null;
}

export type WebhookGatewayType = 'asaas' | 'stripe' | 'mercadopago' | 'generic';

export interface WebhookEventPayload {
  event: 
    | 'payment_succeeded' 
    | 'payment_failed' 
    | 'subscription_canceled'
    | 'invoice.paid'
    | 'invoice.payment_failed'
    | 'customer.subscription.deleted'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_OVERDUE';
  gateway: WebhookGatewayType;
  data: {
    customerId?: string;
    subscriptionId?: string;
    invoiceId?: string;
    amount?: number;
    paymentUrl?: string;
    dueDate?: string;
    paidAt?: string;
    failureReason?: string;
    raw?: any;
  };
  timestamp?: string;
}

export interface DunningNotificationLog {
  id: string;
  tenant_id: string;
  subscription_id: string;
  invoice_id: string;
  type: 'email' | 'whatsapp' | 'in_app';
  subject: string;
  message: string;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed';
}
