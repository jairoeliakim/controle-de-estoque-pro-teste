import React, { useState } from 'react';
import {
  Printer,
  Download,
  Copy,
  X,
  Building2,
  Check,
  FileText,
  Calendar,
  Phone,
  Mail,
  Clock,
  Sparkles,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { PurchaseOrder, Supplier } from '../types';
import { formatCurrency, formatQuantity, formatDateBR, formatDateTimeBR } from '../utils/formatters';

interface PrintOrderModalProps {
  order: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  companyName?: string;
  companyCnpj?: string;
  supplier?: Supplier | null;
}

export const PrintOrderModal: React.FC<PrintOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  companyName = 'Desenvolvimento de Software',
  companyCnpj = '00.000.000/0000-00',
  supplier,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const orderSupName = order.supplierName || supplier?.name || 'Fornecedor';
  const orderSupPhone = order.supplierPhone || supplier?.phone || '-';
  const orderSupEmail = order.supplierEmail || supplier?.email || '-';
  const orderSupContact = supplier?.contactName || 'Vendas / Comercial';
  const orderSupCnpj = supplier?.cnpj || '-';
  const orderDeliveryDays = supplier?.deliveryDays || 2;

  const isDelivered = order.status === 'entregue' || order.status === 'recebido';
  const isPartial = order.status === 'parcial';

  // Status label
  const statusLabel = isDelivered
    ? 'ENTREGUE / CONCLUÍDO'
    : isPartial
    ? 'ATENDIDO PARCIALMENTE'
    : order.channelSent === 'whatsapp'
    ? 'ENVIADO (WHATSAPP)'
    : order.channelSent === 'email'
    ? 'ENVIADO (E-MAIL)'
    : 'PENDENTE / EM ABERTO';

  // Direct Browser Print (executes standard print/PDF export dialog)
  const handlePrint = () => {
    window.print();
  };

  // Copy plain text summary of the purchase order
  const handleCopyText = () => {
    const text = `PEDIDO DE COMPRA - ${companyName.toUpperCase()}
Número: ${order.orderNumber || order.id}
Data: ${formatDateTimeBR(order.createdAt)}
Status: ${statusLabel}
Fornecedor: ${orderSupName} (Contato: ${orderSupContact} | Tel: ${orderSupPhone} | E-mail: ${orderSupEmail})
Comprador: ${order.createdBy || 'Setor de Compras'}

ITENS SOLICITADOS:
${order.items
  .map(
    (it, idx) =>
      `${idx + 1}. ${it.itemName}: ${formatQuantity(it.quantityToOrder, it.unit)} x ${formatCurrency(
        it.estimatedUnitPrice
      )} = ${formatCurrency(it.totalCost)}${
        it.receivedQuantity ? ` (Entregue: ${formatQuantity(it.receivedQuantity, it.unit)})` : ''
      }`
  )
  .join('\n')}

TOTAL ESTIMADO: ${formatCurrency(order.totalValue)}
Observações: ${order.notes || 'Sem observações adicionais.'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download standalone printable HTML file
  const handleDownloadHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido de Compra - ${order.orderNumber || order.id}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.4; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .header-title { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-sub { font-size: 12px; color: #475569; margin-top: 2px; }
    .order-badge { text-align: right; }
    .order-number { font-size: 18px; font-weight: 800; font-family: monospace; color: #0f172a; }
    .order-status { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #e2e8f0; color: #1e293b; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
    .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; }
    .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
    .row { margin-bottom: 4px; }
    .row strong { color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
    .totals-box { width: 280px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; background: #f8fafc; }
    .totals-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; }
    .notes-box { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px 12px; font-size: 11px; color: #334155; margin-bottom: 24px; background: #fafafa; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; page-break-inside: avoid; }
    .sign-line { border-top: 1px solid #0f172a; text-align: center; padding-top: 6px; font-size: 11px; font-weight: 600; color: #334155; }
    .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="header-title">${companyName}</h1>
      <div class="header-sub">CNPJ: ${companyCnpj} • Setor de Compras e Suprimentos</div>
      <div class="header-sub" style="font-weight: 700; margin-top: 4px; color: #0f172a;">ORDEM DE COMPRA / PEDIDO DE FORNECIMENTO</div>
    </div>
    <div class="order-badge">
      <div class="order-number">${order.orderNumber || order.id}</div>
      <div class="header-sub">Emissão: ${formatDateBR(order.createdAt)}</div>
      <div class="order-status">${statusLabel}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Dados do Fornecedor</div>
      <div class="row"><strong>Razão Social:</strong> ${orderSupName}</div>
      <div class="row"><strong>CNPJ:</strong> ${orderSupCnpj}</div>
      <div class="row"><strong>Contato / Vendedor:</strong> ${orderSupContact}</div>
      <div class="row"><strong>Telefone / WhatsApp:</strong> ${orderSupPhone}</div>
      <div class="row"><strong>E-mail:</strong> ${orderSupEmail}</div>
      <div class="row"><strong>Prazo de Entrega:</strong> ${orderDeliveryDays} dias úteis</div>
    </div>

    <div class="card">
      <div class="card-title">Dados de Entrega & Cobrança</div>
      <div class="row"><strong>Empresa Destinatária:</strong> ${companyName}</div>
      <div class="row"><strong>CNPJ:</strong> ${companyCnpj}</div>
      <div class="row"><strong>Solicitante:</strong> ${order.createdBy || 'Setor de Compras'}</div>
      <div class="row"><strong>Canal de Envio:</strong> ${order.channelSent ? order.channelSent.toUpperCase() : 'DIRETO'}</div>
      <div class="row"><strong>Horário de Recebimento:</strong> 07:00 às 11:30 (Dias úteis)</div>
      <div class="row"><strong>Local de Entrega:</strong> Docas / Almoxarifado Central</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;" class="text-center">#</th>
        <th>Item / Descrição do Produto</th>
        <th class="text-center" style="width: 70px;">Unid.</th>
        <th class="text-right" style="width: 100px;">Qtd Pedida</th>
        <th class="text-right" style="width: 110px;">Preço Unit.</th>
        <th class="text-right" style="width: 120px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${order.items
        .map(
          (it, idx) => `
        <tr>
          <td class="text-center font-mono">${idx + 1}</td>
          <td>
            <strong>${it.itemName}</strong>
            ${it.receivedQuantity ? `<br><small style="color: #059669;">Qtd já entregue: ${formatQuantity(it.receivedQuantity, it.unit)}</small>` : ''}
          </td>
          <td class="text-center">${it.unit.toUpperCase()}</td>
          <td class="text-right"><strong>${formatQuantity(it.quantityToOrder, it.unit)}</strong></td>
          <td class="text-right">${formatCurrency(it.estimatedUnitPrice)}</td>
          <td class="text-right"><strong>${formatCurrency(it.totalCost)}</strong></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>VALOR TOTAL DO PEDIDO:</span>
        <span style="color: #059669;">${formatCurrency(order.totalValue)}</span>
      </div>
    </div>
  </div>

  <div class="notes-box">
    <strong>Instruções e Observações de Recebimento:</strong><br>
    ${order.notes || 'Conferência física obrigatória de lote, validade e integridade das embalagens na presença do conferente no ato da entrega. O faturamento e entrega devem acompanhar DANFE/NF-e correspondente.'}
    ${order.linkedInvoiceNumbers && order.linkedInvoiceNumbers.length > 0 ? `<br><br><strong>Notas Fiscais Vinculadas:</strong> NF-e nº ${order.linkedInvoiceNumbers.join(', ')}` : ''}
  </div>

  <div class="signatures">
    <div class="sign-line">
      Responsável por Compras / Emissor<br>
      <small style="color: #64748b;">${companyName}</small>
    </div>
    <div class="sign-line">
      Recebido por / Fornecedor / Transportador<br>
      <small style="color: #64748b;">Data: ____/____/________ • NF-e nº: _________________</small>
    </div>
  </div>

  <div class="footer">
    Documento emitido eletronicamente via Sistema de Gestão de Estoque & Suprimentos em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pedido-${order.orderNumber || order.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Non-Printable) */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Espelho do Pedido para Impressão / PDF
                </h3>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {order.orderNumber || order.id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Formato simplificado e limpo otimizado para folha A4, impressora térmica ou salvar como PDF no navegador.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Copiar resumo textual do pedido"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Baixar arquivo HTML formatado do pedido para abrir ou converter"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Baixar Arquivo</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              title="Abrir diálogo de impressão do navegador (selecione 'Salvar como PDF' ou a impressora desejada)"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors ml-1 cursor-pointer"
              title="Fechar visualização"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Sheet Container */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-950/60 flex-1">
          {/* THE PRINTABLE SHEET (Captured by @media print) */}
          <div
            id="printable-order-sheet"
            className="bg-white text-slate-900 border border-slate-200 shadow-2xl p-6 sm:p-10 rounded-xl max-w-3xl mx-auto space-y-6 text-xs leading-relaxed font-sans"
          >
            {/* Header: Company & Order Badge */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 uppercase tracking-tight">
                    {companyName}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  CNPJ: {companyCnpj} • Setor de Compras & Gestão de Suprimentos
                </p>
                <p className="text-xs font-extrabold text-slate-800 tracking-wider uppercase pt-1">
                  ORDEM DE COMPRA / PEDIDO DE FORNECIMENTO
                </p>
              </div>

              <div className="text-left sm:text-right space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-slate-200 shrink-0">
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 block tracking-tight">
                  {order.orderNumber || order.id}
                </span>
                <span className="text-[11px] text-slate-600 block">
                  Emissão: <strong>{formatDateBR(order.createdAt)}</strong> às {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-800 uppercase tracking-wider">
                  {statusLabel}
                </span>
              </div>
            </div>

            {/* Parties Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fornecedor */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 space-y-1.5">
                <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dados do Fornecedor</span>
                </div>
                <div className="space-y-1 text-slate-800 text-[11px]">
                  <div>
                    <strong>Razão Social:</strong> {orderSupName}
                  </div>
                  <div>
                    <strong>CNPJ:</strong> {orderSupCnpj}
                  </div>
                  <div>
                    <strong>Contato:</strong> {orderSupContact}
                  </div>
                  <div>
                    <strong>Telefone / WhatsApp:</strong> {orderSupPhone}
                  </div>
                  <div>
                    <strong>E-mail:</strong> {orderSupEmail}
                  </div>
                  <div>
                    <strong>Prazo de Entrega:</strong> {orderDeliveryDays} dias úteis
                  </div>
                </div>
              </div>

              {/* Comprador & Local de Entrega */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 space-y-1.5">
                <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dados de Entrega & Cobrança</span>
                </div>
                <div className="space-y-1 text-slate-800 text-[11px]">
                  <div>
                    <strong>Destinatário:</strong> {companyName}
                  </div>
                  <div>
                    <strong>CNPJ:</strong> {companyCnpj}
                  </div>
                  <div>
                    <strong>Solicitante:</strong> {order.createdBy || 'Setor de Compras'}
                  </div>
                  <div>
                    <strong>Canal de Envio:</strong> {order.channelSent ? order.channelSent.toUpperCase() : 'DIRETO'}
                  </div>
                  <div>
                    <strong>Horário de Recebimento:</strong> 07:00 às 11:30 (dias úteis)
                  </div>
                  <div>
                    <strong>Local:</strong> Recepção de Mercadorias / Docas
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-200 pb-1">
                <span>RELAÇÃO DOS PRODUTOS SOLICITADOS ({order.items.length} ITENS)</span>
                <span>VALORES EM REAIS (R$)</span>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Item / Descrição</th>
                      <th className="py-2.5 px-3 text-center w-16">Unid.</th>
                      <th className="py-2.5 px-3 text-right w-24">Qtd Pedida</th>
                      <th className="py-2.5 px-3 text-right w-28">Preço Unit.</th>
                      <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {order.items.map((it, idx) => {
                      const hasReceived = it.receivedQuantity && it.receivedQuantity > 0;
                      return (
                        <tr key={it.itemId || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-mono text-slate-500 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900 block">{it.itemName}</span>
                            {hasReceived && (
                              <span className="text-[10px] text-emerald-700 font-semibold block">
                                Já entregue: {formatQuantity(it.receivedQuantity || 0, it.unit)} • Saldo: {formatQuantity(Math.max(0, it.quantityToOrder - (it.receivedQuantity || 0)), it.unit)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold uppercase text-slate-600">
                            {it.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatQuantity(it.quantityToOrder, it.unit)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {formatCurrency(it.estimatedUnitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(it.totalCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Summary Box */}
            <div className="flex justify-end print-avoid-break">
              <div className="w-full sm:w-72 p-3.5 rounded-lg border border-slate-300 bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between text-slate-600 text-xs">
                  <span>Subtotal dos Itens:</span>
                  <span className="font-mono font-semibold">{formatCurrency(order.totalValue)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-xs">
                  <span>Frete / Taxas:</span>
                  <span className="font-mono text-emerald-700 font-semibold">Incluso / R$ 0,00</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-sm font-black text-slate-900">
                  <span>TOTAL DO PEDIDO:</span>
                  <span className="font-mono text-base text-emerald-800">{formatCurrency(order.totalValue)}</span>
                </div>
              </div>
            </div>

            {/* Notes & Receiving Instructions */}
            <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-[11px] text-slate-700 space-y-1 print-avoid-break">
              <div className="font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Instruções de Recebimento & Observações</span>
              </div>
              <p className="leading-relaxed">
                {order.notes || 'Conferência física obrigatória de peso, embalagem e prazo de validade na presença do conferente no ato da entrega. O faturamento deve acompanhar a DANFE / NF-e oficial.'}
              </p>
              {order.linkedInvoiceNumbers && order.linkedInvoiceNumbers.length > 0 && (
                <p className="font-semibold text-slate-900 pt-1 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-slate-700" />
                  <span>Notas Fiscais Vinculadas a este Pedido: NF-e nº {order.linkedInvoiceNumbers.join(', ')}</span>
                </p>
              )}
            </div>

            {/* Signatures & Protocol Lines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-200 print-avoid-break">
              <div className="text-center space-y-1">
                <div className="border-t border-slate-900 pt-1.5 w-4/5 mx-auto font-semibold text-[11px] text-slate-800">
                  {order.createdBy || 'Responsável por Compras'}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Emissão & Autorização de Compra
                </span>
              </div>

              <div className="text-center space-y-1">
                <div className="border-t border-slate-900 pt-1.5 w-4/5 mx-auto font-semibold text-[11px] text-slate-800">
                  Recebido por / Entregue por
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Data: ____/____/________  •  NF-e: _________________
                </span>
              </div>
            </div>

            {/* Print Footer */}
            <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium">
              Documento gerado eletronicamente em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} via Sistema de Gestão de Estoque & Reposição • {companyName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
