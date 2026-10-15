import { cleanCNPJ, formatCNPJ } from '../utils/cnpjValidator';

export interface ReceitaWSAtividade {
  code: string;
  text: string;
}

export interface ReceitaWSSocio {
  nome: string;
  qual: string;
  pais_origem?: string;
  nome_rep_legal?: string;
  qual_rep_legal?: string;
}

export interface ReceitaWSSimples {
  optante: boolean;
  data_opcao?: string | null;
  data_exclusao?: string | null;
  ultima_atualizacao?: string;
}

export interface ReceitaWSSimei {
  optante: boolean;
  data_opcao?: string | null;
  data_exclusao?: string | null;
  ultima_atualizacao?: string;
}

export interface ReceitaWSResponse {
  status: 'OK' | 'ERROR';
  message?: string;
  cnpj?: string;
  tipo?: string; // MATRIZ | FILIAL
  porte?: string;
  nome?: string; // Razão Social
  fantasia?: string; // Nome Fantasia
  abertura?: string;
  atividade_principal?: ReceitaWSAtividade[];
  atividades_secundarias?: ReceitaWSAtividade[];
  natureza_juridica?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  efr?: string;
  situacao?: string; // ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA
  data_situacao?: string;
  motivo_situacao?: string;
  situacao_especial?: string;
  data_situacao_especial?: string;
  capital_social?: string;
  qsa?: ReceitaWSSocio[];
  simples?: ReceitaWSSimples;
  simei?: ReceitaWSSimei;
  billing?: {
    free?: boolean;
    database?: boolean;
  };
  fromCache?: boolean;
}

export interface ReceitaWSLookupResult {
  success: boolean;
  data?: ReceitaWSResponse;
  error?: string;
  isRateLimit?: boolean;
  isTimeout?: boolean;
  // Campos normalizados para fácil preenchimento nos formulários
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpjFormatado?: string;
  cidade?: string;
  estadoUF?: string;
  telefone?: string;
  email?: string;
  segmento?: string;
  enderecoCompleto?: string;
  responsavelNome?: string;
  situacaoCadastral?: string;
  isAtiva?: boolean;
}

/**
 * Consulta informações completas da empresa na Receita Federal via ReceitaWS
 * Suporta rate-limit (3 req/min) e fallback gracioso
 */
export async function lookupReceitaWsCnpj(rawCnpj: string): Promise<ReceitaWSLookupResult> {
  const cleanCnpj = cleanCNPJ(rawCnpj);

  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return {
      success: false,
      error: 'CNPJ inválido. Digite os 14 caracteres (12 alfanuméricos + 2 dígitos verificadores) para consulta na Receita Federal.',
    };
  }

  try {
    const res = await fetch(`/api/receitaws/${cleanCnpj}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data: ReceitaWSResponse & { code?: number; message?: string } = await res.json();

    if (res.status === 429 || data.code === 429) {
      return {
        success: false,
        isRateLimit: true,
        error:
          data.message ||
          'Limite da API pública da Receita Federal excedido (máximo de 3 consultas por minuto). Aguarde 20 segundos e tente novamente.',
      };
    }

    if (res.status === 504 || data.code === 504) {
      return {
        success: false,
        isTimeout: true,
        error:
          data.message ||
          'A base da Receita Federal demorou para responder. Tente novamente em instantes.',
      };
    }

    if (!res.ok || data.status === 'ERROR') {
      return {
        success: false,
        error: data.message || 'CNPJ não encontrado na base oficial da Receita Federal.',
      };
    }

    // Normalização de dados para formulários
    const primaryActivity =
      data.atividade_principal && data.atividade_principal.length > 0
        ? data.atividade_principal[0].text
        : '';

    // Endereço completo formatado
    const addressParts = [
      data.logradouro ? `${data.logradouro}` : '',
      data.numero ? `nº ${data.numero}` : '',
      data.complemento ? `(${data.complemento})` : '',
      data.bairro ? `Bairro ${data.bairro}` : '',
      data.cep ? `CEP ${data.cep}` : '',
    ].filter(Boolean);
    const enderecoCompleto = addressParts.join(', ');

    // CNPJ formatado no padrão 00.000.000/0001-00
    const cnpjFormatado = formatCNPJ(cleanCnpj);

    // Primeiro sócio ou administrador encontrado
    const firstAdmin = data.qsa?.find(
      (s) =>
        s.qual.toLowerCase().includes('administrador') ||
        s.qual.toLowerCase().includes('diretor') ||
        s.qual.toLowerCase().includes('sócio')
    );
    const responsavelNome = firstAdmin ? firstAdmin.nome : data.qsa?.[0]?.nome || '';

    const situacaoCadastral = data.situacao || 'ATIVA';
    const isAtiva = situacaoCadastral.toUpperCase() === 'ATIVA';

    return {
      success: true,
      data,
      razaoSocial: data.nome || '',
      nomeFantasia: data.fantasia || data.nome || '',
      cnpjFormatado,
      cidade: data.municipio || '',
      estadoUF: data.uf || '',
      telefone: data.telefone || '',
      email: data.email || '',
      segmento: primaryActivity || 'Restaurante & Bar',
      enderecoCompleto,
      responsavelNome,
      situacaoCadastral,
      isAtiva,
    };
  } catch (error: any) {
    console.error('Erro ao consultar ReceitaWS:', error);
    return {
      success: false,
      error: `Erro ao conectar com o serviço de consulta: ${error?.message || 'Falha de rede'}`,
    };
  }
}
