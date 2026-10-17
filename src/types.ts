export type UserRole = 'administrador' | 'conferente' | 'gerente' | 'compras';

export type CountDay = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado';

export interface SupervisorAuthorization {
  isAuthorized: boolean;
  authorizedBy: string;
  authorizedRole: 'gerente' | 'administrador';
  authorizedAt: string;
  reason: string;
  notes?: string;
}

export interface CountScheduleConfig {
  defaultDays: CountDay[];
  updatedBy: string;
  updatedAt: string;
  notes?: string;
  whatsappNotification?: boolean;
  whatsappPhone?: string;
  whatsappReminderTime?: string;
  whatsappCustomMessage?: string;
}

// User Permission Guards
export function canChangeCountSchedule(role: UserRole): boolean {
  return role === 'administrador' || role === 'gerente';
}

export function canMakePurchaseOrders(role: UserRole): boolean {
  return role === 'compras' || role === 'gerente' || role === 'administrador';
}

export function canViewSuppliers(role: UserRole): boolean {
  return role === 'compras' || role === 'gerente' || role === 'administrador';
}

export function canRegisterEntities(role: UserRole): boolean {
  // Cadastrar itens ou fornecedores
  return role === 'compras' || role === 'gerente' || role === 'administrador';
}

export function canAuthorizeUnscheduledCount(role: UserRole): boolean {
  return role === 'administrador' || role === 'gerente';
}

export function canImportInvoices(role: UserRole): boolean {
  // Compras, Gerente e Administrador têm permissão plena para dar entrada de notas fiscais no estoque
  return role === 'compras' || role === 'gerente' || role === 'administrador';
}

export function canAccessBilling(role: UserRole): boolean {
  // Somente o adm e gerente tem acesso à assinatura
  return role === 'administrador' || role === 'gerente';
}

export function canAccessSystemSettings(role: UserRole): boolean {
  // Apenas o Administrador pode acessar parametrizações sistêmicas
  return role === 'administrador';
}

export function canAccessApiAndDatabase(role: UserRole): boolean {
  // Somente o adm tem acesso à api e banco
  return role === 'administrador';
}

export function canManageCompanies(role: UserRole): boolean {
  // Controle total de cadastrar empresas e transitar entre elas
  return role === 'administrador';
}

export function canManageEmployees(role: UserRole): boolean {
  // Gerente e Administrador podem gerenciar funcionários
  return role === 'administrador' || role === 'gerente';
}

export function canBlockOrDeleteGerente(actingRole: UserRole, targetEmployeeRole: EmployeeRole): boolean {
  // "SOMENTE ADMINISTRADOR E GERENTE CONSEGUEM EXCLUIR OU BLOQUEAR CADASTRO DO TIPO GERENTE"
  if (targetEmployeeRole === 'gerente') {
    return actingRole === 'administrador' || actingRole === 'gerente';
  }
  return actingRole === 'administrador' || actingRole === 'gerente';
}

export function canApproveUnlistedCount(role: UserRole): boolean {
  // Compras, Gerente ou Administrador para aprovar itens avulsos anotados pelo conferente
  return role === 'compras' || role === 'gerente' || role === 'administrador';
}

export type AppTab = 'estoque' | 'contagem' | 'compras' | 'orcamento' | 'notas' | 'perdas' | 'dashboard' | 'catalogo';

export function isTabAllowedForRole(tab: string, role: UserRole): boolean {
  if (role === 'administrador') return true;
  if (role === 'conferente') {
    // Conferente não pode ver os outros acessos superiores (exclusivo para contagem de estoque)
    return tab === 'contagem';
  }
  if (role === 'compras') {
    return tab === 'estoque' || tab === 'compras' || tab === 'orcamento' || tab === 'notas';
  }
  if (role === 'gerente') {
    return tab === 'estoque' || tab === 'contagem' || tab === 'compras' || tab === 'orcamento' || tab === 'notas' || tab === 'perdas' || tab === 'dashboard';
  }
  return false;
}

