import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Clock,
  RefreshCw,
  MessageCircle,
  Smartphone,
  Bell,
  Send,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { CountDay, CountScheduleConfig, UserRole, canChangeCountSchedule } from '../types';

interface CountScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSchedule: CountScheduleConfig;
  onSaveSchedule: (newSchedule: CountScheduleConfig, applyToAllItems: boolean) => void;
  currentRole: UserRole;
  restaurantName?: string;
}

const ALL_DAYS: { id: CountDay; label: string; short: string }[] = [
  { id: 'domingo', label: 'Domingo', short: 'Dom' },
  { id: 'segunda', label: 'Segunda-feira', short: 'Seg' },
  { id: 'terca', label: 'Terça-feira', short: 'Ter' },
  { id: 'quarta', label: 'Quarta-feira', short: 'Qua' },
  { id: 'quinta', label: 'Quinta-feira', short: 'Qui' },
  { id: 'sexta', label: 'Sexta-feira', short: 'Sex' },
  { id: 'sabado', label: 'Sábado', short: 'Sáb' },
];

export const CountScheduleModal: React.FC<CountScheduleModalProps> = ({
  isOpen,
  onClose,
  currentSchedule,
  onSaveSchedule,
  currentRole,
  restaurantName = 'Boi Vitorio',
}) => {
  const [selectedDays, setSelectedDays] = useState<CountDay[]>(currentSchedule.defaultDays);
  const [applyToAllItems, setApplyToAllItems] = useState(true);
  const [notes, setNotes] = useState(currentSchedule.notes || '');

  // WhatsApp Notification States
  const [whatsappNotification, setWhatsappNotification] = useState<boolean>(
    currentSchedule.whatsappNotification ?? false
  );
  const [whatsappPhone, setWhatsappPhone] = useState<string>(
    currentSchedule.whatsappPhone || ''
  );
  const [whatsappReminderTime, setWhatsappReminderTime] = useState<string>(
    currentSchedule.whatsappReminderTime || '08:00'
  );
  const [whatsappCustomMessage, setWhatsappCustomMessage] = useState<string>(
    currentSchedule.whatsappCustomMessage || ''
  );
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Sync state whenever modal opens or currentSchedule updates
  useEffect(() => {
    if (isOpen) {
      setSelectedDays(currentSchedule.defaultDays);
      setApplyToAllItems(true);
      setNotes(currentSchedule.notes || '');
      setWhatsappNotification(currentSchedule.whatsappNotification ?? false);
      setWhatsappPhone(currentSchedule.whatsappPhone || '');
      setWhatsappReminderTime(currentSchedule.whatsappReminderTime || '08:00');
      setWhatsappCustomMessage(currentSchedule.whatsappCustomMessage || '');
      setCopiedSuccess(false);
    }
  }, [isOpen, currentSchedule]);

  if (!isOpen) return null;

  const isAllowed = canChangeCountSchedule(currentRole);

  const toggleDay = (day: CountDay) => {
    if (!isAllowed) return;
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) {
        alert('É necessário manter pelo menos um dia padrão de contagem selecionado.');
        return;
      }
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleApplyPreset = (days: CountDay[]) => {
    if (!isAllowed) return;
    setSelectedDays(days);
  };

  const getDefaultReminderMessage = () => {
    const daysFormatted = selectedDays
      .map((d) => ALL_DAYS.find((item) => item.id === d)?.label || d)
      .join(', ');

    return `🔔 *LEMBRETE DE CONTAGEM DE ESTOQUE*\n` +
      `🏢 *${restaurantName.toUpperCase()}*\n\n` +
      `Olá equipe! Hoje é dia oficial de contagem de estoque periódico (${daysFormatted}).\n\n` +
      `📋 *Ação solicitada:* Acesse o módulo de Conferência, realize a contagem física real dos itens no estoque e registre lotes e validades no sistema.\n` +
      `⏰ *Horário do lembrete:* ${whatsappReminderTime || '08:00'}\n\n` +
      `_Lembrete automático configurado pela Gerência Operacional_`;
  };

  const effectiveMessage = whatsappCustomMessage.trim() || getDefaultReminderMessage();

  const getTestWhatsAppLink = () => {
    let cleanPhone = whatsappPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }
    if (cleanPhone.length >= 10) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(effectiveMessage)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(effectiveMessage)}`;
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(effectiveMessage);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    } catch {
      // fallback
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    }
  };

  const handleResetToDefaultMessage = () => {
    setWhatsappCustomMessage(getDefaultReminderMessage());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) return;

    const updatedSchedule: CountScheduleConfig = {
      defaultDays: selectedDays,
      updatedBy: currentRole === 'administrador' ? 'Administrador Geral' : 'Gerente Operacional',
      updatedAt: new Date().toISOString(),
      notes: notes.trim(),
      whatsappNotification,
      whatsappPhone: whatsappPhone.trim(),
      whatsappReminderTime: whatsappReminderTime || '08:00',
      whatsappCustomMessage: whatsappCustomMessage.trim(),
    };

    onSaveSchedule(updatedSchedule, applyToAllItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Dias Padrão de Contagem & Lembretes
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADM & Gerente
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Defina o cronograma oficial e configure lembretes automáticos via WhatsApp para a equipe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {!isAllowed ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-100">Acesso Restrito</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Apenas o <strong>Gerente</strong> e o <strong>Administrador</strong> têm permissão para alterar os dias padrão de contagem e os lembretes de equipe. Seu perfil atual é{' '}
              <span className="text-amber-400 font-semibold capitalize">{currentRole}</span>.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Entendi e Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Atalhos Rápidos de Frequência:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(['quarta', 'domingo'])}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-all active:scale-95 cursor-pointer"
                >
                  Quarta e Domingo (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(['segunda', 'quarta', 'sexta'])}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-all active:scale-95 cursor-pointer"
                >
                  Seg, Qua e Sex
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(['terca', 'quinta'])}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-all active:scale-95 cursor-pointer"
                >
                  Terça e Quinta
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'])}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-all active:scale-95 cursor-pointer"
                >
                  Diário (Todos os Dias)
                </button>
              </div>
            </div>

            {/* Days Selection Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span>Selecione os dias da semana para contagem:</span>
                <span className="text-amber-400 font-bold">
                  {selectedDays.length} dia{selectedDays.length > 1 ? 's' : ''} ativo{selectedDays.length > 1 ? 's' : ''}
                </span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_DAYS.map((day) => {
                  const isSelected = selectedDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">{day.short}</span>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                              : 'border-slate-700'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </div>
                      </div>
                      <span className="text-[11px] mt-2 block font-medium truncate">
                        {day.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* WhatsApp Notification Section (NOVO CAMPO) */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/40 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">
                        Notificação via WhatsApp
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        whatsappNotification
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {whatsappNotification ? 'Ativada' : 'Desativada'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Permite que a gerência configure e dispare lembretes automáticos de contagem para o conferente e equipe nos dias oficiais.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={whatsappNotification}
                    onChange={(e) => setWhatsappNotification(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {whatsappNotification && (
                <div className="pt-3 border-t border-slate-800/80 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Phone or Group */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Telefone ou Grupo da Equipe:</span>
                      </label>
                      <input
                        type="text"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        placeholder="Ex: (31) 98888-2222 ou Grupo Estoque"
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Número com DDD (ex: 31988882222) ou nome do canal de contagem.
                      </span>
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Horário do Lembrete nos dias de contagem:</span>
                      </label>
                      <input
                        type="time"
                        value={whatsappReminderTime}
                        onChange={(e) => setWhatsappReminderTime(e.target.value)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-400 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Horário de envio nos {selectedDays.length} dias programados.
                      </span>
                    </div>
                  </div>

                  {/* Message customization */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Mensagem do Lembrete:</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleResetToDefaultMessage}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Carregar Mensagem Padrão
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={whatsappCustomMessage}
                      onChange={(e) => setWhatsappCustomMessage(e.target.value)}
                      placeholder="Personalize o texto que a equipe receberá via WhatsApp..."
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none font-sans"
                    />
                  </div>

                  {/* Message Preview and Test Button */}
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                      <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Pré-visualização do Lembrete via WhatsApp:</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyMessage}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all cursor-pointer border border-slate-700"
                          title="Copiar texto formatado do lembrete"
                        >
                          {copiedSuccess ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copiar Texto</span>
                            </>
                          )}
                        </button>

                        <a
                          href={getTestWhatsAppLink()}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all shadow-sm active:scale-95 cursor-pointer"
                          title="Abrir WhatsApp agora para testar o envio desta mensagem para a equipe"
                        >
                          <Send className="w-3 h-3" />
                          <span>Testar Envio via WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* WhatsApp bubble design */}
                    <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-xs text-emerald-100 font-sans whitespace-pre-line leading-relaxed shadow-inner">
                      {effectiveMessage}
                      <div className="text-[10px] text-emerald-400/80 text-right mt-1 font-mono">
                        {whatsappReminderTime || '08:00'} ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sync with items toggle */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllItems}
                  onChange={(e) => setApplyToAllItems(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Atualizar os dias de contagem de todos os itens cadastrados no estoque
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                    Sincroniza automaticamente a rotina dos porcionamentos, petiscos e consumos para coincidirem com estes dias padrão.
                  </span>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo / Observações da alteração (Opcional):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Ajuste para coincidir com a escala dos conferentes"
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Last update notice */}
            {currentSchedule.updatedAt && (
              <div className="text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Última atualização por <strong>{currentSchedule.updatedBy}</strong> em{' '}
                    {new Date(currentSchedule.updatedAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(currentSchedule.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {currentSchedule.whatsappNotification && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <MessageCircle className="w-3 h-3" />
                    Lembretes WhatsApp ativos ({currentSchedule.whatsappReminderTime || '08:00'})
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Salvar Novo Cronograma
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
