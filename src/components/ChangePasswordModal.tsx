import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { generateRandomPassword } from '../utils/passwordSecurity';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
  companyName?: string;
  onSavePassword: (email: string, newPlainPassword: string) => Promise<boolean> | boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail = '',
  currentUserName = '',
  companyName = '',
  onSavePassword,
}) => {
  const [email, setEmail] = useState(currentUserEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSuggestPassword = () => {
    const pwd = generateRandomPassword(10);
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowNewPassword(true);
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetEmail = (email || currentUserEmail).trim();
    if (!targetEmail) {
      setError('Por favor, informe o e-mail cadastrado.');
      return;
    }

    if (!newPassword.trim()) {
      setError('Por favor, informe a nova senha.');
      return;
    }

    if (newPassword.trim().length < 4) {
      setError('A nova senha deve possuir ao menos 4 caracteres.');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('A confirmação não confere com a nova senha digitada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSavePassword(targetEmail, newPassword.trim());
      if (ok) {
        setSuccess('Sua senha foi alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError('Não foi possível atualizar a senha. Verifique os dados informados.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar alteração de senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Alterar Senha de Acesso
              </h3>
              <p className="text-xs text-slate-400">
                {companyName ? `Unidade: ${companyName}` : 'Segurança de Credenciais do Usuário'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Usuário / E-mail */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Colaborador / E-mail de Acesso
            </label>
            <input
              type="email"
              value={currentUserEmail || email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(currentUserEmail)}
              placeholder="seu.email@empresa.com.br"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
            {currentUserName && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                Nome: <strong className="text-slate-300">{currentUserName}</strong>
              </span>
            )}
          </div>

          {/* Senha Atual (opcional ou informativa se logado) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Senha Atual
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Caso seja o primeiro acesso, use a senha inicial informada pelo administrador.
            </span>
          </div>

          {/* Nova Senha com Gerador Aleatório */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Nova Senha *
              </label>
              <button
                type="button"
                onClick={handleSuggestPassword}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Gera uma senha forte e segura automaticamente"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sugerir Senha Aleatória</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite ou gere sua nova senha"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 pr-20 font-mono"
                required
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 rounded text-slate-400 hover:text-slate-200"
                    title="Copiar nova senha"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Confirmação da Nova Senha */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirmar Nova Senha *
            </label>
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha para confirmação"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
              required
            />
          </div>

          {/* Dica de Segurança */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              A nova senha será protegida por hash criptográfico seguro (SHA-256 com salt) e sincronizada automaticamente com o banco relacional.
            </span>
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
