import React, { useState, useMemo } from 'react';
import {
  Shield,
  UserCheck,
  Briefcase,
  ShoppingCart,
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  HelpCircle,
  Users,
  Search,
  Globe,
  FileText,
  Check,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { AuthUser, Company, UserRole } from '../types';
import { formatCNPJ, cleanCNPJ, toTenantId } from '../utils/cnpjValidator';
import { hashPassword, verifyPassword, generateRandomPassword, pickStoredSecret } from '../utils/passwordSecurity';
import {
  isInstallCnpj,
  verifyMasterAdmin,
  createMasterAdminAuthUser,
  getMasterAdminConfig,
} from '../utils/adminCredentials';

interface LoginViewProps {
  onLogin: (user: AuthUser, needsInitialCompanySetup?: boolean) => void;
  registeredUsers: AuthUser[];
  onRegisterUser: (newUser: AuthUser) => void;
  companies: Company[];
  activeCompanyId: string;
  onUpdateUserPassword?: (email: string, newPlainPassword: string, tenantId?: string) => Promise<boolean> | boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  registeredUsers,
  onRegisterUser,
  companies,
  activeCompanyId,
  onUpdateUserPassword,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'change-password'>('login');

  // Change Password state (Tela Inicial / Login)
  const [cpEmail, setCpEmail] = useState('');
  const [cpCurrentPassword, setCpCurrentPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSuccess, setCpSuccess] = useState<string | null>(null);
  const [cpCopied, setCpCopied] = useState(false);

  // CNPJ da Empresa como primeiro passo / filtro
  const [cnpjInput, setCnpjInput] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Register form state (apenas conferente e compras com status bloqueado)
  const [regName, setRegName] = useState('');
  const [regMatricula, setRegMatricula] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<'conferente' | 'compras'>('conferente');
  const [regCompanyId, setRegCompanyId] = useState('');
  const [regPin, setRegPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Normaliza o CNPJ digitado
  const cleanCnpj = cleanCNPJ(cnpjInput);

  // 1. Detecção do CNPJ mestre do Administrador (00000000000000 ou 13/14 zeros)
  const isAdminMode = isInstallCnpj(cleanCnpj);

  // 2. Busca da empresa correspondente pelo CNPJ limpo ou formatado
  const matchedCompany = useMemo(() => {
    if (isAdminMode || !cleanCnpj) return null;
    return (
      companies.find((c) => {
        const cClean = cleanCNPJ(c.cnpj || '');
        const idClean = toTenantId(c.id || '');
        return (
          cClean === cleanCnpj ||
          idClean === cleanCnpj ||
          (c.id === '00000000000001' && cleanCnpj === '00000000000001') ||
          (c.id === 'comp-matriz' && cleanCnpj === '00000000000001')
        );
      }) || null
    );
  }, [companies, cleanCnpj, isAdminMode]);

  // 3. Usuários/colaboradores da empresa identificada
  const companyUsers = useMemo(() => {
    if (isAdminMode) {
      return registeredUsers.filter((u) => u.role === 'administrador');
    }
    if (!matchedCompany) return [];
    const compTenant = toTenantId(matchedCompany.id) || matchedCompany.id;
    return registeredUsers.filter((u) => {
      const uTenant = toTenantId(u.companyId || '') || u.companyId;
      return (
        uTenant === compTenant ||
        (compTenant === '00000000000001' && (uTenant === 'comp-matriz' || uTenant === '00000000000001')) ||
        !u.companyId
      );
    });
  }, [registeredUsers, matchedCompany, isAdminMode]);

  // 4. Cadastros ATIVOS da empresa (apenas não bloqueados, conforme regra de governança)
  const activeCompanyUsers = useMemo(() => {
    return companyUsers.filter((u) => u.status !== 'bloqueado');
  }, [companyUsers]);

  // Proteção de dados (LGPD): Apresenta apenas o primeiro nome; o restante aparece criptografado/mascarado
  const maskFullName = (fullName: string) => {
    if (!fullName) return { firstName: '', maskedRest: '' };
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0];
    if (parts.length <= 1) {
      return { firstName, maskedRest: '' };
    }
    const maskedRest = parts
      .slice(1)
      .map((p) => {
        if (p.length <= 1) return '*';
        return p.charAt(0) + '*'.repeat(Math.max(p.length - 1, 3));
      })
      .join(' ');
    return { firstName, maskedRest };
  };

  // Mascara e-mail para privacidade
  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return '••••••';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local.slice(0, 2)}••••••@${domain}`;
  };

  // Formatação com máscara clássica 99.999.999/9999-99 no input
  const handleCnpjChange = (val: string) => {
    setLoginError(null);
    const digitsOnly = cleanCNPJ(val);
    const formatted = formatCNPJ(digitsOnly);

    setCnpjInput(formatted);

    // Se mudou o CNPJ, ajusta campos de usuário
    if (digitsOnly.length >= 8 && /^0+$/.test(digitsOnly)) {
      setLoginEmail('admin@sistema.com');
    }
  };

  const rolesConfig: Record<
    UserRole,
    { title: string; desc: string; icon: React.ReactNode; color: string; badge: string }
  > = {
    administrador: {
      title: 'Administrador',
      desc: 'Acesso pleno a relatórios, estoques, finanças e parametrizações sistêmicas',
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
    gerente: {
      title: 'Gerente Geral',
      desc: 'Liberações de contagem, gestão de colaboradores e análise de perdas & CMV',
      icon: <UserCheck className="w-4 h-4 text-amber-400" />,
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    compras: {
      title: 'Setor de Compras',
      desc: 'Cotações de fornecedores, emissão de pedidos e entrada de notas fiscais',
      icon: <ShoppingCart className="w-4 h-4 text-blue-400" />,
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    },
    conferente: {
      title: 'Conferente de Estoque',
      desc: 'Contagens físicas periódicas e anotação de itens encontrados',
      icon: <Briefcase className="w-4 h-4 text-emerald-400" />,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
  };

  // Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailClean = loginEmail.trim().toLowerCase();
    const passClean = loginPassword.trim();

    // 1. Validação de CNPJ
    if (!cleanCnpj) {
      setLoginError('Por favor informe o CNPJ da empresa para identificar a unidade.');
      return;
    }

    if (!passClean) {
      setLoginError('Por favor informe a senha de acesso.');
      return;
    }

    // 2. CASO CNPJ 00000000000000 (Acesso Administrador Mestre fora do banco)
    if (isAdminMode) {
      const isValidAdmin = verifyMasterAdmin(emailClean || 'admin', passClean);
      if (!isValidAdmin) {
        setLoginError('Senha incorreta para o Super Administrador.');
        return;
      }

      const masterAdmin = createMasterAdminAuthUser();
      // O segundo parâmetro true sinaliza que o Administrador fará o cadastro inicial da empresa
      onLogin(masterAdmin, true);
      return;
    }

    // 3. CASO EMPRESA NORMAL
    if (!matchedCompany) {
      setLoginError(
        'Nenhuma empresa localizada com o CNPJ informado. Se este for o primeiro setup, informe o CNPJ 00.000.000/0000-00 para acessar como Administrador.'
      );
      return;
    }

    if (!emailClean) {
      setLoginError('Informe o e-mail ou nome do colaborador para login.');
      return;
    }

    // Busca o usuário na empresa identificada
    const found = companyUsers.find(
      (u) => u.email.toLowerCase() === emailClean || u.name.toLowerCase() === emailClean
    );

    if (found) {
      // 1. Verificação de status bloqueado / aguardando aprovação de gerente
      if (found.status === 'bloqueado') {
        setLoginError(
          `Acesso Bloqueado: O colaborador "${found.name}" ${found.matricula ? `(Matrícula: ${found.matricula}) ` : ''}está com o acesso bloqueado aguardando aprovação de um gerente da empresa para liberação.`
        );
        return;
      }

      // Validação de senha criptografada via SHA-256 com salt
      const isPassValid = verifyPassword(passClean, pickStoredSecret(found.password_hash, found.pin));
      if (!isPassValid) {
        setLoginError('Senha ou PIN incorreto para este colaborador. Tente novamente.');
        return;
      }

      onLogin({
        ...found,
        companyId: matchedCompany.id,
        companyName: matchedCompany.name,
        lastLogin: new Date().toISOString(),
      });
      return;
    }

    // Permite login de administrador mesmo em CNPJ específico
    if (emailClean === 'admin' || emailClean === 'admin@sistema.com') {
      if (verifyMasterAdmin(emailClean, passClean)) {
        const adminUser: AuthUser = {
          id: 'usr-admin-01',
          name: 'Administrador do Sistema',
          email: 'admin@sistema.com',
          role: 'administrador',
          companyId: matchedCompany.id,
          companyName: matchedCompany.name,
          pin: '[PROTEGIDO]',
          lastLogin: new Date().toISOString(),
        };
        onLogin(adminUser, false);
        return;
      }
    }

    setLoginError(
      `Colaborador "${loginEmail}" não encontrado na empresa ${matchedCompany.tradeName || matchedCompany.name}. Verifique o e-mail informado.`
    );
  };

  // Register form submission (Regra: Apenas conferente e setor de compras, criados como bloqueados aguardando aprovação de gerente)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    // 1. Validação estrita de CNPJ da base: se o CNPJ não existir na base não deve permitir a criação destes usuários
    if (!cleanCnpj) {
      setRegError('Informe o CNPJ da empresa no cabeçalho para validar a unidade antes de cadastrar o colaborador.');
      return;
    }

    if (isAdminMode) {
      setRegError(
        'O CNPJ mestre (00.000.000/0000-00) é exclusivo para parametrizações de Administrador. Para cadastrar colaboradores, informe o CNPJ de uma filial/empresa cadastrada.'
      );
      return;
    }

    // Busca a empresa na base de dados
    const targetCompany = matchedCompany || companies.find((c) => {
      const cClean = cleanCNPJ(c.cnpj || '');
      const idClean = toTenantId(c.id || '');
      return (
        cClean === cleanCnpj ||
        idClean === cleanCnpj ||
        (c.id === regCompanyId && c.id !== '00000000000000')
      );
    });

    if (!targetCompany) {
      setRegError(
        `CNPJ "${cnpjInput}" não localizado na base de dados! Não é permitido criar usuários para empresas não cadastradas. Solicite previamente ao Administrador o cadastro da empresa.`
      );
      return;
    }

    // 2. Validações cadastrais
    if (!regName.trim()) {
      setRegError('Informe o nome completo do colaborador.');
      return;
    }

    // Solicitação obrigatória de matrícula
    if (!regMatricula.trim()) {
      setRegError('Informe a Matrícula do colaborador (campo obrigatório para validação corporativa).');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Informe um e-mail válido para acesso individual.');
      return;
    }

    const emailExists = registeredUsers.some(
      (u) => u.email.toLowerCase() === regEmail.trim().toLowerCase()
    );
    if (emailExists) {
      setRegError('Este e-mail já possui um acesso cadastrado no sistema.');
      return;
    }

    // 3. Regra restrita de cargo: Apenas conferente e compras
    const allowedRole: 'conferente' | 'compras' = regRole === 'compras' ? 'compras' : 'conferente';

    const rawPassword = regPin.trim() || '1234';
    // CRIPTOGRAFIA DA SENHA: Salva o hash seguro com salt
    const securePasswordHash = hashPassword(rawPassword);

    // 4. Criação do acesso com status BLOQUEADO aguardando aprovação de gerente
    const newUser: AuthUser = {
      id: `usr-${Date.now()}`,
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      phone: regPhone.trim() || '(31) 99947-2865',
      role: allowedRole,
      companyId: targetCompany.id,
      companyName: targetCompany.tradeName || targetCompany.name,
      pin: securePasswordHash,
      password_hash: securePasswordHash,
      status: 'bloqueado', // Regra: estes acessos são criados como bloqueados e precisam aguardar aprovação de gerente
      matricula: regMatricula.trim(),
      lastLogin: new Date().toISOString(),
    };

    onRegisterUser(newUser);

    // Feedback claro: usuário criado como bloqueado aguardando aprovação
    setRegSuccess(
      `Cadastro de ${newUser.name} (Matrícula: ${newUser.matricula}) realizado com sucesso! O acesso para o cargo de ${allowedRole.toUpperCase()} foi criado com status BLOQUEADO e aguarda aprovação de um Gerente da empresa (${targetCompany.tradeName || targetCompany.name}) para ser liberado.`
    );

    // Preenche o e-mail no login para conveniência futura
    setLoginEmail(newUser.email);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError(null);
    setCpSuccess(null);

    const emailClean = cpEmail.trim().toLowerCase();
    const currPass = cpCurrentPassword.trim();
    const newPass = cpNewPassword.trim();

    if (!emailClean) {
      setCpError('Por favor informe o seu e-mail de acesso ou nome de usuário.');
      return;
    }

    if (!newPass) {
      setCpError('Por favor informe a nova senha desejada.');
      return;
    }

    if (newPass.length < 4) {
      setCpError('A nova senha deve possuir no mínimo 4 caracteres.');
      return;
    }

    if (newPass !== cpConfirmPassword.trim()) {
      setCpError('A confirmação não confere com a nova senha digitada.');
      return;
    }

    const userFound = registeredUsers.find(
      (u) => u.email.toLowerCase() === emailClean || u.name.toLowerCase() === emailClean
    );

    if (emailClean === 'admin' || emailClean === 'admin@sistema.com') {
      if (currPass && !verifyMasterAdmin(emailClean, currPass)) {
        setCpError('Senha atual de Administrador incorreta.');
        return;
      }
    } else if (userFound && currPass) {
      const isCurrentValid = verifyPassword(currPass, pickStoredSecret(userFound.password_hash, userFound.pin));
      if (!isCurrentValid) {
        setCpError('A senha atual informada está incorreta.');
        return;
      }
    }

    if (onUpdateUserPassword) {
      const ok = await onUpdateUserPassword(emailClean, newPass, matchedCompany?.id);
      if (ok) {
        setCpSuccess('Senha alterada com sucesso! Você já pode entrar com sua nova senha.');
        setLoginEmail(emailClean);
        setLoginPassword(newPass);
      } else {
        setCpError('Falha ao gravar nova senha. Verifique os dados informados.');
      }
    } else {
      setCpSuccess('Senha alterada com sucesso! Você já pode entrar com sua nova senha.');
      setLoginEmail(emailClean);
      setLoginPassword(newPass);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-xl z-10 space-y-5">
        {/* App Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Acesso Seguro com Filtro por CNPJ & Criptografia SHA-256</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center justify-center gap-2">
            <span>Controle de Estoque & Suprimentos</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Informe o CNPJ da sua empresa para carregar os colaboradores ou utilize o CNPJ mestre para setup administrador.
          </p>
        </div>

        {/* Main Authentication Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 p-1.5 text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLoginError(null);
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('register');
                setRegError(null);
                setRegSuccess(null);
                if (matchedCompany) {
                  setRegCompanyId(matchedCompany.id);
                }
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Novo Acesso</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('change-password');
                setCpError(null);
                setCpSuccess(null);
                if (loginEmail) setCpEmail(loginEmail);
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'change-password'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Alterar Senha</span>
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="leading-relaxed">{loginError}</span>
                  </div>
                )}

                {/* 1. CAMPO OBRIGATÓRIO: CNPJ DA EMPRESA (FILTRO & IDENTIFICAÇÃO) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>CNPJ da Empresa (Filtro de Acesso) *</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {cleanCnpj.length}/14 dígitos
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={cnpjInput}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0000-00 ou 00.000.000/0000-00"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
                      required
                    />
                    {cleanCnpj && (
                      <button
                        type="button"
                        onClick={() => {
                          setCnpjInput('');
                          setLoginEmail('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {/* Atalhos Rápidos para Facilitar o Teste do Usuário */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCnpjChange('00000000000000')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1 font-mono"
                    >
                      <Shield className="w-3 h-3 text-purple-400" />
                      <span>CNPJ 00000000000000 (Admin Setup)</span>
                    </button>
                    {companies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCnpjChange(companies[0].cnpj || companies[0].id)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1 font-mono"
                      >
                        <Building2 className="w-3 h-3 text-emerald-400" />
                        <span>Empresa Matriz ({companies[0].cnpj || companies[0].id})</span>
                      </button>
                    )}
                  </div>

                  {/* BANNER 1: MODO ACESSO ADMINISTRADOR GERAL (00000000000000) */}
                  {isAdminMode && (
                    <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/50 text-xs text-purple-200 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-purple-100 text-sm">
                              Acesso Administrador
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-300 font-extrabold uppercase">
                              Setup Inicial
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-300/90 leading-relaxed">
                            CNPJ mestre detectado. Este acesso é mantido <strong>fora do banco relacional</strong> (configurado no <code className="bg-purple-900/60 px-1 py-0.5 rounded font-mono text-[10px]">.gitignore</code>).
                          </p>
                          <div className="p-2 rounded-lg bg-purple-900/40 border border-purple-500/30 text-[11px] text-purple-200 font-medium">
                            👉 <strong>Após o login, você fará o cadastro inicial da empresa e filiais.</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BANNER 2: EMPRESA LOCALIZADA COM SUCESSO */}
                  {matchedCompany && !isAdminMode && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-emerald-100 text-sm">
                              {matchedCompany.tradeName || matchedCompany.name}
                            </h4>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              Empresa Identificada
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-300/90 mt-0.5">
                            {matchedCompany.name} • {matchedCompany.city}/{matchedCompany.state}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-emerald-400 mt-1 font-mono">
                            <span>Tenant: <strong>{matchedCompany.id}</strong></span>
                            <span>•</span>
                            <span>{activeCompanyUsers.length} cadastro{activeCompanyUsers.length === 1 ? '' : 's'} ativo{activeCompanyUsers.length === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BANNER 3: CNPJ DIGITADO MAS NÃO ENCONTRADO */}
                  {!matchedCompany && !isAdminMode && cleanCnpj.length >= 14 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                      <p className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Nenhuma empresa cadastrada com o CNPJ {cnpjInput}.
                      </p>
                      <p className="text-[11px] text-amber-400/90 mt-1 leading-normal">
                        Para o primeiro acesso do sistema, utilize o CNPJ mestre <strong className="font-mono text-white">00.000.000/0000-00</strong> com o usuário Administrador para realizar o cadastro inicial da empresa.
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. SELEÇÃO DE CADASTROS ATIVOS DA EMPRESA COM PROTEÇÃO DE DADOS (APENAS 1º NOME VISÍVEL) */}
                {matchedCompany && activeCompanyUsers.length > 0 && !isAdminMode && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Cadastros Ativos nesta Empresa:</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Proteção de Dados: 1º Nome Visível</span>
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeCompanyUsers.map((u) => {
                        const isSelected = loginEmail.toLowerCase() === u.email.toLowerCase();
                        const { firstName, maskedRest } = maskFullName(u.name);
                        const maskedUserEmail = maskEmail(u.email);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setLoginEmail(u.email);
                              setSelectedUserEmail(u.email);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500 text-slate-100 ring-1 ring-amber-500'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-amber-300 shrink-0">
                              {firstName.slice(0, 1).toUpperCase()}*
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs truncate text-slate-200 flex items-center gap-1.5">
                                <span className="text-white font-bold">{firstName}</span>
                                {maskedRest && (
                                  <span className="font-mono text-slate-500 text-[11px] tracking-wider">
                                    {maskedRest}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="uppercase font-bold text-amber-400">{u.role}</span>
                                <span>•</span>
                                <span className="truncate font-mono text-slate-500">{maskedUserEmail}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. E-MAIL OU USUÁRIO */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>E-mail ou Usuário do Colaborador</span>
                  </label>
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={isAdminMode ? 'admin@sistema.com' : 'ex: funcionario@saborearte.com.br'}
                    autoComplete="off"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
                    required
                  />
                </div>

                {/* 4. SENHA (PROTEGIDA COM CRIPTOGRAFIA SHA-256) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Senha de Acesso</span>
                    </label>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span>Criptografia SHA-256 ativa</span>
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={isAdminMode ? 'Senha do Administrador' : 'Digite sua senha ou PIN'}
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      Primeiro acesso? Solicite a senha inicial ao administrador.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCpEmail(loginEmail);
                        setCpError(null);
                        setCpSuccess(null);
                        setMode('change-password');
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      <span>Alterar Minha Senha</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2 ${
                    isAdminMode
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  <span>{isAdminMode ? 'Entrar como Administrador (Setup Inicial)' : 'Acessar o Sistema'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* REGISTER NEW INDIVIDUAL ACCESS FORM (Apenas Conferente e Compras - Criados como Bloqueados) */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Validação de CNPJ da Empresa na Base */}
                {!matchedCompany && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {isAdminMode
                          ? 'CNPJ Mestre de Instalação (00000000000000)'
                          : cleanCnpj.length >= 14
                          ? `CNPJ "${cnpjInput}" não encontrado na base de dados!`
                          : 'CNPJ da Empresa não informado!'}
                      </p>
                      <p className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed">
                        {isAdminMode
                          ? 'O CNPJ mestre é exclusivo para o Administrador. Para solicitar cadastro individual de colaborador, informe o CNPJ de uma filial/empresa cadastrada.'
                          : 'Não é permitido criar novos acessos para empresas inexistentes na base. Solicite previamente ao Administrador o cadastro da empresa no sistema.'}
                      </p>
                    </div>
                  </div>
                )}

                {regError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs space-y-2 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-emerald-100 text-sm">Cadastro Registrado com Sucesso!</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                            Status: Bloqueado (Aguardando Gerente)
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-300/90 mt-1 leading-relaxed">
                          {regSuccess}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setRegSuccess(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                      >
                        <span>Ir para a Tela de Login</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nome Completo *</span>
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ex: Mariana Lima"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Matrícula do Colaborador *</span>
                    </label>
                    <input
                      type="text"
                      value={regMatricula}
                      onChange={(e) => setRegMatricula(e.target.value)}
                      placeholder="Ex: MAT-2026-089"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span>E-mail Individual *</span>
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="mariana.compras@restaurante.com"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      <span>WhatsApp / Telefone</span>
                    </label>
                    <input
                      type="text"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>

                {/* Senha com criação manual ou sugestão aleatória */}
                <div className="space-y-1 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Senha de Acesso *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomPass = generateRandomPassword(10);
                        setRegPin(randomPass);
                        setShowRegPin(true);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Sugerir Senha Aleatória</span>
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      placeholder="Crie sua senha ou clique em 'Sugerir Senha Aleatória'"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                    >
                      {showRegPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Sua senha será criptografada com algoritmo SHA-256 e poderá ser alterada a qualquer momento na tela inicial.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nível / Cargo Permitido para Auto-Cadastro</span>
                    </label>
                    {/* Regra estrita: apenas conferente e setor de compras */}
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as 'conferente' | 'compras')}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 cursor-pointer font-semibold"
                    >
                      <option value="conferente">Conferente (Contagem Física de Estoque)</option>
                      <option value="compras">Setor de Compras (Cotações, Pedidos & NF-e)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 block">
                      Apenas perfis de Conferente e Compras podem ser solicitados. Acessos Gerenciais são cadastrados exclusivamente pela Gerência.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Empresa Vinculada (CNPJ Validado)</span>
                    </label>
                    <div className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200">
                      {matchedCompany ? (
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100">{matchedCompany.tradeName || matchedCompany.name}</span>
                          <span className="font-mono text-emerald-400 text-[11px]">{matchedCompany.cnpj || matchedCompany.id}</span>
                        </div>
                      ) : (
                        <span className="text-rose-400">Nenhuma empresa validada via CNPJ</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Description Card */}
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${rolesConfig[regRole].color}`}>
                  {rolesConfig[regRole].icon}
                  <div>
                    <span className="font-bold">{rolesConfig[regRole].title}:</span>{' '}
                    <span className="opacity-90">{rolesConfig[regRole].desc}</span>
                  </div>
                </div>

                {/* Banner de Governança sobre Status Bloqueado e Aprovação do Gerente */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Aviso de Governança & Segurança:</span>
                    <p className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">
                      Este acesso individual será criado com status <strong className="text-amber-200">BLOQUEADO</strong>. Para poder realizar login e acessar as funções do restaurante, o colaborador deverá aguardar a aprovação presencial ou remota de um <strong>Gerente</strong> da empresa.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!matchedCompany || isAdminMode}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mt-2 ${
                    !matchedCompany || isAdminMode
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Cadastrar e Solicitar Aprovação de Gerente</span>
                </button>
              </form>
            )}

            {/* CHANGE PASSWORD FORM (Tela Inicial / Login) */}
            {mode === 'change-password' && (
              <form onSubmit={handleChangePasswordSubmit} className="space-y-4 animate-in fade-in">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-200">Alteração de Senha do Usuário</h4>
                    <p className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">
                      Defina sua nova senha com proteção criptográfica segura (SHA-256). A alteração é sincronizada imediatamente com o banco do tenant.
                    </p>
                  </div>
                </div>

                {cpError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{cpError}</span>
                  </div>
                )}

                {cpSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs space-y-2.5 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold">{cpSuccess}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setLoginError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Voltar para o Login e Entrar Agora</span>
                    </button>
                  </div>
                )}

                {/* 1. Seleção / Confirmação do Usuário */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Seu E-mail Corporativo ou Usuário *</span>
                  </label>
                  <input
                    type="text"
                    value={cpEmail}
                    onChange={(e) => setCpEmail(e.target.value)}
                    placeholder="ex: funcionario@empresa.com.br"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                    required
                  />
                  {matchedCompany && (
                    <span className="text-[11px] text-slate-400 block mt-1">
                      Filial: <strong className="text-slate-200">{matchedCompany.tradeName || matchedCompany.name}</strong> ({matchedCompany.cnpj})
                    </span>
                  )}
                </div>

                {/* 2. Senha Atual */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Senha Atual</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Primeiro acesso: use a senha inicial informada pelo administrador</span>
                  </label>
                  <div className="relative">
                    <input
                      type={cpShowCurrent ? 'text' : 'password'}
                      value={cpCurrentPassword}
                      onChange={(e) => setCpCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setCpShowCurrent(!cpShowCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {cpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 3. Nova Senha com Botão de Sugestão Aleatória */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nova Senha *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const pwd = generateRandomPassword(10);
                        setCpNewPassword(pwd);
                        setCpConfirmPassword(pwd);
                        setCpShowNew(true);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Sugerir Senha Aleatória</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={cpShowNew ? 'text' : 'password'}
                      value={cpNewPassword}
                      onChange={(e) => setCpNewPassword(e.target.value)}
                      placeholder="Digite ou gere sua nova senha"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono pr-20"
                      required
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {cpNewPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cpNewPassword);
                            setCpCopied(true);
                            setTimeout(() => setCpCopied(false), 2000);
                          }}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-200"
                          title="Copiar nova senha"
                        >
                          {cpCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCpShowNew(!cpShowNew)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-200"
                      >
                        {cpShowNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Confirmação */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-400" />
                    <span>Confirmar Nova Senha *</span>
                  </label>
                  <input
                    type={cpShowNew ? 'text' : 'password'}
                    value={cpConfirmPassword}
                    onChange={(e) => setCpConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha para confirmação"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setCpError(null);
                      setCpSuccess(null);
                    }}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Voltar ao Login
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Salvar Nova Senha</span>
                  </button>
                </div>
              </form>
            )}

            {/* SEGURANÇA E GOVERNANÇA: ORIENTAÇÕES SOBRE SENHAS E ARQUIVO FORA DO BANCO */}
            <div className="pt-4 border-t border-slate-800">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-slate-200">Segurança & Acesso Fora do Banco</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                    .gitignore protegido
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
                  <p>
                    • <strong>Filtro por CNPJ:</strong> Ao digitar o CNPJ, o sistema carrega o nome da empresa e restringe os colaboradores daquela filial.
                  </p>
                  <p>
                    • <strong>Setup com CNPJ 00000000000000:</strong> Apresenta o <em>Acesso Administrador</em> e após o login abre o cadastro inicial da empresa.
                  </p>
                  <p>
                    • <strong>Senhas Criptografadas:</strong> Nenhuma senha é salva em texto puro. O banco guarda apenas hashes criptográficos <strong className="text-slate-300 font-mono">SHA-256 com salt</strong>.
                  </p>
                  <p>
                    • <strong>Admin fora do banco:</strong> As credenciais mestres estão isoladas no arquivo <code className="text-amber-300 font-mono bg-slate-900 px-1 py-0.5 rounded">admin-credentials.json</code>, incluído no <code className="text-purple-300 font-mono bg-slate-900 px-1 py-0.5 rounded">.gitignore</code> para nunca subir ao Git.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          Controle de Estoque & CMV • Governança multi-empresa com isolamento de dados por CNPJ
        </div>
      </div>
    </div>
  );
};
