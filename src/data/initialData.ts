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
    id: '00000000000001',
    name: 'CEC Conecta',
    tradeName: 'CEC',
    cnpj: '00.000.000/0000-00',
    paisOrigem: 'BR',
    tipoDocumento: 'CNPJ',
    documentoIdentificador: '00000000000001',
    city: 'Patrocinio',
    state: 'MG',
    phone: '(34)99947-2865',
    email: 'jairoeliakim@hotmail.com',
    segment: 'Desenvolvimento de Software',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    address: 'Av. Afonso Pena, 1500 - Centro',
    managerName: 'Administrador Geral',
    databaseConfig: {
      engine: 'postgres',
      host: 'aws-1-sa-east-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      username: 'postgres.oyjiiffepckiekuwvkub',
      password: '?AWhh!8n&C_E$2i',
      ssl: true,
      status: 'conectado',
      isSimulationMode: false,
      tablesCreated: true,
      tablesCount: 15,
      tenantId: '00000000000001',
    },
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
    database: '',
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
// Conforme solicitado: ******
export const INITIAL_DEMO_USERS: AuthUser[] = [
  {
    id: 'usr-admin-01',
    name: 'Administrador do Sistema',
    email: 'admin@sistema.com',
    role: 'administrador',
    companyId: '00000000000001',
    companyName: 'CEC Conecta',
    avatarUrl: '',
    phone: '(31)99947-2865',
    pin: '@dm!n2026',
    lastLogin: new Date().toISOString(),
    status: 'ativo',
    matricula: 'ADM-001',
  },
];