export type ItemCategory = 'porcionamento' | 'petisco' | 'consumo' | 'bebida' | 'limpeza' | 'outro';

export type StockUnit = 'kg' | 'g' | 'un' | 'pct' | 'cx' | 'l' | 'ml' | 'fd';

// Multi-Empresa
export interface Company {
  id: string; // Tenant identificador da empresa (CNPJ sem traços: ex: 00000000000001)
  name: string;
  tradeName: string;
  cnpj: string;
  paisOrigem?: string; // Código do país ISO 3166-1 alpha-2 (BR, US, PT, etc.)
  tipoDocumento?: string; // Nome do identificador (CNPJ, EIN, NIPC, etc.)
  documentoIdentificador?: string; // Número/código VARCHAR(35)
  city: string;
  state: string;
  phone: string;
  email: string;
  segment: string;
  active: boolean;
  createdAt: string;
  address?: string;
  managerName?: string;
  databaseConfig?: DatabaseConnectionConfig;
}

// Funcionários da Empresa (GERENTE, COMPRAS, CONFERENTE)
export type EmployeeRole = 'gerente' | 'compras' | 'conferente';
export type EmployeeStatus = 'ativo' | 'bloqueado';

export interface Employee {
  id: string;
  companyId: string; // Tenant identificador da empresa (CNPJ sem traços)
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  createdAt: string;
  notes?: string;
  lastLogin?: string;
  password?: string;
  matricula?: string;
}

export interface SupplierProductLink {
  productId: string;
  customPrice?: number;
  packSize?: string;
  isPrimary?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  paisOrigem?: string; // Código do país ISO 3166-1 alpha-2 (BR, US, PT, etc.)
  tipoDocumento?: string; // Nome do identificador (CNPJ, EIN, NIPC, etc.)
  documentoIdentificador?: string; // Número/código VARCHAR(35)
  contactName: string;
  phone: string; // WhatsApp number formatted e.g. 5511999998888
  email: string;
  deliveryDays: number;
  category: string;
  minOrderValue?: number;
  notes?: string;
  createdAt?: string; // Data de cadastro para saber o fornecedor mais recente
  priceUpdateIntervalDays?: number; // Padrão 30 dias, limite máximo 45 dias
  lastPriceUpdateDate?: string; // ISO date da última atualização de preços
  suppliedProductIds?: string[]; // IDs dos produtos vinculados a este fornecedor
  productLinks?: SupplierProductLink[]; // Detalhes dos produtos fornecidos (preço cotado, etc.)
}

export interface SupplierQuote {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  packSize?: string;
  lastQuotedAt: string;
}

export interface StockItem {
  id: string;
  name: string;
  code: string;
  category: ItemCategory;
  unit: StockUnit;
  currentStock: number;
  minStock: number; // Limite mínimo para disparar alerta
  reorderPoint: number; // Ponto de atenção
  optimalStock: number; // Estoque alvo após reposição
  costPrice: number; // Custo unitário em R$
  primarySupplierId?: string;
  alternativeSuppliers?: SupplierQuote[];
  countDays: ('segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo')[];
  lastCountDate?: string;
  lastCountBy?: string;
  currentBatchExpiry?: string;
  location?: string; // ex: "Câmara Fria 01", "Estoque Seco", "Freezer Cozinha"
}

export interface StockCountEntry {
  itemId: string;
  countedStock: number;
  previousStock: number;
  expiryDate: string;
  observations?: string;
  status: 'ok' | 'baixo' | 'critico' | 'sobra';
}

export interface StockCountSession {
  id: string;
  date: string;
  conductedBy: string;
  userRole: UserRole;
  dayOfWeek: string;
  entries: StockCountEntry[];
  totalItemsCounted: number;
  divergentItemsCount: number;
  status: 'rascunho' | 'enviada' | 'aprovada';
  submittedAt?: string;
  supervisorAuthorization?: SupervisorAuthorization;
}

