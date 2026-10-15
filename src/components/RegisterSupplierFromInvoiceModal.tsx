import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Package,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Search,
  Loader2,
} from 'lucide-react';
import { InvoiceData, Supplier } from '../types';
import {
  validateCNPJ,
  formatCNPJ,
  autoFixCNPJCheckDigits,
  cleanCNPJ,
} from '../utils/cnpjValidator';
import { lookupReceitaWsCnpj, ReceitaWSResponse } from '../services/receitaWsService';

interface RegisterSupplierFromInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData;
  onSupplierRegistered: (newSupplier: Supplier, linkAllInvoiceItems: boolean) => void;
  existingSuppliers: Supplier[];
  onSelectExistingSupplier?: (supplierId: string) => void;
}

export const RegisterSupplierFromInvoiceModal: React.FC<
  RegisterSupplierFromInvoiceModalProps
> = ({
  isOpen,
  onClose,
  invoice,
  onSupplierRegistered,
  existingSuppliers,
  onSelectExistingSupplier,
}) => {
  const [activeMode, setActiveMode] = useState<'cadastrar' | 'vincular_existente'>('cadastrar');

  // Form Fields
  const [cnpj, setCnpj] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Geral & Distribuição');
  const [deliveryDays, setDeliveryDays] = useState(2);
  const [notes, setNotes] = useState('');
  const [linkAllItems, setLinkAllItems] = useState(true);
  const [allowTestCnpjBypass, setAllowTestCnpjBypass] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [consultationStatus, setConsultationStatus] = useState<
    'idle' | 'consultando' | 'sucesso' | 'erro'
  >('idle');
  const [receitaData, setReceitaData] = useState<ReceitaWSResponse | null>(null);
  const [receitaMessage, setReceitaMessage] = useState<string | null>(null);

  // Populate initial values when modal opens or invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      setCnpj(invoice.supplierCnpj || '');
      setName(invoice.supplierName || '');
      setTradeName(invoice.supplierTradeName || invoice.supplierName || '');
      setPhone(invoice.supplierPhone || '5511999998888');
      setEmail(invoice.supplierEmail || 'pedidos@fornecedor.com.br');
      setDeliveryDays(2);
      setNotes(`Cadastrado a partir da NF-e nº ${invoice.number} (${invoice.natureOfOperation || 'Importação'})`);
      setLinkAllItems(true);
      setAllowTestCnpjBypass(false);
      setConsultationStatus('idle');
      setReceitaData(null);
      setReceitaMessage(null);

      // Guess category based on invoice items
      const itemNames = invoice.items.map((i) => i.name.toLowerCase()).join(' ');
      if (itemNames.includes('queijo') || itemNames.includes('leite') || itemNames.includes('requeijao') || itemNames.includes('manteiga')) {
        setCategory('Laticínios & Frios');
      } else if (itemNames.includes('carne') || itemNames.includes('picanha') || itemNames.includes('frango') || itemNames.includes('hamburguer')) {
        setCategory('Carnes & Porcionamento');
      } else if (itemNames.includes('cerveja') || itemNames.includes('refrigerante') || itemNames.includes('agua') || itemNames.includes('bebida')) {
        setCategory('Bebidas & Bar');
      } else if (itemNames.includes('batata') || itemNames.includes('camarao') || itemNames.includes('petisco')) {
        setCategory('Congelados & Petiscos');
      } else if (itemNames.includes('detergente') || itemNames.includes('limpeza')) {
        setCategory('Higiene & Limpeza');
      } else if (itemNames.includes('guardanapo') || itemNames.includes('embalagem') || itemNames.includes('copo')) {
        setCategory('Embalagens & Consumo');
      } else {
        setCategory('Geral & Distribuição');
      }

      if (existingSuppliers.length > 0) {
        setSelectedExistingId(existingSuppliers[0].id);
      }
    }
  }, [isOpen, invoice, existingSuppliers]);

  if (!isOpen) return null;

  const cnpjValidation = validateCNPJ(cnpj);
  const isCnpjFullyValid = cnpjValidation.isValid;
  const canSubmit =
    name.trim().length >= 3 &&
    (isCnpjFullyValid || allowTestCnpjBypass || cnpjValidation.isCorrectLength);

  const handleFixCnpjCheckDigits = () => {
    const fixed = autoFixCNPJCheckDigits(cnpj);
    setCnpj(fixed);
  };

  const handleLookupReceita = async () => {
    const clean = cleanCNPJ(cnpj);
    if (clean.length !== 14) return;

    setConsultationStatus('consultando');
    setReceitaMessage(null);

    const result = await lookupReceitaWsCnpj(clean);

    if (result.success && result.data) {
      setConsultationStatus('sucesso');
      setReceitaData(result.data);
      if (result.razaoSocial) setName(result.razaoSocial);
      if (result.nomeFantasia) setTradeName(result.nomeFantasia);
      if (result.telefone) {
        const cleanPhone = result.telefone.replace(/\D/g, '');
        setPhone(cleanPhone.length >= 10 ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : result.telefone);
      }
      if (result.email) setEmail(result.email);
      setReceitaMessage(`Dados oficiais carregados da Receita Federal! Situação: ${result.situacaoCadastral || 'ATIVA'}.`);
    } else {
      setConsultationStatus('erro');
      setReceitaMessage(result.error || 'Não foi possível consultar a Receita Federal.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const newSupplierId = `sup-${Date.now()}`;
    const productIdsToLink = invoice.items.map((it) => it.matchedStockItemId || it.id);

    const newSupplier: Supplier = {
      id: newSupplierId,
      name: name.trim(),
      cnpj: formatCNPJ(cnpj),
      contactName: 'Setor de Faturamento / Vendas',
      phone: phone.trim().replace(/\D/g, '') || '5511999998888',
      email: email.trim() || 'pedidos@fornecedor.com.br',
      deliveryDays: Number(deliveryDays) || 2,
      category,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      suppliedProductIds: linkAllItems ? productIdsToLink : [],
      productLinks: linkAllItems
        ? invoice.items.map((it) => ({
            productId: it.matchedStockItemId || it.id,
            customPrice: it.unitPrice,
            isPrimary: true,
          }))
        : [],
    };

    onSupplierRegistered(newSupplier, linkAllItems);
    onClose();
  };

  const handleSelectExisting = () => {
    if (selectedExistingId && onSelectExistingSupplier) {
      onSelectExistingSupplier(selectedExistingId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-start justify-between relative">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  NF-e nº {invoice.number}
                </span>
                <span className="text-xs text-slate-400">• Cadastro de Fornecedor</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                Fornecedor Não Cadastrado no Sistema
              </h3>
              <p className="text-xs text-slate-400">
                Identificado na nota fiscal. Cadastre com validação de CNPJ ou vincule a um fornecedor existente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('cadastrar')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeMode === 'cadastrar'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Cadastrar Fornecedor Validado por CNPJ</span>
          </button>

          {existingSuppliers.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveMode('vincular_existente')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeMode === 'vincular_existente'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Vincular a Fornecedor Já Existente ({existingSuppliers.length})</span>
            </button>
          )}
        </div>

        {/* MODE 1: CADASTRAR FORNECEDOR VALIDADO POR CNPJ */}
        {activeMode === 'cadastrar' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* CNPJ Input & Live Validation Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>CNPJ do Fornecedor (Receita Federal) *</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {cleanCNPJ(cnpj).length} / 14 caracteres
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(formatCNPJ(e.target.value));
                    setConsultationStatus('idle');
                  }}
                  placeholder="00.000.000/0000-00"
                  className={`w-full px-4 py-3 rounded-xl bg-slate-950 border font-mono text-sm tracking-wider text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all ${
                    isCnpjFullyValid
                      ? 'border-emerald-500/80 focus:border-emerald-500 ring-1 ring-emerald-500/30'
                      : cnpj.length > 0 && !isCnpjFullyValid
                      ? 'border-amber-500/80 focus:border-amber-500 ring-1 ring-amber-500/30'
                      : 'border-slate-700 focus:border-amber-500'
                  }`}
                />
              </div>

              {/* CNPJ Validation Status Feedback */}
              <div className="space-y-2">
                {isCnpjFullyValid ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-3 text-xs text-emerald-300">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          CNPJ Válido pela Receita Federal
                        </span>
                        <span className="text-[11px] text-emerald-400/80">
                          Estrutura de 14 dígitos e pares de dígitos verificadores ({cnpjValidation.actualCheckDigits}) conferidos com sucesso pelo algoritmo oficial Módulo 11.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLookupReceita}
                      disabled={consultationStatus === 'consultando'}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all shrink-0 border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {consultationStatus === 'consultando' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Consultando Receita...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>{consultationStatus === 'sucesso' ? 'Atualizado da Receita' : 'Buscar na Receita Federal'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : cleanCNPJ(cnpj).length === 14 ? (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          Dígitos verificadores inconsistentes
                        </span>
                        <span className="text-[11px] text-amber-200/90 leading-relaxed block">
                          {cnpjValidation.error}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {cnpjValidation.calculatedCheckDigits && (
                        <button
                          type="button"
                          onClick={handleFixCnpjCheckDigits}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            Ajustar Dígitos Verificadores para {cnpjValidation.calculatedCheckDigits}
                          </span>
                        </button>
                      )}

                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none ml-auto">
                        <input
                          type="checkbox"
                          checked={allowTestCnpjBypass}
                          onChange={(e) => setAllowTestCnpjBypass(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                        />
                        <span>Permitir cadastro em modo de homologação / teste</span>
                      </label>
                    </div>
                  </div>
                ) : cnpj.length > 0 ? (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Informe os 14 dígitos do CNPJ para conferência do cálculo Módulo 11 da Receita.</span>
                  </p>
                ) : null}

                {/* Consultation details badge if activated */}
                {consultationStatus === 'sucesso' && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-2 animate-in fade-in duration-150">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Situação Cadastral</span>
                      <span className="text-emerald-400 font-bold">ATIVA</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Regime Tributário</span>
                      <span className="text-slate-200 font-medium">Lucro Presumido / Geral</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">UF da Emissão</span>
                      <span className="text-slate-200 font-medium">{invoice.supplierState || 'SP'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Razão Social & Nome Fantasia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200">
                  Razão Social (Nome Oficial) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Laticínios Serra da Canastra LTDA"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200">
                  Nome Fantasia / Apelido Comercial
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ex: Serra da Canastra"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Contato: Telefone/WhatsApp & E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Telefone / WhatsApp para Pedidos *</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 5511999998888 (com DDI + DDD)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Utilizado para envio de cotações e pedidos de compras via WhatsApp com 1 clique.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  <span>E-mail do Representante / Vendas</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pedidos@fornecedor.com.br"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Categoria & Prazo de Entrega */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Categoria de Fornecimento</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="Carnes & Porcionamento">Carnes & Porcionamento</option>
                  <option value="Laticínios & Frios">Laticínios & Frios</option>
                  <option value="Congelados & Petiscos">Congelados & Petiscos</option>
                  <option value="Bebidas & Bar">Bebidas & Bar</option>
                  <option value="Hortifrúti & Frescos">Hortifrúti & Frescos</option>
                  <option value="Embalagens & Consumo">Embalagens & Consumo</option>
                  <option value="Higiene & Limpeza">Higiene & Limpeza</option>
                  <option value="Geral & Distribuição">Geral & Distribuição</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Prazo Estimado de Entrega (dias)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* SEÇÃO PRINCIPAL: VÍNCULO AUTOMÁTICO DOS PRODUTOS DA NOTA */}
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/20">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">
                      Vínculo Automático de Produtos ({invoice.items.length} itens na NF-e)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Ao cadastrar, todos os produtos desta nota serão vinculados a este fornecedor como fornecedor principal.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-colors shrink-0">
                  <input
                    type="checkbox"
                    checked={linkAllItems}
                    onChange={(e) => setLinkAllItems(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-0"
                  />
                  <span className="text-xs font-bold text-amber-400">Vincular Produtos</span>
                </label>
              </div>

              {/* Items List Preview */}
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {invoice.items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-slate-200 font-medium truncate">{it.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-slate-400 text-[11px]">
                      <span>
                        {it.quantity} {it.unit}
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        R$ {it.unitPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Fornecedor e Vincular Produtos</span>
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: VINCULAR A FORNECEDOR EXISTENTE */}
        {activeMode === 'vincular_existente' && (
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-slate-100 block">
                Vincular a um Fornecedor já cadastrado no estoque
              </span>
              <p className="text-slate-400 text-[11px]">
                Caso esta nota pertença a um fornecedor já cadastrado no sistema com outro CNPJ (por exemplo, Matriz ou outra filial), selecione o fornecedor correspondente abaixo:
              </p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {existingSuppliers.map((s) => (
                <label
                  key={s.id}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedExistingId === s.id
                      ? 'bg-amber-500/10 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="existing_sup"
                      checked={selectedExistingId === s.id}
                      onChange={() => setSelectedExistingId(s.id)}
                      className="text-amber-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">{s.name}</span>
                      <span className="text-[11px] text-slate-400">
                        CNPJ: {s.cnpj || 'Não informado'} • Categoria: {s.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {s.suppliedProductIds?.length || 0} produto(s)
                  </span>
                </label>
              ))}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSelectExisting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Vincular Nota a este Fornecedor</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
