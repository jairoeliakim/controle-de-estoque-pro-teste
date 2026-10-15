import { ItemCategory, LossReason, StockItem, StockUnit } from '../types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatQuantity(value: number, unit: StockUnit): string {
  const formatted = formatNumber(value, unit === 'kg' || unit === 'l' ? 3 : 1);
  return `${formatted} ${unit}`;
}

export function formatDateBR(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

export function formatDateTimeBR(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return dateString;
  }
}

export type StockHealthStatus = 'critico' | 'atencao' | 'seguro';

export function getStockHealth(item: StockItem): {
  status: StockHealthStatus;
  label: string;
  badgeClass: string;
  neededToOrder: number;
} {
  const current = item.currentStock;
  const min = item.minStock;
  const reorder = item.reorderPoint || min * 1.3;
  const optimal = item.optimalStock || min * 2;

  if (current <= min) {
    return {
      status: 'critico',
      label: 'Reposição Imediata',
      badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      neededToOrder: Math.max(0, optimal - current),
    };
  } else if (current <= reorder) {
    return {
      status: 'atencao',
      label: 'Necessidade de Atenção',
      badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      neededToOrder: Math.max(0, optimal - current),
    };
  }

  return {
    status: 'seguro',
    label: 'Estoque Seguro',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    neededToOrder: 0,
  };
}

export function checkExpiryStatus(expiryDateStr?: string): {
  status: 'vencido' | 'urgente' | 'alerta' | 'ok';
  label: string;
  daysRemaining: number;
  badgeClass: string;
} {
  if (!expiryDateStr) {
    return {
      status: 'ok',
      label: 'Sem data',
      daysRemaining: 999,
      badgeClass: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      status: 'vencido',
      label: `VENCIDO (${Math.abs(days)}d atrás)`,
      daysRemaining: days,
      badgeClass: 'bg-rose-600/20 text-rose-300 border border-rose-500 font-semibold',
    };
  } else if (days === 0) {
    return {
      status: 'urgente',
      label: 'Vence HOJE',
      daysRemaining: 0,
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500 font-medium',
    };
  } else if (days <= 3) {
    return {
      status: 'urgente',
      label: `Vence em ${days} dia${days > 1 ? 's' : ''}`,
      daysRemaining: days,
      badgeClass: 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-medium',
    };
  } else if (days <= 7) {
    return {
      status: 'alerta',
      label: `Vence em ${days} dias`,
      daysRemaining: days,
      badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    };
  }

  return {
    status: 'ok',
    label: `${days} dias restantes`,
    daysRemaining: days,
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  };
}

export function getCategoryLabel(cat: ItemCategory): string {
  switch (cat) {
    case 'porcionamento':
      return 'Porcionamentos & Pré-preparos';
    case 'petisco':
      return 'Porções & Petiscos';
    case 'consumo':
      return 'Consumo & Descartáveis';
    case 'bebida':
      return 'Bebidas & Bar';
    case 'limpeza':
      return 'Limpeza & Higiene';
    default:
      return 'Outros Itens';
  }
}

export function getLossReasonLabel(reason: LossReason): string {
  switch (reason) {
    case 'queimou':
      return 'Queimou no preparo';
    case 'venceu':
      return 'Vencido no estoque';
    case 'derrubado_danificado':
      return 'Derrubado / Danificado';
    case 'erro_preparo':
      return 'Erro de preparo / Montagem';
    case 'descongelamento_inadequado':
      return 'Descongelamento inadequado';
    case 'contaminacao':
      return 'Contaminação cruzada';
    case 'sobra_descarte':
      return 'Sobra de prato / Descarte';
    default:
      return 'Outro motivo';
  }
}

export function getSectorLabel(sector: string): string {
  switch (sector) {
    case 'cozinha_quente':
      return 'Cozinha Quente / Fogão';
    case 'fritadeira':
      return 'Fritadeiras / Chapa';
    case 'pre_preparo':
      return 'Pré-preparo / Carnes';
    case 'bar':
      return 'Bar & Bebidas';
    case 'salao':
      return 'Salão / Atendimento';
    case 'camara_fria':
      return 'Câmara Fria / Freezers';
    case 'estoque_seco':
      return 'Estoque Seco / Despensa';
    default:
      return sector;
  }
}

// Build pre-formatted WhatsApp link
export function generateWhatsAppOrderLink(
  supplierPhone: string,
  supplierName: string,
  contactName: string,
  restaurantName: string,
  items: { name: string; quantity: number; unit: StockUnit; notes?: string }[],
  urgent: boolean = false
): string {
  // sanitize phone: remove non-digits
  let cleanPhone = supplierPhone.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
    cleanPhone = '55' + cleanPhone;
  }

  const dateStr = new Date().toLocaleDateString('pt-BR');
  const itemsList = items
    .map((it, idx) => `${idx + 1}. *${it.name}* - Qtd: *${formatQuantity(it.quantity, it.unit)}*${it.notes ? ` (${it.notes})` : ''}`)
    .join('\n');

  const text = `Olá, *${contactName || supplierName}*! Tudo bem?

Aqui é do setor de Compras do *${restaurantName}*.
Gostaríamos de formalizar o seguinte *Pedido de Compra* (${dateStr}):

${urgent ? '⚠️ *ATENÇÃO: PEDIDO URGENTE / REPOSIÇÃO IMEDIATA*\n\n' : ''}${itemsList}

📦 *Local de Entrega:* Recebimento de Mercadorias do Restaurante
⏰ *Previsão solicitada:* O mais breve possível

Por favor, nos confirme o recebimento, previsão de entrega e valores atualizados.

Agradecemos pela parceria!
_Enviado pelo Sistema de Controle de Estoque & Compras_`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

// Build pre-formatted Email mailto link
export function generateEmailOrderLink(
  supplierEmail: string,
  supplierName: string,
  contactName: string,
  restaurantName: string,
  items: { name: string; quantity: number; unit: StockUnit; notes?: string }[],
  urgent: boolean = false
): string {
  const dateStr = new Date().toLocaleDateString('pt-BR');
  const subject = `${urgent ? '[URGENTE] ' : ''}Pedido de Compra - ${restaurantName} - ${dateStr}`;

  const itemsList = items
    .map((it, idx) => `${idx + 1}. ${it.name} | Quantidade: ${formatQuantity(it.quantity, it.unit)}${it.notes ? ` (${it.notes})` : ''}`)
    .join('\n');

  const body = `Prezado(a) ${contactName || supplierName},

Segue formalização de pedido de compra do estabelecimento ${restaurantName}, gerado em ${dateStr}:

ITENS SOLICITADOS:
${itemsList}

${urgent ? 'OBS: Itens com necessidade de reposição prioritária.\n' : ''}
Favor confirmar o recebimento deste pedido, data estimada de entrega e faturamento.

Atenciosamente,
Setor de Compras & Suprimentos - ${restaurantName}`;

  return `mailto:${supplierEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
