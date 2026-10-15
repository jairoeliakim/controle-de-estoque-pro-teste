import React, { useState, useMemo, useRef } from 'react';
import {
  Truck,
  PlusCircle,
  Phone,
  Mail,
  Clock,
  DollarSign,
  MessageCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  Package,
  Search,
  Check,
  Star,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Shield,
  Lock,
  Boxes,
  Globe,
  Building2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Supplier, StockItem, UserRole, canRegisterEntities, canViewSuppliers } from '../types';
import { formatCurrency, formatQuantity, getCategoryLabel } from '../utils/formatters';
import {
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  formatDynamicDocument,
  validateDynamicCompanyDocument,
} from '../utils/countryDocumentConfig';
import { autoFixCNPJCheckDigits, cleanCNPJ, validateCNPJ } from '../utils/cnpjValidator';
import { lookupReceitaWsCnpj, ReceitaWSResponse } from '../services/receitaWsService';

interface SuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  items?: StockItem[];
  onSaveSupplier: (supplier: Supplier, updatedItems?: StockItem[]) => void;
  onDeleteSupplier?: (id: string) => void;
  currentRole: UserRole;
  initialSelectedSupplierId?: string;
  initialTab?: 'dados' | 'produtos';
}

export const SuppliersModal: React.FC<SuppliersModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  items = [],
  onSaveSupplier,
  onDeleteSupplier,
  currentRole,
  initialSelectedSupplierId,
  initialTab = 'dados',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'dados' | 'produtos'>(initialTab);

  // Expanded supplier cards for quick preview of linked items
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Record<string, boolean>>({});

  // Form fields
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [paisOrigem, setPaisOrigem] = useState('BR');
  const [tipoDocumento, setTipoDocumento] = useState('CNPJ');
  const [documentoIdentificador, setDocumentoIdentificador] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(1);
  const [category, setCategory] = useState('Geral');
  const [notes, setNotes] = useState('');
  const [priceUpdateIntervalDays, setPriceUpdateIntervalDays] = useState<number>(30);
  const [priceIntervalError, setPriceIntervalError] = useState<string | null>(null);
  const [docValidationFeedback, setDocValidationFeedback] = useState<{
    isValid: boolean;
    message?: string;
    calculatedDV?: string;
  } | null>(null);
  const [supplierSuccessMessage, setSupplierSuccessMessage] = useState<string | null>(null);
  const [justSavedSupplierId, setJustSavedSupplierId] = useState<string | null>(null);

  // ReceitaWS state para Fornecedores
  const [isSearchingReceita, setIsSearchingReceita] = useState(false);
  const [receitaError, setReceitaError] = useState<string | null>(null);
  const [receitaSuccessMessage, setReceitaSuccessMessage] = useState<string | null>(null);
  const [receitaData, setReceitaData] = useState<ReceitaWSResponse | null>(null);

  // Linked Products State for the supplier being edited
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  // Map of productId -> isPrimary for this supplier
  const [primaryProductIds, setPrimaryProductIds] = useState<Record<string, boolean>>({});
  // Map of productId -> custom quoted price
  const [productCustomPrices, setProductCustomPrices] = useState<Record<string, number>>({});

  // Product Filter State inside the linking tab
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('todos');
  const [productStatusFilter, setProductStatusFilter] = useState<'todos' | 'vinculados' | 'nao_vinculados'>('todos');

  // Toggle expand supplier
  const toggleExpandSupplier = (id: string) => {
    setExpandedSupplierIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCountryChange = (newCode: string) => {
    setPaisOrigem(newCode);
    const countryCfg = getCountryConfig(newCode);
    setTipoDocumento(countryCfg.defaultDocType);
    const formattedDoc = formatDynamicDocument(documentoIdentificador, newCode);
    setDocumentoIdentificador(formattedDoc);
    setCnpj(newCode === 'BR' ? formattedDoc : '');
    if (formattedDoc.trim()) {
      const res = validateDynamicCompanyDocument(formattedDoc, newCode, countryCfg.defaultDocType);
      setDocValidationFeedback({
        isValid: res.isValid,
        message: res.errorMessage,
        calculatedDV: res.calculatedCheckDigits,
      });
    } else {
      setDocValidationFeedback(null);
    }
  };

  // Evita repetir a consulta automática para o mesmo CNPJ (limite da API pública: 3 consultas/min)
  const lastAutoLookupRef = useRef<string>('');

  const handleDocumentChange = (val: string) => {
    const formatted = formatDynamicDocument(val, paisOrigem);
    setDocumentoIdentificador(formatted);
    setCnpj(paisOrigem === 'BR' ? formatted : '');

    // Busca automática ao completar um CNPJ válido (numérico ou alfanumérico)
    if (paisOrigem === 'BR') {
      const clean = cleanCNPJ(formatted);
      if (clean.length === 14 && validateCNPJ(clean).isValid && lastAutoLookupRef.current !== clean) {
        lastAutoLookupRef.current = clean;
        handleLookupReceitaSupplier(clean);
      }
    }
    if (formatted.trim()) {
      const res = validateDynamicCompanyDocument(formatted, paisOrigem, tipoDocumento);
      setDocValidationFeedback({
        isValid: res.isValid,
        message: res.errorMessage,
        calculatedDV: res.calculatedCheckDigits,
      });
    } else {
      setDocValidationFeedback(null);
    }
  };

  const handleAutoFixCnpj = () => {
    const fixed = autoFixCNPJCheckDigits(documentoIdentificador);
    setDocumentoIdentificador(fixed);
    setCnpj(fixed);
    const res = validateDynamicCompanyDocument(fixed, 'BR', 'CNPJ');
    setDocValidationFeedback({
      isValid: res.isValid,
      message: res.errorMessage,
      calculatedDV: res.calculatedCheckDigits,
    });
  };

  const handleLookupReceitaSupplier = async (targetCnpj?: string) => {
    const clean = cleanCNPJ(targetCnpj || documentoIdentificador);
    if (clean.length !== 14) {
      setReceitaError('Digite os 14 caracteres do CNPJ do fornecedor para consultar na Receita Federal.');
      return;
    }

    setIsSearchingReceita(true);
    setReceitaError(null);
    setReceitaSuccessMessage(null);

    const result = await lookupReceitaWsCnpj(clean);
    setIsSearchingReceita(false);

    if (!result.success) {
      setReceitaError(result.error || 'Não foi possível consultar os dados do fornecedor na Receita Federal.');
      return;
    }

    // Preenche dados do fornecedor a partir da Receita Federal
    if (result.razaoSocial) setName(result.razaoSocial);
    if (result.telefone) {
      const cleanPhone = result.telefone.replace(/\D/g, '');
      setPhone(cleanPhone.length >= 10 ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : result.telefone);
    }
    if (result.email) setEmail(result.email);
    if (result.responsavelNome) setContactName(result.responsavelNome);
    if (result.cnpjFormatado) {
      setDocumentoIdentificador(result.cnpjFormatado);
      setCnpj(result.cnpjFormatado);
      const resVal = validateDynamicCompanyDocument(result.cnpjFormatado, 'BR', 'CNPJ');
      setDocValidationFeedback({
        isValid: resVal.isValid,
        message: resVal.errorMessage,
        calculatedDV: resVal.calculatedCheckDigits,
      });
    }
    if (result.data) {
      setReceitaData(result.data);
      const details = `Endereço: ${result.enderecoCompleto} | Situação: ${result.situacaoCadastral} | Atividade: ${result.data.atividade_principal?.[0]?.text || ''}`;
      if (!notes) {
        setNotes(details);
      }
    }

    setReceitaSuccessMessage(
      `Dados do fornecedor carregados com sucesso da Receita Federal! Situação: ${result.situacaoCadastral || 'ATIVA'}.`
    );
  };

  const handleStartCreate = () => {
    setEditingSupplier(null);
    setName('');
    setPaisOrigem('BR');
    setTipoDocumento('CNPJ');
    setDocumentoIdentificador('');
    setCnpj('');
    setDocValidationFeedback(null);
    setSupplierSuccessMessage(null);
    setReceitaError(null);
    setReceitaSuccessMessage(null);
    setReceitaData(null);
    setContactName('');
    setPhone('5511999990000');
    setEmail('');
    setDeliveryDays(1);
    setCategory('Congelados e Petiscos');
    setNotes('');
    setPriceUpdateIntervalDays(30);
    setPriceIntervalError(null);
    setLinkedProductIds([]);
    setPrimaryProductIds({});
    setProductCustomPrices({});
    setActiveFormTab('dados');
    setIsEditing(true);
  };

  const handleStartEdit = (s: Supplier, tab: 'dados' | 'produtos' = 'dados') => {
    setEditingSupplier(s);
    setName(s.name);
    setReceitaError(null);
    setReceitaSuccessMessage(null);
    setReceitaData(null);
    const country = s.paisOrigem || 'BR';
    setPaisOrigem(country);
    setTipoDocumento(s.tipoDocumento || (country === 'BR' ? 'CNPJ' : 'TAX_ID'));
    const doc = s.documentoIdentificador || s.cnpj || '';
    setDocumentoIdentificador(doc);
    setCnpj(s.cnpj || (country === 'BR' ? doc : ''));
    if (doc.trim()) {
      const res = validateDynamicCompanyDocument(doc, country, s.tipoDocumento);
      setDocValidationFeedback({
        isValid: res.isValid,
        message: res.errorMessage,
        calculatedDV: res.calculatedCheckDigits,
      });
    } else {
      setDocValidationFeedback(null);
    }
    setSupplierSuccessMessage(null);
    setContactName(s.contactName);
    setPhone(s.phone);
    setEmail(s.email);
    setDeliveryDays(s.deliveryDays);
    setCategory(s.category);
    setNotes(s.notes || '');
    setPriceUpdateIntervalDays(s.priceUpdateIntervalDays || 30);
    setPriceIntervalError(null);

    // Identify linked products
    // A product is linked if its ID is in s.suppliedProductIds OR if item.primarySupplierId === s.id
    // OR if item.alternativeSuppliers has an entry for s.id
    const linked = new Set<string>(s.suppliedProductIds || []);
    const primaries: Record<string, boolean> = {};
    const prices: Record<string, number> = {};

    items.forEach((item) => {
      if (item.primarySupplierId === s.id) {
        linked.add(item.id);
        primaries[item.id] = true;
        prices[item.id] = item.costPrice;
      }
      const altQuote = item.alternativeSuppliers?.find((q) => q.supplierId === s.id);
      if (altQuote) {
        linked.add(item.id);
        if (altQuote.unitPrice) {
          prices[item.id] = altQuote.unitPrice;
        }
      }
    });

    setLinkedProductIds(Array.from(linked));
    setPrimaryProductIds(primaries);
    setProductCustomPrices(prices);
    setActiveFormTab(tab);
    setIsEditing(true);
  };

  // If initialSelectedSupplierId is provided on open
  React.useEffect(() => {
    if (isOpen && initialSelectedSupplierId) {
      const found = suppliers.find((s) => s.id === initialSelectedSupplierId);
      if (found) {
        handleStartEdit(found, initialTab);
      }
    }
  }, [isOpen, initialSelectedSupplierId, initialTab, suppliers]);

  const handleQuickRefreshPrice = (s: Supplier) => {
    const updated: Supplier = {
      ...s,
      lastPriceUpdateDate: new Date().toISOString(),
    };
    onSaveSupplier(updated);
  };

  // Toggle link / unlink for a product
  const toggleProductLink = (productId: string) => {
    setLinkedProductIds((prev) => {
      if (prev.includes(productId)) {
        // Unlink
        const updated = prev.filter((id) => id !== productId);
        // Also remove primary if it was
        setPrimaryProductIds((p) => {
          const copy = { ...p };
          delete copy[productId];
          return copy;
        });
        return updated;
      } else {
        // Link
        const item = items.find((it) => it.id === productId);
        if (item && !productCustomPrices[productId]) {
          setProductCustomPrices((prices) => ({
            ...prices,
            [productId]: item.costPrice,
          }));
        }
        return [...prev, productId];
      }
    });
  };

  // Toggle isPrimary for a linked product
  const toggleProductPrimary = (productId: string) => {
    if (!linkedProductIds.includes(productId)) {
      toggleProductLink(productId);
    }
    setPrimaryProductIds((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  // Batch actions
  const handleLinkAllFiltered = (filteredItems: StockItem[]) => {
    const toAdd = filteredItems.map((it) => it.id);
    setLinkedProductIds((prev) => Array.from(new Set([...prev, ...toAdd])));
  };

  const handleUnlinkAllFiltered = (filteredItems: StockItem[]) => {
    const toRemove = new Set(filteredItems.map((it) => it.id));
    setLinkedProductIds((prev) => prev.filter((id) => !toRemove.has(id)));
    setPrimaryProductIds((prev) => {
      const next = { ...prev };
      toRemove.forEach((id) => delete next[id]);
      return next;
    });
  };

  // Filter products in the linking tab
  const productsToDisplay = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (productSearch.trim()) {
        const query = productSearch.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCode = item.code.toLowerCase().includes(query);
        if (!matchName && !matchCode) return false;
      }

      // Category
      if (productCategoryFilter !== 'todos' && item.category !== productCategoryFilter) {
        return false;
      }

      // Status (vinculados / nao_vinculados)
      const isLinked = linkedProductIds.includes(item.id);
      if (productStatusFilter === 'vinculados' && !isLinked) return false;
      if (productStatusFilter === 'nao_vinculados' && isLinked) return false;

      return true;
    });
  }, [items, productSearch, productCategoryFilter, productStatusFilter, linkedProductIds]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedInterval = Number(priceUpdateIntervalDays) || 30;
    if (parsedInterval > 45) {
      setPriceIntervalError('O prazo máximo para atualização de preços não pode ser superior a 45 dias.');
      return;
    }
    if (parsedInterval < 1) {
      setPriceIntervalError('O prazo de atualização deve ser de pelo menos 1 dia.');
      return;
    }

    // 3. Validação Condicional:
    // • O seu código que calcula o algoritmo do dígito verificador (DV) do CNPJ só deve ser executado se pais_origem == 'BR'.
    // • Se for estrangeiro, a única validação necessária é verificar se o campo não está vazio ou se não ultrapassou o limite de caracteres do banco.
    if (documentoIdentificador.trim()) {
      const valRes = validateDynamicCompanyDocument(documentoIdentificador, paisOrigem, tipoDocumento);
      if (!valRes.isValid) {
        setDocValidationFeedback({
          isValid: false,
          message: valRes.errorMessage,
          calculatedDV: valRes.calculatedCheckDigits,
        });
        setActiveFormTab('dados');
        return;
      }
    }

    const supplierId = editingSupplier ? editingSupplier.id : `sup-${Date.now()}`;

    const supplier: Supplier = {
      id: supplierId,
      name: name.trim(),
      cnpj: paisOrigem === 'BR' && documentoIdentificador ? documentoIdentificador.trim() : (cnpj.trim() || undefined),
      paisOrigem,
      tipoDocumento,
      documentoIdentificador: documentoIdentificador.trim() || undefined,
      contactName: contactName.trim() || 'Comercial',
      phone: phone.trim(),
      email: email.trim(),
      deliveryDays: Number(deliveryDays) || 1,
      category: category.trim() || 'Geral',
      notes: notes.trim(),
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
      priceUpdateIntervalDays: parsedInterval,
      lastPriceUpdateDate: editingSupplier?.lastPriceUpdateDate || new Date().toISOString(),
      suppliedProductIds: linkedProductIds,
      productLinks: linkedProductIds.map((pId) => ({
        productId: pId,
        customPrice: productCustomPrices[pId],
        isPrimary: !!primaryProductIds[pId],
      })),
    };

    // Also update any items where primarySupplierId was set or removed
    const updatedItemsList: StockItem[] = items.map((it) => {
      const isLinked = linkedProductIds.includes(it.id);
      const isPrimary = !!primaryProductIds[it.id];

      // If user marked this supplier as primary for this item
      if (isPrimary) {
        return {
          ...it,
          primarySupplierId: supplierId,
        };
      }

      // If this item previously had this supplier as primary, but user un-primaried or unlinked it
      if (it.primarySupplierId === supplierId && !isPrimary) {
        // Look for another supplier in alternativeSuppliers or fallback
        return {
          ...it,
          primarySupplierId: undefined,
        };
      }

      // If user linked as alternative, update alternativeSuppliers quote
      if (isLinked) {
        const existingAlt = it.alternativeSuppliers?.filter((q) => q.supplierId !== supplierId) || [];
        const customPrice = productCustomPrices[it.id] || it.costPrice;
        return {
          ...it,
          alternativeSuppliers: [
            ...existingAlt,
            {
              supplierId: supplierId,
              supplierName: supplier.name,
              unitPrice: customPrice,
              packSize: '1 ' + (it.unit || 'un'),
              lastQuotedAt: new Date().toISOString().split('T')[0],
            },
          ],
        };
      } else {
        // If unlinked, remove from alternativeSuppliers if present
        if (it.alternativeSuppliers?.some((q) => q.supplierId === supplierId)) {
          return {
            ...it,
            alternativeSuppliers: it.alternativeSuppliers.filter((q) => q.supplierId !== supplierId),
          };
        }
      }

      return it;
    });

    onSaveSupplier(supplier, updatedItemsList);
    setJustSavedSupplierId(supplierId);
    setSupplierSuccessMessage(
      `Fornecedor "${supplier.name}" (${supplier.tipoDocumento || 'DOC'}: ${supplier.documentoIdentificador || supplier.cnpj || 'Sem documento'}) homologado com sucesso!`
    );
    setIsEditing(false);
  };

  const isAllowedToView = canViewSuppliers(currentRole);
  const isAllowedToRegister = canRegisterEntities(currentRole);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Gestão de Fornecedores & Vínculo de Produtos
              </h3>
              <p className="text-xs text-slate-400">
                Cadastro comercial, WhatsApp para pedidos e vinculação direta aos itens de estoque
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {!isAllowedToView ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-100">Acesso Restrito a Fornecedores</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Apenas os perfis <strong>Compras</strong>, <strong>Gerente</strong> e <strong>Administrador</strong> têm permissão para visualizar e homologar fornecedores.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
            {!isEditing ? (
              /* LIST VIEW */
              <>
                {/* Banner de Sucesso de Homologação */}
                {supplierSuccessMessage && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-500/50 flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-200">
                          {supplierSuccessMessage}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Dados da empresa estruturados com país de origem, tipo de documento e documento identificador no SGBD.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSupplierSuccessMessage(null)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                      title="Fechar aviso"
                    >
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      {suppliers.length} fornecedores homologados
                    </span>
                    <span className="text-[11px] text-slate-500">
                      • {items.length} itens no catálogo
                    </span>
                  </div>

                  {isAllowedToRegister && (
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all active:scale-95 shadow"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Cadastrar Fornecedor</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {suppliers.map((s) => {
                    // Count linked products
                    const linkedItems = items.filter((it) => {
                      const inSupplied = s.suppliedProductIds?.includes(it.id);
                      const isPrimary = it.primarySupplierId === s.id;
                      const inAlt = it.alternativeSuppliers?.some((q) => q.supplierId === s.id);
                      return inSupplied || isPrimary || inAlt;
                    });

                    const isExpanded = !!expandedSupplierIds[s.id];
                    const isJustSaved = s.id === justSavedSupplierId;

                    // Country & Document configuration
                    const countryCfg = getCountryConfig(s.paisOrigem || 'BR');
                    const docTypeLabel = s.tipoDocumento || (s.paisOrigem === 'BR' || !s.paisOrigem ? 'CNPJ' : 'DOC');
                    const docValue = s.documentoIdentificador || s.cnpj;

                    // Price validity check
                    const interval = s.priceUpdateIntervalDays || 30;
                    const lastUpdate = s.lastPriceUpdateDate ? new Date(s.lastPriceUpdateDate) : (s.createdAt ? new Date(s.createdAt) : new Date('2026-03-01'));
                    const now = new Date();
                    const daysPassed = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysPassed > interval;
                    const daysRemaining = Math.max(0, interval - daysPassed);

                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isJustSaved
                            ? 'bg-amber-950/20 border-amber-500/80 ring-2 ring-amber-500/40 shadow-lg'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-100">{s.name}</h4>
                              {isJustSaved && (
                                <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 flex items-center gap-1 animate-pulse">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Recém Salvo
                                </span>
                              )}
                              <span className="text-[11px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {s.category}
                              </span>
                              {/* Country & Document Badge */}
                              <span className="text-[11px] px-2 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-700 flex items-center gap-1 font-mono">
                                <span>{countryCfg.flag}</span>
                                <span className="font-semibold text-amber-400">{docTypeLabel}:</span>
                                <span>{docValue || 'Livre'}</span>
                              </span>
                              {/* Linked products counter badge */}
                              <span className="text-[11px] font-bold px-2 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                <Package className="w-3 h-3 text-blue-400" />
                                {linkedItems.length} produto{linkedItems.length === 1 ? '' : 's'} vinculado{linkedItems.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                              <span className="flex items-center gap-1 text-slate-300">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                <strong className="font-mono text-emerald-400">{s.phone}</strong>
                                <span className="text-slate-500">({s.contactName})</span>
                              </span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Mail className="w-3 h-3 text-blue-400" />
                                {s.email}
                              </span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Prazo: {s.deliveryDays} dia{s.deliveryDays > 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Price Validity Line */}
                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                    isOverdue
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                      : daysRemaining <= 5
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  }`}
                                >
                                  {isOverdue
                                    ? `Preços Desatualizados (+${daysPassed - interval} dias vencido)`
                                    : `Cotação em dia (restam ${daysRemaining} dias)`}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  Ciclo: <strong className="text-slate-300">{interval} dias</strong> (máx 45d)
                                </span>
                              </div>

                              {isAllowedToRegister && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickRefreshPrice(s)}
                                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/30 transition-all font-medium"
                                  title="Registrar que a tabela de preços deste fornecedor foi conferida e renovada hoje"
                                >
                                  Renovar Preços Hoje
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Open WhatsApp */}
                            <a
                              href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>

                            {/* Direct button to link products */}
                            {isAllowedToRegister && (
                              <button
                                onClick={() => handleStartEdit(s, 'produtos')}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                                title="Vincular ou gerenciar produtos deste fornecedor"
                              >
                                <Package className="w-3.5 h-3.5 text-blue-400" />
                                <span>Vincular Produtos</span>
                              </button>
                            )}

                            {/* Edit Supplier */}
                            {isAllowedToRegister && (
                              <button
                                onClick={() => handleStartEdit(s, 'dados')}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                                title="Editar dados cadastrais"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Toggle preview of linked products */}
                            {linkedItems.length > 0 && (
                              <button
                                onClick={() => toggleExpandSupplier(s.id)}
                                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                                title={isExpanded ? 'Ocultar produtos' : 'Ver produtos vinculados'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Preview of Linked Products */}
                        {isExpanded && linkedItems.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 animate-in fade-in duration-150">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                              Produtos Vinculados a {s.name}:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {linkedItems.map((item) => {
                                const isPrimary = item.primarySupplierId === s.id;
                                return (
                                  <div
                                    key={item.id}
                                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <span className="font-mono text-[10px] text-amber-400 font-bold mr-1.5">
                                        {item.code}
                                      </span>
                                      <span className="font-semibold text-slate-200">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isPrimary && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                                          Principal
                                        </span>
                                      )}
                                      <span className="font-mono text-[11px] text-slate-400">
                                        {formatQuantity(item.currentStock, item.unit)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* FORM VIEW (Dados Cadastrais + Vincular Produtos) */
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-400" />
                    {editingSupplier ? `Editar: ${editingSupplier.name}` : 'Novo Fornecedor'}
                  </h4>

                  {/* Form Tabs: Dados Cadastrais vs Vincular Produtos */}
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('dados')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeFormTab === 'dados'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      1. Dados & Contato
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('produtos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeFormTab === 'produtos'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>2. Vincular Produtos ({linkedProductIds.length})</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: DADOS CADASTRAIS */}
                {activeFormTab === 'dados' && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Razão Social / Nome Fantasia *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ex: Frigorífico Central Carnes"
                        className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* 1. Seleção de País da Empresa (pais_origem) */}
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-amber-400" />
                            1. País de Origem da Empresa (pais_origem ISO 3166-1 alpha-2) *
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Define a máscara e regras de validação
                          </span>
                        </label>
                        <select
                          value={paisOrigem}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 font-semibold focus:outline-none focus:border-amber-400"
                        >
                          {SUPPORTED_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.name} ({c.code}) — {c.defaultDocType}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {getCountryConfig(paisOrigem).description}
                        </p>
                      </div>

                      {/* 2. Tipo de Documento e Documento Identificador com Máscara Dinâmica */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Tipo de Documento (tipo_documento)
                          </label>
                          <input
                            type="text"
                            value={tipoDocumento}
                            onChange={(e) => setTipoDocumento(e.target.value)}
                            placeholder={getCountryConfig(paisOrigem).defaultDocType}
                            className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono uppercase text-slate-200 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>
                              2. Documento Identificador (VARCHAR 20 a 35) *
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {paisOrigem === 'BR'
                                ? 'Máscara XX.XXX.XXX/XXXX-99 (14 caracteres, numérico ou alfanumérico)'
                                : `${documentoIdentificador.length}/35 caracteres (Alfanumérico livre)`}
                            </span>
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={documentoIdentificador}
                                onChange={(e) => handleDocumentChange(e.target.value)}
                                maxLength={paisOrigem === 'BR' ? 18 : 35}
                                placeholder={getCountryConfig(paisOrigem).placeholder}
                                className={`w-full py-2 px-3 rounded-xl bg-slate-950 border text-xs font-mono text-slate-100 focus:outline-none transition-colors ${
                                  docValidationFeedback
                                    ? docValidationFeedback.isValid
                                      ? 'border-emerald-500/80 focus:border-emerald-400'
                                      : 'border-rose-500/80 focus:border-rose-400'
                                    : 'border-slate-700 focus:border-amber-400'
                                }`}
                              />
                              {docValidationFeedback && (
                                <span className="absolute right-2.5 top-2.5">
                                  {docValidationFeedback.isValid ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                                  )}
                                </span>
                              )}
                            </div>

                            {/* Botão de Consulta na Receita Federal para Empresas do Brasil */}
                            {paisOrigem === 'BR' && (
                              <button
                                type="button"
                                onClick={() => handleLookupReceitaSupplier()}
                                disabled={isSearchingReceita || cleanCNPJ(documentoIdentificador).length !== 14}
                                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow shrink-0 cursor-pointer disabled:cursor-not-allowed"
                              >
                                {isSearchingReceita ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                                    <span>Buscando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Search className="w-3.5 h-3.5 text-slate-950" />
                                    <span>Buscar na Receita</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Validação Condicional Feedback */}
                          {docValidationFeedback && !docValidationFeedback.isValid && (
                            <div className="mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start justify-between gap-2">
                              <div>
                                <span>{docValidationFeedback.message}</span>
                                {paisOrigem === 'BR' && docValidationFeedback.calculatedDV && (
                                  <p className="text-[10px] text-rose-400 mt-0.5 font-mono">
                                    DV Oficial Calculado: <strong>{docValidationFeedback.calculatedDV}</strong>
                                  </p>
                                )}
                              </div>
                              {paisOrigem === 'BR' && docValidationFeedback.calculatedDV && (
                                <button
                                  type="button"
                                  onClick={handleAutoFixCnpj}
                                  className="text-[10px] px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold shrink-0"
                                >
                                  Corrigir DV
                                </button>
                              )}
                            </div>
                          )}
                          {docValidationFeedback && docValidationFeedback.isValid && (
                            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {paisOrigem === 'BR'
                                ? 'CNPJ autêntico (validação de DV Módulo 11 da Receita Federal aprovada).'
                                : 'Documento internacional registrado no formato VARCHAR válido.'}
                            </p>
                          )}

                          {/* Feedback de Consulta ReceitaWS */}
                          {receitaError && (
                            <div className="mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-1.5 animate-in fade-in">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <span>{receitaError}</span>
                            </div>
                          )}

                          {receitaSuccessMessage && (
                            <div className="mt-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-1.5 animate-in fade-in">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{receitaSuccessMessage}</span>
                            </div>
                          )}

                          {/* Card Detalhado da Receita Federal para Fornecedores */}
                          {receitaData && (
                            <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 text-slate-200">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-1.5">
                                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                                  {receitaData.tipo || 'MATRIZ'} • {receitaData.porte || 'EMPRESA'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    receitaData.situacao === 'ATIVA'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  Situação: {receitaData.situacao || 'ATIVA'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                <div>
                                  <span className="text-slate-400">Nome Fantasia:</span>{' '}
                                  <strong className="text-slate-200">{receitaData.fantasia || receitaData.nome}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Abertura:</span>{' '}
                                  <strong className="text-slate-200">{receitaData.abertura || 'N/D'}</strong>
                                </div>
                                {receitaData.atividade_principal && receitaData.atividade_principal[0] && (
                                  <div className="sm:col-span-2">
                                    <span className="text-slate-400">Atividade (CNAE):</span>{' '}
                                    <span className="text-amber-200 font-mono text-[10px]">
                                      {receitaData.atividade_principal[0].code} - {receitaData.atividade_principal[0].text}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-slate-400">Endereço:</span>{' '}
                                  <span className="text-slate-300">
                                    {receitaData.logradouro}, {receitaData.numero} - {receitaData.municipio}/{receitaData.uf}
                                  </span>
                                </div>
                                {receitaData.simples && (
                                  <div>
                                    <span className="text-slate-400">Simples Nacional:</span>{' '}
                                    <strong className={receitaData.simples.optante ? 'text-emerald-300' : 'text-slate-400'}>
                                      {receitaData.simples.optante ? 'Optante' : 'Não optante'}
                                    </strong>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Categoria Comercial *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        <option value="Carnes e Porcionamento">Carnes e Porcionamento</option>
                        <option value="Congelados e Petiscos">Congelados e Petiscos</option>
                        <option value="Bebidas e Bar">Bebidas e Bar</option>
                        <option value="Consumo e Embalagens">Consumo e Embalagens</option>
                        <option value="Hortifruti e Frescos">Hortifruti e Frescos</option>
                        <option value="Laticínios">Laticínios</option>
                        <option value="Pescados e Congelados">Pescados e Congelados</option>
                        <option value="Limpeza e Sanitização">Limpeza e Sanitização</option>
                        <option value="Panificação e Pães">Panificação e Pães</option>
                        <option value="Secos e Especiarias">Secos e Especiarias</option>
                        <option value="Geral">Geral</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Nome do Vendedor / Contato
                        </label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Ex: Carlos Eduardo"
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          WhatsApp para Pedidos (com DDI e DDD) *
                        </label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          placeholder="Ex: 5511988887777"
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          E-mail para Pedidos / Cotações *
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="Ex: pedidos@fornecedor.com.br"
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Prazo Médio de Entrega (Dias úteis)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={deliveryDays}
                          onChange={(e) => setDeliveryDays(Number(e.target.value))}
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-300">
                            Ciclo de Atualização de Preços *
                          </label>
                          <span className="text-[10px] text-amber-400 font-semibold">
                            Máx. 45 dias
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="45"
                            required
                            value={priceUpdateIntervalDays}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPriceUpdateIntervalDays(val);
                              if (val > 45) {
                                setPriceIntervalError('O prazo não pode ser superior a 45 dias.');
                              } else {
                                setPriceIntervalError(null);
                              }
                            }}
                            className={`w-full py-2 px-3 rounded-xl bg-slate-950 border text-xs text-slate-100 focus:outline-none font-bold ${
                              priceIntervalError
                                ? 'border-rose-500 text-rose-300'
                                : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-400 font-normal">
                            dias
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Padrão: 30 dias. Limite máximo de tolerância: 45 dias.
                        </p>
                        {priceIntervalError && (
                          <p className="text-[11px] text-rose-400 font-semibold mt-0.5">
                            {priceIntervalError}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Observações / Dias de Entrega
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ex: Entrega rápida nas terças e sextas pela manhã."
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">
                            {linkedProductIds.length} produtos vinculados a este fornecedor
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            Defina quais itens do cardápio e estoque são comprados com ele
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveFormTab('produtos')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-400 transition-all shadow"
                      >
                        Gerenciar Produtos →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: VINCULAR PRODUTOS AO FORNECEDOR */}
                {activeFormTab === 'produtos' && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-amber-400" />
                            Vincular Itens de Estoque a {name.trim() || 'este fornecedor'}
                          </h5>
                          <p className="text-[11px] text-slate-400">
                            Marque os produtos que este parceiro comercial fornece e selecione a estrela para torná-lo <strong>Fornecedor Principal</strong>.
                          </p>
                        </div>

                        {/* Batch Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLinkAllFiltered(productsToDisplay)}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                          >
                            Vincular Filtrados
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnlinkAllFiltered(productsToDisplay)}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-rose-950/30 hover:text-rose-300 border border-slate-700"
                          >
                            Desmarcar Filtrados
                          </button>
                        </div>
                      </div>

                      {/* Filters: Search, Category, Status */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar produto por nome, código SKU..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <select
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="todos">Todas Categorias</option>
                          <option value="porcionamento">Porcionamentos</option>
                          <option value="petisco">Porções & Petiscos</option>
                          <option value="consumo">Consumo & Embalagens</option>
                          <option value="bebida">Bebidas & Bar</option>
                          <option value="limpeza">Limpeza</option>
                        </select>

                        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                          <button
                            type="button"
                            onClick={() => setProductStatusFilter('todos')}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                              productStatusFilter === 'todos'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Todos ({items.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductStatusFilter('vinculados')}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                              productStatusFilter === 'vinculados'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Vinculados ({linkedProductIds.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductStatusFilter('nao_vinculados')}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                              productStatusFilter === 'nao_vinculados'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Não vinculados
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Products Checklist */}
                    <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                      {productsToDisplay.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          Nenhum produto encontrado com os filtros aplicados.
                        </div>
                      ) : (
                        productsToDisplay.map((item) => {
                          const isLinked = linkedProductIds.includes(item.id);
                          const isPrimary = !!primaryProductIds[item.id] || (item.primarySupplierId === editingSupplier?.id && primaryProductIds[item.id] !== false);
                          const customPrice = productCustomPrices[item.id] ?? item.costPrice;

                          // Other primary supplier if exists
                          const otherPrimarySupplier =
                            item.primarySupplierId && item.primarySupplierId !== editingSupplier?.id
                              ? suppliers.find((s) => s.id === item.primarySupplierId)
                              : null;

                          return (
                            <div
                              key={item.id}
                              className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                isLinked
                                  ? 'bg-slate-950/90 border-amber-500/40 shadow-sm'
                                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  onChange={() => toggleProductLink(item.id)}
                                  className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                                />

                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-bold text-amber-400">
                                      {item.code}
                                    </span>
                                    <span className="font-bold text-xs text-slate-200">
                                      {item.name}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                      {getCategoryLabel(item.category)}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                    <span>
                                      Estoque: <strong className="text-slate-300">{formatQuantity(item.currentStock, item.unit)}</strong>
                                    </span>
                                    <span>• Custo Ref: {formatCurrency(item.costPrice)}</span>
                                    {otherPrimarySupplier && !isPrimary && (
                                      <span className="text-slate-500">
                                        (Principal atual: {otherPrimarySupplier.name})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Quoted Price & Primary Supplier Star Toggle */}
                              {isLinked && (
                                <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                                  {/* Quoted Price */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400">R$/{item.unit}:</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={customPrice}
                                      onChange={(e) =>
                                        setProductCustomPrices((prices) => ({
                                          ...prices,
                                          [item.id]: Number(e.target.value),
                                        }))
                                      }
                                      className="w-20 py-1 px-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                                      title="Preço cotado / praticado por este fornecedor"
                                    />
                                  </div>

                                  {/* Star Button for Primary Supplier */}
                                  <button
                                    type="button"
                                    onClick={() => toggleProductPrimary(item.id)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                                      isPrimary
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                                    }`}
                                    title="Marcar este fornecedor como Principal para este produto"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        isPrimary ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                                      }`}
                                    />
                                    <span>{isPrimary ? 'Principal' : 'Tornar Principal'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Form Footer */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    {activeFormTab === 'produtos' ? (
                      <span>
                        Total selecionado:{' '}
                        <strong className="text-amber-400 font-bold">{linkedProductIds.length}</strong> itens
                      </span>
                    ) : (
                      <span>Preencha os dados de contato e vincule os produtos</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md transition-all active:scale-95"
                    >
                      Salvar Fornecedor & Vínculos
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
