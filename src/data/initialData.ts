import {
  MonthlyPerformance,
  StockItem,
  Supplier,
  LossRecord,
  StockCountSession,
  Company,
  Employee,
  UnlistedCountItem,
  PurchaseOrder,
  SystemSettings,
  AuthUser,
} from '../types';

// Empresa Matriz padrão (corresponde ao seed do banco de dados relacional com tenant CNPJ sem traços)
export const INITIAL_COMPANIES: Company[] = [
  {
    id: '12345678000190',
    name: 'Restaurante & Bar Gourmet (Matriz)',
    tradeName: 'Matriz Gourmet',
    cnpj: '12.345.678/0001-90',
    paisOrigem: 'BR',
    tipoDocumento: 'CNPJ',
    documentoIdentificador: '12345678000190',
    city: 'Belo Horizonte',
    state: 'MG',
    phone: '(31) 3333-4444',
    email: 'contato@gourmet.com.br',
    segment: 'Restaurante & Bar Gourmet',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    address: 'Av. Afonso Pena, 1500 - Centro',
    managerName: 'Administrador Geral',
  },
];

// Sem funcionários pré-cadastrados de teste/depuração
export const INITIAL_EMPLOYEES: Employee[] = [];

// Sem itens avulsos de depuração
export const INITIAL_UNLISTED_COUNT_ITEMS: UnlistedCountItem[] = [];

// Sem fornecedores de depuração
export const INITIAL_SUPPLIERS: Supplier[] = [];

// Sem produtos/itens de estoque de depuração
export const INITIAL_ITEMS: StockItem[] = [];

// Sem apontamentos de perdas de depuração
export const INITIAL_LOSSES: LossRecord[] = [];

// Sem histórico de performance simulado de depuração
export const INITIAL_MONTHLY_PERFORMANCE: MonthlyPerformance[] = [];

// Sem sessões de contagem de depuração
export const INITIAL_COUNT_SESSIONS: StockCountSession[] = [];

// Sem pedidos de compra de depuração
export const INITIAL_ORDERS: PurchaseOrder[] = [];

// Parametrização Sistêmica Padrão
export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  outdatedPricePolicy: 'alertar',
  defaultPriceValidityDays: 30,
  notifyOutdatedPrices: true,
  blockOrdersBelowMinSupplierValue: false,

  countSchedule: {
    defaultDays: ['quarta', 'domingo'],
    updatedBy: 'Administrador Geral',
    updatedAt: '2026-01-01T08:00:00.000Z',
    notes: 'Contagens físicas semanais pré-programadas',
    whatsappNotification: false,
    whatsappPhone: '',
    whatsappReminderTime: '18:00',
    whatsappCustomMessage: '',
  },
  countCutoffTime: '23:59',
  requireSupervisorAuthForOffDays: true,
  divergenceTolerancePercent: 3.0,
  blindCountMode: false,

  requireIndividualLogin: true,
  conferenteCanViewPrices: false,
  allowConferenteRegisterUnlisted: true,
  buyerCanRegisterSupplierWithoutCnpj: false,

  targetCmvPercent: 28.5,
  criticalAlertThreshold: 1.0,

  databaseConfig: {
    engine: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'restaurante_estoque_db',
    username: 'postgres',
    password: '',
    ssl: false,
    status: 'desconectado',
    tablesCreated: false,
  },

  updatedAt: '2026-01-01T08:00:00.000Z',
  updatedBy: 'Administrador Geral',
};

// Usuário Administrador padrão para o primeiro acesso
// Conforme solicitado: senha @dm!n2026
export const INITIAL_DEMO_USERS: AuthUser[] = [
  {
    id: 'usr-admin-01',
    name: 'Administrador do Sistema',
    email: 'admin@sistema.com',
    role: 'administrador',
    companyId: '12345678000190',
    companyName: 'Restaurante & Bar Gourmet (Matriz)',
    avatarUrl: '',
    phone: '(31) 98888-7777',
    pin: '@dm!n2026',
    lastLogin: new Date().toISOString(),
  },
];
