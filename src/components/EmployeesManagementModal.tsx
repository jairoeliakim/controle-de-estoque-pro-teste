import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Briefcase,
  ShoppingCart,
  UserCheck,
  Shield,
  Lock,
  Edit2,
  Trash2,
  UserX,
  X,
  CheckCircle2,
  AlertTriangle,
  Search,
  Building2,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { generateRandomPassword } from '../utils/passwordSecurity';
import {
  Company,
  Employee,
  EmployeeRole,
  UserRole,
  canBlockOrDeleteGerente,
  canManageEmployees,
} from '../types';
import { cleanCNPJ, toTenantId } from '../utils/cnpjValidator';

interface EmployeesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  activeCompany: Company;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employeeId: string) => void;
  onToggleStatus: (employeeId: string) => void;
  currentRole: UserRole;
}

export const EmployeesManagementModal: React.FC<EmployeesManagementModalProps> = ({
  isOpen,
  onClose,
  employees,
  activeCompany,
  onSaveEmployee,
  onDeleteEmployee,
  onToggleStatus,
  currentRole,
}) => {
  const [selectedRoleTab, setSelectedRoleTab] = useState<'todos' | EmployeeRole>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    role: EmployeeRole;
    email: string;
    password?: string;
    isEdit: boolean;
  } | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<EmployeeRole>('conferente');
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  if (!isOpen) return null;

  const canManage = canManageEmployees(currentRole);

  const cleanActiveCnpj = cleanCNPJ(activeCompany.cnpj || '') || toTenantId(activeCompany.id || '');
  const activeCompId = activeCompany.id;

  // Filtro de funcionários robusto para identificar o tenant por CNPJ sem traços ou ID
  const companyEmployees = employees.filter((emp) => {
    if (!emp) return false;
    // Garante que o funcionário recém-salvo sempre apareça no quadro imediatamente
    if (justSavedId && emp.id === justSavedId) return true;
    const cleanEmpTenant = toTenantId(emp.companyId || '');
    return (
      emp.companyId === activeCompId ||
      (cleanActiveCnpj && cleanEmpTenant === cleanActiveCnpj) ||
      emp.companyId === 'comp-matriz' ||
      emp.companyId === 'emp-matriz' ||
      activeCompId === 'comp-matriz' ||
      activeCompId === 'emp-matriz' ||
      !emp.companyId
    );
  });

  const filteredEmployees = companyEmployees.filter((emp) => {
    if (selectedRoleTab !== 'todos' && emp.role !== selectedRoleTab) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        emp.name.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term) ||
        (emp.matricula && emp.matricula.toLowerCase().includes(term)) ||
        emp.phone.includes(term)
      );
    }
    return true;
  });

  const countByRole = {
    todos: companyEmployees.length,
    gerente: companyEmployees.filter((e) => e.role === 'gerente').length,
    compras: companyEmployees.filter((e) => e.role === 'compras').length,
    conferente: companyEmployees.filter((e) => e.role === 'conferente').length,
  };

  const handleStartCreate = () => {
    setActionError(null);
    setSuccessInfo(null);
    setEditingEmployee(null);
    setName('');
    setMatricula('');
    setEmail('');
    setPhone('(11) 9');
    setRole(selectedRoleTab !== 'todos' ? selectedRoleTab : 'conferente');
    setNotes('');
    const suggested = generateRandomPassword(10);
    setPassword(suggested);
    setShowPassword(true);
    setCopiedPassword(false);
    setIsEditing(true);
  };

  const handleStartEdit = (emp: Employee) => {
    setActionError(null);
    setSuccessInfo(null);
    setEditingEmployee(emp);
    setName(emp.name);
    setMatricula(emp.matricula || '');
    setEmail(emp.email);
    setPhone(emp.phone);
    setRole(emp.role);
    setNotes(emp.notes || '');
    setPassword(emp.password || '');
    setShowPassword(false);
    setCopiedPassword(false);
    setIsEditing(true);
  };

  const handleSuggestRandomPassword = () => {
    const suggested = generateRandomPassword(10);
    setPassword(suggested);
    setShowPassword(true);
    setCopiedPassword(false);
  };

  const handleCopyCreatedPassword = (pwdToCopy: string) => {
    if (!pwdToCopy) return;
    navigator.clipboard.writeText(pwdToCopy);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    // Tenant identificador da empresa é o CNPJ sem traços
    const tenantId = cleanActiveCnpj || (activeCompany.id ? toTenantId(activeCompany.id) : '') || activeCompany.id || '00000000000001';
    const isEdit = !!editingEmployee;
    const empId = editingEmployee ? editingEmployee.id : `emp-${Date.now()}`;

    const newEmployee: Employee = {
      id: empId,
      companyId: tenantId,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      status: editingEmployee ? editingEmployee.status : 'ativo',
      createdAt: editingEmployee ? editingEmployee.createdAt : new Date().toISOString(),
      notes: notes.trim() || undefined,
      lastLogin: editingEmployee?.lastLogin,
      password: password.trim() || undefined,
      matricula: matricula.trim() || undefined,
    };

    onSaveEmployee(newEmployee);
    setJustSavedId(empId);
    setSelectedRoleTab('todos'); // Reseta a aba para exibir o novo funcionário no quadro
    setSearchTerm(''); // Limpa a busca para não ocultar o registro
    setSuccessInfo({
      name: newEmployee.name,
      role: newEmployee.role,
      email: newEmployee.email,
      password: newEmployee.password,
      isEdit,
    });
    setIsEditing(false);
  };

  const handleBlockToggle = (emp: Employee) => {
    setActionError(null);
    // Validação da regra estrita: SOMENTE ADMINISTRADOR E GERENTE CONSEGUEM EXCLUIR OU BLOQUEAR CADASTRO DO TIPO GERENTE
    if (emp.role === 'gerente' && !canBlockOrDeleteGerente(currentRole, 'gerente')) {
      setActionError(
        'Ação Negada: Somente Administrador e Gerente possuem permissão para bloquear ou alterar o status de um cadastro do tipo GERENTE.'
      );
      return;
    }
    onToggleStatus(emp.id);
  };

  const handleDelete = (emp: Employee) => {
    setActionError(null);
    // Validação da regra estrita: SOMENTE ADMINISTRADOR E GERENTE CONSEGUEM EXCLUIR OU BLOQUEAR CADASTRO DO TIPO GERENTE
    if (emp.role === 'gerente' && !canBlockOrDeleteGerente(currentRole, 'gerente')) {
      setActionError(
        'Ação Negada: Somente Administrador e Gerente possuem permissão para excluir um cadastro do tipo GERENTE.'
      );
      return;
    }

    if (
      window.confirm(
        `Tem certeza que deseja excluir o cadastro de ${emp.name} (${emp.role.toUpperCase()}) da filial ${activeCompany.tradeName}?`
      )
    ) {
      onDeleteEmployee(emp.id);
    }
  };

  const getRoleBadge = (empRole: EmployeeRole) => {
    switch (empRole) {
      case 'gerente':
        return {
          label: 'GERENTE',
          desc: 'Gestão completa, auditoria CMV e perdas',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: <Briefcase className="w-3.5 h-3.5 text-blue-400" />,
        };
      case 'compras':
        return {
          label: 'COMPRAS',
          desc: 'Acesso a produtos, fornecedores e pedidos',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'conferente':
        return {
          label: 'CONFERENTE',
          desc: 'Contagem física e anotação de itens avulsos',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <UserCheck className="w-3.5 h-3.5 text-emerald-400" />,
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Quadro de Funcionários & Perfis
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-purple-400" />
                  {activeCompany.tradeName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cadastros separados por <strong>GERENTE</strong>, <strong>COMPRAS</strong> e <strong>CONFERENTE</strong>.
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

        {/* Action Error Banner if rule was violated */}
        {actionError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-3 text-xs animate-in fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{actionError}</p>
              <p className="text-[11px] text-rose-400/90 mt-0.5">
                Regra de Integridade: Cadastros do tipo Gerente só podem ser excluídos ou bloqueados por outro Gerente ou Administrador do sistema.
              </p>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-rose-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-6">
          {isEditing ? (
            /* Formulário de Cadastro / Edição de Funcionário */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  {editingEmployee ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Voltar para lista
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Amanda Silva"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Matrícula do Colaborador
                  </label>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ex: MAT-2026-089"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Perfil / Cargo *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as EmployeeRole)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="gerente">GERENTE (Gestão, Auditoria & Bloqueios)</option>
                    <option value="compras">COMPRAS (Produtos, Fornecedores & Pedidos)</option>
                    <option value="conferente">CONFERENTE (Contagem Física & Anotação de Avulsos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    E-mail Corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="funcionario@saborearte.com.br"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Observações e Setor de Atuação
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Turno da manhã / Responsável pela câmara fria"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 5. Senha de Acesso / Criação com Sugestão Aleatória */}
                <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Senha de Acesso do Colaborador *</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestRandomPassword}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sugerir Senha Aleatória</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie a senha do colaborador ou clique em 'Sugerir Senha Aleatória'"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono pr-20"
                      required
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {password && (
                        <button
                          type="button"
                          onClick={() => handleCopyCreatedPassword(password)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          title="Copiar senha"
                        >
                          {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Você pode digitar uma senha personalizada ou sugerir uma senha aleatória segura. 
                    <strong className="text-slate-300 ml-1">Na tela inicial, o próprio colaborador poderá alterar sua senha caso queira.</strong>
                  </p>
                </div>
              </div>

              {/* Privilege explanation banner based on selected role */}
              <div className="p-3 rounded-lg bg-slate-850 border border-slate-800 text-xs text-slate-300">
                <strong className="text-slate-100 font-semibold block mb-1">
                  Permissões do Perfil {role.toUpperCase()}:
                </strong>
                {role === 'gerente' && (
                  <p className="text-blue-300">
                    • Acesso total aos relatórios de CMV, perdas, cadastro de funcionários, edição de prazos de fornecedores e aprovação de contagens e itens avulsos.
                  </p>
                )}
                {role === 'compras' && (
                  <p className="text-amber-300">
                    • Acesso pleno a cadastro de produtos, cadastro de fornecedores, montagem de ordens de compra e aprovação de itens não cadastrados anotados na conferência.
                  </p>
                )}
                {role === 'conferente' && (
                  <p className="text-emerald-300">
                    • Acesso à contagem física de estoque e funcionalidade de anotar produtos fora da lista/não cadastrados para posterior aprovação.
                  </p>
                )}
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
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm"
                >
                  {editingEmployee ? 'Salvar Alterações' : 'Concluir Cadastro'}
                </button>
              </div>
            </form>
          ) : (
            /* Lista de Funcionários Separados por Tipo */
            <div className="space-y-4">
              {/* Confirmação de Cadastro Criado / Atualizado com Sucesso */}
              {successInfo && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/50 shadow-xl shadow-emerald-950/30 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-emerald-200">
                            {successInfo.isEdit ? 'Cadastro Atualizado com Sucesso!' : 'Funcionário Cadastrado com Sucesso!'}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider">
                            {successInfo.role}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold">
                            Salvo no SGBD
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 mt-1">
                          O colaborador <strong className="text-white font-semibold">{successInfo.name}</strong> ({successInfo.email}) está registrado no quadro e com perfil ativo para acesso imediato.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 mt-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          <span className="flex items-center gap-1 font-mono">
                            <Lock className="w-3 h-3 text-emerald-400" />
                            Senha Configurada:{' '}
                            <strong className="text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded font-mono">
                              {successInfo.password || '******'}
                            </strong>
                            {successInfo.password && (
                              <button
                                type="button"
                                onClick={() => handleCopyCreatedPassword(successInfo.password || '')}
                                className="p-1 rounded text-slate-400 hover:text-emerald-300 ml-0.5 cursor-pointer"
                                title="Copiar senha configurada"
                              >
                                {copiedPassword ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-purple-400" />
                            Tenant da Empresa: <strong className="text-slate-100 font-mono">{cleanActiveCnpj || activeCompany.id}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManage && (
                        <button
                          type="button"
                          onClick={handleStartCreate}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-sm flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Novo Cadastro</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSuccessInfo(null)}
                        className="text-slate-400 hover:text-slate-200 p-1"
                        title="Fechar confirmação"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs por Tipo de Funcionário */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'todos', label: 'Todos os Cargos', count: countByRole.todos },
                      { id: 'gerente', label: 'GERENTE', count: countByRole.gerente },
                      { id: 'compras', label: 'COMPRAS', count: countByRole.compras },
                      { id: 'conferente', label: 'CONFERENTE', count: countByRole.conferente },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedRoleTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        selectedRoleTab === tab.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          selectedRoleTab === tab.id
                            ? 'bg-blue-800 text-blue-100'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {canManage && (
                  <button
                    onClick={handleStartCreate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-sm active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Novo Funcionário</span>
                  </button>
                )}
              </div>

              {/* Filtro de Busca */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar funcionário por nome, e-mail ou telefone..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Tabela / Cards de Funcionários */}
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs">
                    Nenhum funcionário cadastrado nesta categoria para a empresa selecionada.
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const roleInfo = getRoleBadge(emp.role);
                    const isBlocked = emp.status === 'bloqueado';
                    const isTargetGerente = emp.role === 'gerente';
                    const canAlterThisGerente = !isTargetGerente || canBlockOrDeleteGerente(currentRole, 'gerente');
                    const isJustSaved = emp.id === justSavedId;

                    return (
                      <div
                        key={emp.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isJustSaved
                            ? 'bg-emerald-950/30 border-emerald-500/80 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50'
                            : isBlocked
                            ? 'bg-slate-900/60 border-rose-900/40 opacity-75'
                            : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isJustSaved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isBlocked
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-700 text-slate-200 border border-slate-600'
                            }`}
                          >
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-100 text-sm">
                                {emp.name}
                              </h4>
                              {isJustSaved && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Recém Salvo
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.badge}`}
                              >
                                {roleInfo.icon}
                                {roleInfo.label}
                              </span>
                              {emp.matricula && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                                  Matrícula: {emp.matricula}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                  isBlocked
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {isBlocked ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                    <span>Aguardando Aprovação de Gerente</span>
                                  </>
                                ) : (
                                  'Ativo'
                                )}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                              <span>{emp.email}</span>
                              <span>•</span>
                              <span>{emp.phone}</span>
                              {emp.notes && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-300 italic">{emp.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        {canManage && (
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            {/* Editar */}
                            <button
                              onClick={() => handleStartEdit(emp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                              title="Editar cadastro do funcionário"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Bloquear / Desbloquear / Aprovar */}
                            <button
                              onClick={() => handleBlockToggle(emp)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                                isBlocked
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-sm font-bold'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                              } ${
                                isTargetGerente && !canAlterThisGerente
                                  ? 'opacity-40 cursor-not-allowed'
                                  : ''
                              }`}
                              title={
                                isTargetGerente && !canAlterThisGerente
                                  ? 'Apenas Administrador e Gerente podem bloquear um Gerente'
                                  : isBlocked
                                  ? 'Aprovar e liberar acesso do funcionário'
                                  : 'Bloquear acesso do funcionário'
                              }
                            >
                              <UserX className="w-3 h-3" />
                              <span>{isBlocked ? 'Aprovar Acesso' : 'Bloquear'}</span>
                            </button>

                            {/* Excluir */}
                            <button
                              onClick={() => handleDelete(emp)}
                              className={`p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors ${
                                isTargetGerente && !canAlterThisGerente
                                  ? 'opacity-40 cursor-not-allowed'
                                  : ''
                              }`}
                              title={
                                isTargetGerente && !canAlterThisGerente
                                  ? 'Apenas Administrador e Gerente podem excluir um Gerente'
                                  : 'Excluir cadastro do funcionário'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>
              Segurança RBAC: Funcionários Compras e Gerente gerenciam produtos e fornecedores. Exclusão de Gerente restrita a Gerente e Administrador.
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
