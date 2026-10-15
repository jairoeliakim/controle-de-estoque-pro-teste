import React, { useState } from 'react';
import { Shield, KeyRound, CheckCircle2, AlertTriangle, UserCheck, Lock } from 'lucide-react';
import { SupervisorAuthorization, UserRole } from '../types';

interface SupervisorReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorize: (auth: SupervisorAuthorization) => void;
  currentRole: UserRole;
  currentDayName: string;
}

export const SupervisorReleaseModal: React.FC<SupervisorReleaseModalProps> = ({
  isOpen,
  onClose,
  onAuthorize,
  currentRole,
  currentDayName,
}) => {
  const [supervisorName, setSupervisorName] = useState('Carlos Mendes (Gerente Operacional)');
  const [supervisorRole, setSupervisorRole] = useState<'gerente' | 'administrador'>('gerente');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [reason, setReason] = useState('Balanço extraordinário fora do cronograma');
  const [customNotes, setCustomNotes] = useState('');
  const [pinError, setPinError] = useState(false);

  if (!isOpen) return null;

  const isCurrentRoleSupervisor = currentRole === 'administrador' || currentRole === 'gerente';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If already in supervisor role in app, direct approval or PIN 1234
    if (!isCurrentRoleSupervisor && supervisorPin !== '1234' && supervisorPin.trim().length < 4) {
      setPinError(true);
      return;
    }

    const auth: SupervisorAuthorization = {
      isAuthorized: true,
      authorizedBy: supervisorName,
      authorizedRole: supervisorRole,
      authorizedAt: new Date().toISOString(),
      reason: reason + (customNotes ? ` - ${customNotes}` : ''),
      notes: customNotes,
    };

    onAuthorize(auth);
    onClose();
  };

  const handleQuickFillPin = () => {
    setSupervisorPin('1234');
    setPinError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Liberação de Conferência de Superior
              </h3>
              <p className="text-xs text-slate-400">
                Autorização obrigatória de <strong>Gerente ou ADM</strong> para contagem fora do dia padrão
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

        {/* Warning Banner */}
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span>
              Hoje é <strong>{currentDayName}</strong> (dia não predefinido no cronograma regular de contagem).
            </span>
            <span className="block text-slate-300 mt-0.5">
              O conferente pode efetuar a contagem normalmente assim que esta autorização for registrada pelo Gerente ou Administrador.
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Supervisor selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cargo do Superior *
              </label>
              <select
                value={supervisorRole}
                onChange={(e) => {
                  const role = e.target.value as 'gerente' | 'administrador';
                  setSupervisorRole(role);
                  setSupervisorName(
                    role === 'administrador'
                      ? 'Roberto Silva (Administrador / Diretor)'
                      : 'Carlos Mendes (Gerente Operacional)'
                  );
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                <option value="gerente">Gerente Operacional</option>
                <option value="administrador">Administrador Geral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Superior *
              </label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                required
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Motivo da Contagem Extraordinária *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            >
              <option value="Balanço extraordinário fora do cronograma">
                Balanço extraordinário fora do cronograma
              </option>
              <option value="Suspeita de divergência de estoque / Auditoria interna">
                Suspeita de divergência de estoque / Auditoria interna
              </option>
              <option value="Preparação para evento / Feriado prolongado">
                Preparação para evento / Feriado prolongado
              </option>
              <option value="Recebimento excepcional de carga">
                Recebimento excepcional de carga
              </option>
              <option value="Troca ou remanejamento de equipe de cozinha">
                Troca ou remanejamento de equipe de cozinha
              </option>
              <option value="Outro motivo operacional">Outro motivo operacional</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observações Adicionais (Opcional)
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Ex: Liberado para conferir apenas carnes e petiscos após fim de semana agitado"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* PIN or Verification */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Senha / PIN de Liberação do Superior (ADM ou Gerente) *
              </label>
              <button
                type="button"
                onClick={handleQuickFillPin}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Preencher PIN padrão (1234)
              </button>
            </div>

            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={supervisorPin}
                onChange={(e) => {
                  setSupervisorPin(e.target.value);
                  setPinError(false);
                }}
                placeholder="Digite o PIN do Gerente/ADM (ex: 1234)"
                className={`w-full py-2 px-3 rounded-lg bg-slate-900 border ${
                  pinError ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-slate-100'
                } text-sm font-mono tracking-widest focus:outline-none focus:border-amber-400`}
              />
            </div>

            {pinError && (
              <p className="text-[11px] text-rose-400 font-medium">
                PIN incorreto! Digite o PIN de 4 dígitos do superior (use 1234 para demonstração).
              </p>
            )}

            {isCurrentRoleSupervisor && (
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Você está logado como {currentRole.toUpperCase()}, podendo liberar a contagem diretamente.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Liberação de Conferência</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
