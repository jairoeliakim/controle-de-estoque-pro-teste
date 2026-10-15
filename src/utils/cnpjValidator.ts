import { Supplier } from '../types';
import { normalizeText } from './invoiceParser';

export interface CNPJValidationResult {
  isValid: boolean;
  cleanCnpj: string;
  formattedCnpj: string;
  error?: string;
  isRepeatedDigits: boolean;
  isCorrectLength: boolean;
  calculatedCheckDigits?: string;
  actualCheckDigits?: string;
}

/**
 * Normaliza um CNPJ (numérico ou alfanumérico) para 14 caracteres: [A-Z0-9]{12}[0-9]{2}.
 * Remove máscara/pontuação, converte para maiúsculas e garante que os 2 últimos (DV) sejam numéricos.
 */
export function cleanCNPJ(raw: string): string {
  const alnum = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
  return alnum.slice(0, 12) + alnum.slice(12).replace(/\D/g, '');
}

/**
 * Valor de cada caractere no cálculo do DV: código ASCII - 48
 * ('0'-'9' => 0-9, 'A' => 17, ..., 'Z' => 42). Para CNPJ só numérico o resultado é idêntico ao antigo.
 */
function cnpjCharValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function computeCheckDigit(chars: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += cnpjCharValue(chars[i]) * weights[i];
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * Validação oficial de CNPJ (numérico e alfanumérico) — Módulo 11 da Receita Federal do Brasil
 */
export function validateCNPJ(cnpj: string): CNPJValidationResult {
  const clean = cleanCNPJ(cnpj);

  if (!clean) {
    return {
      isValid: false,
      cleanCnpj: '',
      formattedCnpj: '',
      error: 'CNPJ não informado',
      isRepeatedDigits: false,
      isCorrectLength: false,
    };
  }

  if (clean.length !== 14) {
    return {
      isValid: false,
      cleanCnpj: clean,
      formattedCnpj: formatCNPJ(clean),
      error: `CNPJ deve conter exatamente 14 caracteres (informados: ${clean.length})`,
      isRepeatedDigits: false,
      isCorrectLength: false,
    };
  }

  // Elimina sequências repetidas (ex: 11111111111111, AAAAAAAAAAAAAA)
  if (/^([A-Z0-9])\1{13}$/.test(clean)) {
    return {
      isValid: false,
      cleanCnpj: clean,
      formattedCnpj: formatCNPJ(clean),
      error: 'CNPJ inválido: todos os caracteres são repetidos',
      isRepeatedDigits: true,
      isCorrectLength: true,
    };
  }

  const base12 = clean.substring(0, 12);
  const digit1 = computeCheckDigit(base12, CNPJ_WEIGHTS_1);
  const digit2 = computeCheckDigit(base12 + digit1, CNPJ_WEIGHTS_2);

  const calculatedCheckDigits = `${digit1}${digit2}`;
  const actualCheckDigits = clean.substring(12, 14);
  const isValid = calculatedCheckDigits === actualCheckDigits;

  return {
    isValid,
    cleanCnpj: clean,
    formattedCnpj: formatCNPJ(clean),
    isRepeatedDigits: false,
    isCorrectLength: true,
    calculatedCheckDigits,
    actualCheckDigits,
    error: isValid
      ? undefined
      : `Dígitos verificadores inconsistentes (${actualCheckDigits}). O cálculo oficial da Receita Federal resulta em ${calculatedCheckDigits}.`,
  };
}

/**
 * Converte um id/CNPJ em identificador de tenant (CNPJ limpo) quando ele realmente tem formato de CNPJ;
 * caso contrário devolve '' (ex.: ids legados como 'comp-matriz').
 */
export function toTenantId(raw: string): string {
  const c = cleanCNPJ(raw);
  return /^[A-Z0-9]{12}[0-9]{2}$/.test(c) ? c : '';
}

/**
 * Formata CNPJ (numérico ou alfanumérico) no padrão XX.XXX.XXX/XXXX-DD, de forma progressiva
 * (serve para máscara durante a digitação).
 */
export function formatCNPJ(cnpj: string): string {
  const c = cleanCNPJ(cnpj);
  let out = c.slice(0, 2);
  if (c.length > 2) out += '.' + c.slice(2, 5);
  if (c.length > 5) out += '.' + c.slice(5, 8);
  if (c.length > 8) out += '/' + c.slice(8, 12);
  if (c.length > 12) out += '-' + c.slice(12, 14);
  return out;
}

/**
 * Gera os dígitos verificadores corretos para uma base de 12 caracteres (numéricos ou alfanuméricos)
 */
export function calculateCNPJCheckDigits(base12Digits: string): string {
  const base = (base12Digits || '').toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(12, '0').slice(0, 12);
  const digit1 = computeCheckDigit(base, CNPJ_WEIGHTS_1);
  const digit2 = computeCheckDigit(base + digit1, CNPJ_WEIGHTS_2);
  return `${digit1}${digit2}`;
}

/**
 * Corrige o CNPJ ajustando os dígitos verificadores oficiais
 */
export function autoFixCNPJCheckDigits(rawCnpj: string): string {
  const alnum = (rawCnpj || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (alnum.length < 12) return formatCNPJ(alnum);
  const base12 = alnum.substring(0, 12);
  const check = calculateCNPJCheckDigits(base12);
  return formatCNPJ(`${base12}${check}`);
}

/**
 * Busca fornecedor existente por CNPJ ou por Nome (Razão Social / Nome Fantasia)
 */
export function findSupplierInDatabase(
  suppliers: Supplier[],
  cnpj?: string,
  name?: string
): { found: boolean; supplier: Supplier | null; matchType: 'cnpj' | 'name' | null } {
  if (!suppliers || suppliers.length === 0) {
    return { found: false, supplier: null, matchType: null };
  }

  const cleanTargetCnpj = cleanCNPJ(cnpj || '');

  // 1º Prioridade: Busca por CNPJ
  if (cleanTargetCnpj.length >= 12) {
    const byCnpj = suppliers.find((s) => {
      const sCnpj = cleanCNPJ(s.cnpj || '');
      return sCnpj === cleanTargetCnpj;
    });
    if (byCnpj) {
      return { found: true, supplier: byCnpj, matchType: 'cnpj' };
    }
  }

  // 2º Prioridade: Busca por Nome ou Nome Fantasia
  if (name && name.trim().length > 2) {
    const normTargetName = normalizeText(name);
    const byName = suppliers.find((s) => {
      const normSName = normalizeText(s.name);
      return (
        normSName === normTargetName ||
        (normSName.length > 5 && normTargetName.includes(normSName)) ||
        (normTargetName.length > 5 && normSName.includes(normTargetName))
      );
    });
    if (byName) {
      return { found: true, supplier: byName, matchType: 'name' };
    }
  }

  return { found: false, supplier: null, matchType: null };
}
