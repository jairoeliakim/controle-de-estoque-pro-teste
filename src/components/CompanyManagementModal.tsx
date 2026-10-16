import React, { useState, useRef } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  Shield,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Edit2,
  Lock,
  X,
  Sparkles,
  Search,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Company, UserRole, canManageCompanies } from '../types';
import { lookupReceitaWsCnpj, ReceitaWSResponse } from '../services/receitaWsService';
import { cleanCNPJ, formatCNPJ, toTenantId, validateCNPJ } from '../utils/cnpjValidator';

interface CompanyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onSaveCompany: (company: Company) => void;
  currentRole: UserRole;
}

export const CompanyManagementModal: React.FC<CompanyManagementModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  onSelectCompany,
  onSaveCompany,
  currentRole,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('SP');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [segment, setSegment] = useState('Restaurante & Bar');
  const [address, setAddress] = useState('');
  const [managerName, setManagerName] = useState('');

  // ReceitaWS state
  const [isSearchingReceita, setIsSearchingReceita] = useState(false);
  const [receitaError, setReceitaError] = useState<string | null>(null);
  const [receitaSuccessMessage, setReceitaSuccessMessage] = useState<string | null>(null);
  const [receitaData, setReceitaData] = useState<ReceitaWSResponse | null>(null);

  if (!isOpen) return null;

  const isAdmin = canManageCompanies(currentRole);

  const handleStartCreate = () => {
    setEditingCompany(null);
    setName('');
    setTradeName('');
    setCnpj('');
    setCity('São Paulo');
    setStateUF('SP');
    setPhone('(11) 9');
    setEmail('');
    setSegment('Desenvolvimento de Software');
    setAddress('');
    setManagerName('');
    setReceitaError(null);
    setReceitaSuccessMessage(null);
    setReceitaData(null);
    setIsEditing(true);
  };

  const handleStartEdit = (comp: Company) => {
    setEditingCompany(comp);
    setName(comp.name);
    setTradeName(comp.tradeName);
    setCnpj(comp.cnpj);
    setCity(comp.city);
    setStateUF(comp.state);
    setPhone(comp.phone);
    setEmail(comp.email);
    setSegment(comp.segment);
    setAddress(comp.address || '');
    setManagerName(comp.managerName || '');
    setReceitaError(null);
    setReceitaSuccessMessage(null);
    setReceitaData(null);
    setIsEditing(true);
  };

  // Evita repetir a consulta automática para o mesmo CNPJ (limite da API pública: 3 consultas/min)
  const lastAutoLookupRef = useRef<string>('');

  const handleCnpjChange = (val: string) => {
    const formatted = formatCNPJ(val);
    setCnpj(formatted);
    setReceitaError(null);
    setReceitaSuccessMessage(null);

    // Busca automática ao completar um CNPJ válido (numérico ou alfanumérico)
    const clean = cleanCNPJ(formatted);
    if (clean.length === 14 && validateCNPJ(clean).isValid && lastAutoLookupRef.current !== clean) {
      lastAutoLookupRef.current = clean;
      handleLookupReceita(clean);
    }
  };

  const handleLookupReceita = async (targetCnpj?: string) => {
    const raw = targetCnpj || cnpj;
    const clean = cleanCNPJ(raw);
    if (clean.length !== 14) {
      setReceitaError('Digite os 14 caracteres do CNPJ para consultar na Receita Federal.');
      return;
    }

    setIsSearchingReceita(true);
    setReceitaError(null);
    setReceitaSuccessMessage(null);

    const result = await lookupReceitaWsCnpj(clean);
    setIsSearchingReceita(false);

    if (!result.success) {
      setReceitaError(result.error || 'Não foi possível consultar os dados na Receita Federal.');
      return;
    }

    // Preenche automaticamente os campos da empresa
    if (result.razaoSocial) setName(result.razaoSocial);
    if (result.nomeFantasia) setTradeName(result.nomeFantasia);
    if (result.cnpjFormatado) setCnpj(result.cnpjFormatado);
    if (result.cidade) setCity(result.cidade);
    if (result.estadoUF) setStateUF(result.estadoUF);
    if (result.telefone) setPhone(result.telefone);
    if (result.email) setEmail(result.email);
    if (result.segmento) setSegment(result.segmento);
    if (result.enderecoCompleto) setAddress(result.enderecoCompleto);
    if (result.responsavelNome) setManagerName(result.responsavelNome);

    if (result.data) {
      setReceitaData(result.data);
    }
    setReceitaSuccessMessage(
      `Dados obtidos com sucesso da Receita Federal! Situação: ${result.situacaoCadastral || 'ATIVA'}.`
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cnpj.trim()) return;

    const cleanCnpjId = cleanCNPJ(cnpj);
    const tenantId = cleanCnpjId || (editingCompany?.id ? toTenantId(editingCompany.id) || editingCompany.id : '00000000000001');

    const newCompany: Company = {
      id: tenantId, // Tenant identificador da empresa é o CNPJ sem traços
      name: name.trim(),
      tradeName: tradeName.trim() || name.trim(),
      cnpj: cnpj.trim(),
      paisOrigem: 'BR',
      tipoDocumento: 'CNPJ',
      documentoIdentificador: tenantId,
      city: city.trim(),
      state: stateUF.trim().toUpperCase(),
      phone: phone.trim(),
      email: email.trim(),
      segment: segment.trim(),
      address: address.trim() || undefined,
      managerName: managerName.trim() || undefined,
      active: true,
      createdAt: editingCompany ? editingCompany.createdAt : new Date().toISOString(),
    };

    onSaveCompany(newCompany);
    setIsEditing(false);
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Gestão Multi-Empresa & Suporte
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Exclusivo Administrador
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cadastre filiais/empresas e transite entre elas para prestar suporte ou auditoria de custos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning if not admin */}
        {!isAdmin && (
          <div className="m-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 text-sm">
            <Lock className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>
              Apenas usuários com perfil de <strong>Administrador</strong> têm permissão para cadastrar novas empresas ou alternar o ambiente de suporte.
            </span>
          </div>
        )}

        <div className="p-6">
          {isEditing ? (
            /* Formulário de Cadastro/Edição de Empresa */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  {editingCompany ? 'Editar Empresa / Filial' : 'Cadastrar Nova Empresa / Filial'}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Voltar à lista
                </button>
              </div>

              {/* Campo Principal: CNPJ com Busca Direta na Receita Federal */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      CNPJ da Empresa / Filial (Tenant Único) *
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Informe o CNPJ para buscar automaticamente Razão Social, Endereço, Contato e Situação na Receita Federal.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-purple-300">
                    {cleanCNPJ(cnpj).length}/14 caracteres
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLookupReceita()}
                    disabled={isSearchingReceita || cleanCNPJ(cnpj).length !== 14}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSearchingReceita ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                        <span>Buscando na Receita...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-purple-200" />
                        <span>Consultar Receita Federal</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Feedback da Consulta ReceitaWS */}
                {receitaError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{receitaError}</span>
                  </div>
                )}

                {receitaSuccessMessage && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{receitaSuccessMessage}</span>
                  </div>
                )}

                {/* Card de Dados Oficiais da ReceitaWS */}
                {receitaData && (
                  <div className="mt-2 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2">
                      <span className="font-bold text-purple-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-400" />
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-400">Natureza Jurídica:</span>{' '}
                        <strong className="text-slate-200">{receitaData.natureza_juridica || 'Sociedade'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Abertura:</span>{' '}
                        <strong className="text-slate-200">{receitaData.abertura || 'N/D'}</strong>
                      </div>
                      {receitaData.atividade_principal && receitaData.atividade_principal[0] && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-400">Atividade Principal (CNAE):</span>{' '}
                          <span className="text-purple-300 font-mono">
                            {receitaData.atividade_principal[0].code} - {receitaData.atividade_principal[0].text}
                          </span>
                        </div>
                      )}
                      {receitaData.simples && (
                        <div>
                          <span className="text-slate-400">Simples Nacional:</span>{' '}
                          <strong className={receitaData.simples.optante ? 'text-emerald-300' : 'text-slate-400'}>
                            {receitaData.simples.optante ? 'Optante' : 'Não optante'}
                          </strong>
                        </div>
                      )}
                      {receitaData.capital_social && (
                        <div>
                          <span className="text-slate-400">Capital Social:</span>{' '}
                          <strong className="text-slate-200">
                            R$ {parseFloat(receitaData.capital_social || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Razão Social Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Restaurante Sabor & Arte Ltda"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    required
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="Ex: Sabor & Arte - Filial Jardins"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Segmento / Especialidade
                  </label>
                  <input
                    type="text"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    placeholder="Ex: Steakhouse, Hamburgueria, Pizzaria"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="São Paulo"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={stateUF}
                    onChange={(e) => setStateUF(e.target.value)}
                    placeholder="SP"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-0000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    E-mail Operacional
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gerencia@filial.com.br"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, Número, Bairro"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Gerente Responsável
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Ex: Juliana Paes"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm"
                >
                  {editingCompany ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                </button>
              </div>
            </form>
          ) : (
            /* Lista de Empresas e Botão de Troca */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar filial por nome ou CNPJ..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {isAdmin && (
                  <button
                    onClick={handleStartCreate}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Nova Empresa</span>
                  </button>
                )}
              </div>

              {/* Grid de Empresas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredCompanies.map((comp) => {
                  const isActive = comp.id === activeCompanyId;

                  return (
                    <div
                      key={comp.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-purple-950/20 border-purple-500/60 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/30'
                          : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-100 text-sm">
                              {comp.tradeName}
                            </h4>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                <CheckCircle2 className="w-3 h-3 text-purple-400" />
                                Empresa Ativa
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {comp.name}
                          </p>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleStartEdit(comp)}
                            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                            title="Editar dados da empresa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-slate-500">CNPJ:</span>
                          <span className="font-mono text-slate-300">{comp.cnpj}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span>
                            {comp.city}/{comp.state} {comp.address && `• ${comp.address}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {comp.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {comp.email}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Ramo: <strong className="text-slate-300 font-medium">{comp.segment}</strong>
                        </span>

                        {isActive ? (
                          <span className="text-xs text-purple-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ambiente Atual
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectCompany(comp.id);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm active:scale-95"
                          >
                            <span>Acessar / Suporte</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>
              Isolamento multi-tenant: produtos, fornecedores e estoques são segmentados por empresa.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