export type LossReason =
  | 'queimou'
  | 'venceu'
  | 'derrubado_danificado'
  | 'erro_preparo'
  | 'descongelamento_inadequado'
  | 'contaminacao'
  | 'sobra_descarte'
  | 'outro';

export interface LossRecord {
  id: string;
  itemId: string;
  itemName: string;
  category: ItemCategory;
  quantity: number;
  unit: StockUnit;
  unitCost: number;
  totalCost: number;
  reason: LossReason;
  sector: 'cozinha_quente' | 'fritadeira' | 'pre_preparo' | 'bar' | 'salao' | 'camara_fria' | 'estoque_seco';
  reportedBy: string;
  timestamp: string;
  notes?: string;
}

export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  unit: StockUnit;
  currentStock: number;
  minStock: number;
  quantityToOrder: number;
  estimatedUnitPrice: number;
  totalCost: number;
  receivedQuantity?: number; // Quantidade já recebida através de notas fiscais vinculadas
}

export interface PurchaseOrder {
  id: string;
  orderNumber?: string; // Código amigável ex: PED-2026-001
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  createdAt: string;
  createdBy: string;
  items: PurchaseOrderItem[];
  totalValue: number;
  status: 'pendente' | 'enviado_whatsapp' | 'enviado_email' | 'recebido' | 'cancelado' | 'parcial' | 'entregue';
  channelSent?: 'whatsapp' | 'email' | 'ambos' | 'direto';
  notes?: string;
  linkedInvoiceIds?: string[]; // IDs das notas fiscais que atenderam este pedido
  linkedInvoiceNumbers?: string[]; // Números das notas fiscais vinculadas
  fulfilledAt?: string; // Data de fechamento
  fulfillmentType?: 'total' | 'parcial'; // Se foi fechado total ou parcialmente
}

export interface MonthlyPerformance {
  month: string; // "Março 2026"
  shortMonth: string; // "Mar"
  totalPurchases: number;
  totalLosses: number;
  revenueEst: number;
  cmvPercentage: number;
  cmvTarget: number;
  countAccuracy: number; // ex: 96%
}

export type MatchConfidence = 'exato' | 'alto' | 'manual' | 'novo';

export interface InvoiceItem {
  id: string;
  itemCode: string; // cProd da NF
  name: string; // xProd da NF
  ncm?: string;
  cfop?: string;
  unit: string; // uCom da NF (ex: CX, UN, KG, LT, PCT, FD)
  quantity: number; // qCom
  unitPrice: number; // vUnCom
  totalPrice: number; // vProd
  batchNumber?: string; // nLote
  expiryDate?: string; // dVal
  // Correspondência com o estoque do restaurante
  matchedStockItemId?: string; // ID do item vinculado no estoque
  matchedStockItemName?: string;
  matchConfidence: MatchConfidence;
  conversionFactor: number; // Multiplicador para converter a unidade da nota para a do estoque (ex: 1 CX = 12 UN, fator = 12)
  targetStockUnit?: StockUnit;
  applied: boolean; // se deve ser importado
  isNewItem?: boolean;
  newItemCategory?: ItemCategory;
}

export interface InvoiceData {
  id: string;
  accessKey: string; // Chave de acesso de 44 posições da NF-e / NFC-e (letras apenas no campo do CNPJ)
  number: string; // Número da NF
  series: string; // Série
  issueDate: string; // Data de emissão
  natureOfOperation?: string; // Natureza da operação (ex: Venda de Mercadorias)
  // Dados do Fornecedor / Emitente
  supplierCnpj: string;
  supplierName: string;
  supplierTradeName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierState?: string;
  matchedSupplierId?: string; // Fornecedor já cadastrado no sistema
  // Valores
  totalProductsValue: number;
  totalFreightValue?: number;
  totalInvoiceValue: number;
  // Itens da nota
  items: InvoiceItem[];
  // Metadados
  sourceType: 'chave' | 'qrcode' | 'xml' | 'digitada';
  status: 'pre_importado' | 'efetivado' | 'cancelado';
  importedAt?: string;
  importedBy?: string;
  linkedPurchaseOrderId?: string; // ID do pedido de compra vinculado
  linkedPurchaseOrderNumber?: string; // Número amigável do pedido ex: PED-2026-001
  orderFulfillmentType?: 'total' | 'parcial'; // Fechamento total ou parcial
}

