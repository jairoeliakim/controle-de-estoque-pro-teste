import { validateCNPJ, formatCNPJ } from './cnpjValidator';

export interface CountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  flag: string;
  defaultDocType: string;
  placeholder: string;
  maxLength: number;
  hasMask: boolean;
  maskExample: string;
  description: string;
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  {
    code: 'BR',
    name: 'Brasil',
    flag: '🇧🇷',
    defaultDocType: 'CNPJ',
    placeholder: '00.000.000/0001-00',
    maxLength: 14,
    hasMask: true,
    maskExample: '99.999.999/9999-99',
    description: 'Cadastro Nacional da Pessoa Jurídica (14 dígitos com cálculo oficial Módulo 11)',
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    defaultDocType: 'EIN',
    placeholder: '12-3456789 ou Tax ID',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Employer Identification Number (EIN) / Federal Tax ID',
  },
  {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    defaultDocType: 'NIPC',
    placeholder: 'Ex: 500123456',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Número de Identificação de Pessoa Coletiva (NIPC / NIF Empresarial)',
  },
  {
    code: 'ES',
    name: 'Espanha',
    flag: '🇪🇸',
    defaultDocType: 'CIF/NIF',
    placeholder: 'Ex: B12345678',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Código de Identificación Fiscal / NIF Societario',
  },
  {
    code: 'AR',
    name: 'Argentina',
    flag: '🇦🇷',
    defaultDocType: 'CUIT',
    placeholder: 'Ex: 30-12345678-9',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Código Único de Identificación Tributaria (CUIT)',
  },
  {
    code: 'UY',
    name: 'Uruguai',
    flag: '🇺🇾',
    defaultDocType: 'RUT',
    placeholder: 'Ex: 211234560012',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Registro Único Tributario (RUT)',
  },
  {
    code: 'CL',
    name: 'Chile',
    flag: '🇨🇱',
    defaultDocType: 'RUT',
    placeholder: 'Ex: 76.123.456-7',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Rol Único Tributario (RUT da Empresa)',
  },
  {
    code: 'DE',
    name: 'Alemanha',
    flag: '🇩🇪',
    defaultDocType: 'USt-IdNr',
    placeholder: 'Ex: DE123456789',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Umsatzsteuer-Identifikationsnummer / Steuernummer',
  },
  {
    code: 'FR',
    name: 'França',
    flag: '🇫🇷',
    defaultDocType: 'SIRET',
    placeholder: 'Ex: 123 456 789 00012',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Système d\'Identification du Répertoire des Établissements',
  },
  {
    code: 'IT',
    name: 'Itália',
    flag: '🇮🇹',
    defaultDocType: 'Partita IVA',
    placeholder: 'Ex: IT12345678901',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Partita IVA / Codice Fiscale Aziendale',
  },
  {
    code: 'GB',
    name: 'Reino Unido',
    flag: '🇬🇧',
    defaultDocType: 'VAT/CRN',
    placeholder: 'Ex: GB123456789',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Company Registration Number (CRN) / VAT ID',
  },
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    defaultDocType: 'USCC',
    placeholder: 'Ex: 911100000000000000',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Unified Social Credit Code (USCC)',
  },
  {
    code: 'XX',
    name: 'Outro País',
    flag: '🌐',
    defaultDocType: 'Tax ID',
    placeholder: 'Identificador fiscal / comercial da empresa',
    maxLength: 35,
    hasMask: false,
    maskExample: 'Alfanumérico livre',
    description: 'Registro Comercial ou Fiscal Internacional',
  },
];

export function getCountryConfig(code?: string): CountryConfig {
  const normalized = (code || 'BR').toUpperCase().trim();
  const found = SUPPORTED_COUNTRIES.find((c) => c.code === normalized);
  return (
    found || {
      code: normalized || 'XX',
      name: 'Internacional',
      flag: '🌐',
      defaultDocType: 'Tax ID',
      placeholder: 'Número do documento ou registro fiscal',
      maxLength: 35,
      hasMask: false,
      maskExample: 'Alfanumérico livre',
      description: 'Documento identificador fiscal da empresa',
    }
  );
}

/**
 * Aplica máscara dinâmica conforme o país de origem:
 * - Se BR: aplica máscara clássica 99.999.999/9999-99 limitando a 14 dígitos
 * - Se outro país: remove máscara e deixa campo livre alfanumérico até 35 caracteres
 */
export function formatDynamicDocument(value: string, countryCode: string): string {
  if (!value) return '';
  const country = getCountryConfig(countryCode);

  if (country.code === 'BR') {
    // Máscara brasileira CNPJ 99.999.999/9999-99
    return formatCNPJ(value);
  }

  // Campo livre alfanumérico para estrangeiro (máximo 35 caracteres)
  return value.slice(0, 35);
}

/**
 * Validação condicional globalizada:
 * - Se BR: executa o algoritmo do DV (Dígito Verificador Módulo 11) do CNPJ
 * - Se outro país: apenas valida se não está vazio e não ultrapassou o limite de 35 caracteres
 */
export interface DynamicValidationResult {
  isValid: boolean;
  cleanDocument: string;
  formattedDocument: string;
  errorMessage?: string;
  calculatedCheckDigits?: string;
  actualCheckDigits?: string;
}

export function validateDynamicCompanyDocument(
  documentValue: string,
  countryCode: string,
  docType?: string
): DynamicValidationResult {
  const country = getCountryConfig(countryCode);
  const raw = (documentValue || '').trim();

  if (!raw) {
    return {
      isValid: false,
      cleanDocument: '',
      formattedDocument: '',
      errorMessage: `Informe o documento identificador (${docType || country.defaultDocType}) da empresa.`,
    };
  }

  // 1. Caso Brasil: Executa validação estrita do Módulo 11 da Receita Federal
  if (country.code === 'BR') {
    const cnpjRes = validateCNPJ(raw);
    return {
      isValid: cnpjRes.isValid,
      cleanDocument: cnpjRes.cleanCnpj,
      formattedDocument: cnpjRes.formattedCnpj,
      errorMessage: cnpjRes.error,
      calculatedCheckDigits: cnpjRes.calculatedCheckDigits,
      actualCheckDigits: cnpjRes.actualCheckDigits,
    };
  }

  // 2. Caso Estrangeiro: Validação aberta (não vazio e <= 35 caracteres)
  if (raw.length > 35) {
    return {
      isValid: false,
      cleanDocument: raw,
      formattedDocument: raw,
      errorMessage: `O documento internacional excede o limite máximo de 35 caracteres (digitados: ${raw.length}).`,
    };
  }

  return {
    isValid: true,
    cleanDocument: raw,
    formattedDocument: raw,
  };
}