// Produto Não Cadastrado Anotado pelo Conferente na Contagem Física
export interface UnlistedCountItem {
  id: string;
  companyId: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: StockUnit;
  expiryDate?: string;
  location?: string;
  observations?: string;
  recordedBy: string;
  recordedAt: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdStockItemId?: string;
}

// Item na Tela de Orçamento & Cotações
export interface BudgetItem {
  id: string;
  stockItemId?: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: StockUnit;
  targetUnitPrice: number;
  targetPrice?: number;
  currentStock?: number;
  minStock?: number;
  reorderPoint?: number;
  isCustomItem?: boolean;
  specification?: string;
  notes?: string;
}

export interface SupplierBudgetQuoteDetail {
  budgetItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  subtotal: number;
  unitPrice?: number;
  totalPrice?: number;
  isQuoteValid?: boolean;
  daysUntilPriceExpiry?: number;
}

export interface SupplierBudgetComparison {
  supplier: Supplier;
  varietyCount: number;
  coveragePercentage: number;
  totalCost: number;
  coveredProducts: SupplierBudgetQuoteDetail[];
  missingProducts: string[];
  matchedItemsCount?: number;
  totalItemsCount?: number;
  matchedItems?: SupplierBudgetQuoteDetail[];
  unmatchedItems?: BudgetItem[];
  totalEstimatedPrice?: number;
  isOutdatedPrice?: boolean;
  meetsMinOrder?: boolean;
}

// Parametrização Sistêmica (Exclusivo Administrador)
export type OutdatedPricePolicy = 'bloquear' | 'alertar' | 'exigir_aprovacao';

export interface SystemSettings {
  // 1. Políticas de Preço e Compras
  outdatedPricePolicy: OutdatedPricePolicy;
  defaultPriceValidityDays: number; // ex: 30 dias (máx 90 dias)
  notifyOutdatedPrices: boolean;
  blockOrdersBelowMinSupplierValue: boolean;

  // 2. Parametrização de Dias e Horários de Contagem
  countSchedule: CountScheduleConfig;
  countCutoffTime: string; // ex: "23:59"
  requireSupervisorAuthForOffDays: boolean;
  divergenceTolerancePercent: number; // ex: 3.0%
  blindCountMode: boolean; // Oculta estoque teórico durante contagem física

  // 3. Permissões de Acesso & Segurança
  requireIndividualLogin: boolean;
  conferenteCanViewPrices: boolean;
  allowConferenteRegisterUnlisted: boolean;
  buyerCanRegisterSupplierWithoutCnpj: boolean;

  // 4. Parâmetros Financeiros & Indicadores
  targetCmvPercent: number; // ex: 28.5%
  criticalAlertThreshold: number; // ex: 1.0

  // 5. Configuração e Vínculo de Banco de Dados Relacional (MySQL, Postgres, SQL Server)
  databaseConfig?: DatabaseConnectionConfig;

  // Metadados
  updatedAt: string;
  updatedBy: string;
}

export type DatabaseEngine = 'mysql' | 'postgres' | 'sqlserver';

export interface DatabaseConnectionConfig {
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl: boolean;
  status: 'desconectado' | 'conectado' | 'erro';
  isSimulationMode?: boolean;
  errorMessage?: string;
  lastConnectedAt?: string;
  tablesCreated: boolean;
  tablesCount?: number;
  lastMigrationAt?: string;
  serverVersion?: string;
  tenantId?: string;
}

// Usuário com Acesso Individual Autenticado
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName?: string;
  avatarUrl?: string;
  phone?: string;
  pin?: string;
  password_hash?: string;
  lastLogin: string;
  status?: 'ativo' | 'bloqueado';
  matricula?: string;
}

