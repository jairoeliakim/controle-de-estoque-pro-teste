import React, { useState, useEffect } from 'react';
import {
  Database,
  Terminal,
  ShieldCheck,
  Wifi,
  WifiOff,
  ArrowRightLeft,
  ScanBarcode,
  UploadCloud,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  RefreshCw,
  Package,
  Layers,
  Zap,
  X,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import {
  useOnlineProducts,
  useStockMovementMutation,
  useBarcodeSearch,
  requestPresignedUploadUrl,
} from '../../client/cache/inventoryQueryClient.js';
import {
  isDeviceOnline,
  setSimulatedOffline,
  OfflineConnectionError,
} from '../../client/api/apiClient.js';
import { secureSession } from '../../client/storage/secureSessionStorage.js';
import { Product, StockMovementType } from '../../types/inventory.js';
import { UserRole, canAccessApiAndDatabase } from '../../types.js';
import { formatCurrency } from '../../utils/formatters.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

export const OnlineInventoryApiWorkbench: React.FC<Props> = ({ isOpen, onClose, currentRole }) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'barcode' | 'presigned' | 'schema' | 'architecture'>('transactions');
  
  // Conexão e Sessão
  const [isOnlineState, setIsOnlineState] = useState(true);
  const [jwtToken, setJwtToken] = useState<string>('');
  const [tenantName] = useState('Restaurante Sabor & Arte (Matriz)');

  // Form de Movimentação
  const { products, isLoading: isLoadingProducts, refetch: refetchProducts } = useOnlineProducts();
  const { executeMovement, isMutating } = useStockMovementMutation();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [movementType, setMovementType] = useState<StockMovementType>('SAIDA');
  const [movementQuantity, setMovementQuantity] = useState<number>(5);
  const [movementReason, setMovementReason] = useState<string>('Venda balcão / consumo salão');
  
  // Feedback da Transação
  const [transactionResult, setTransactionResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
    rollback?: boolean;
  } | null>(null);

  // Busca por Código de Barras
  const { searchBarcode, isSearching: isBarcodeSearching } = useBarcodeSearch();
  const [barcodeInput, setBarcodeInput] = useState('7891234560012');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Presigned URL Form
  const [uploadFilename, setUploadFilename] = useState('picanha_lote_angus.jpg');
  const [uploadMime, setUploadMime] = useState('image/jpeg');
  const [presignedResult, setPresignedResult] = useState<any | null>(null);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

  // Copiar SQL
  const [copiedSql, setCopiedSql] = useState(false);

  // Inicializa sessão
  useEffect(() => {
    if (isOpen) {
      const sessionRole = currentRole === 'administrador' ? 'admin' : 'operador';
      secureSession.initDefaultSession(sessionRole).then((token) => {
        setJwtToken(token);
      });
      setIsOnlineState(isDeviceOnline());
    }
  }, [isOpen, currentRole]);

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  if (!isOpen) return null;

  // Somente o adm tem acesso a API e Banco de Dados
  if (!canAccessApiAndDatabase(currentRole)) {
    return (
      <div
        id="saas-inventory-api-denied-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div className="bg-slate-900 border border-rose-500/40 w-full max-w-md rounded-2xl shadow-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-bold uppercase tracking-wide">
              <Lock className="w-3 h-3" />
              <span>Acesso Restrito ao Administrador</span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Permissão Insuficiente para API e Banco
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Somente usuários com nível de <strong>Administrador</strong> têm acesso à Bancada de APIs REST, transações com trava atômica de concorrência, geração de Presigned URLs e Schema SQL do banco de dados.
            </p>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Seu perfil ativo:</span>
            <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">{currentRole}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const currentSelectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const handleToggleOnline = (offline: boolean) => {
    setSimulatedOffline(offline);
    setIsOnlineState(!offline);
  };

  const handleRunTransaction = async (overrideQty?: number) => {
    setTransactionResult(null);
    const qty = overrideQty !== undefined ? overrideQty : movementQuantity;

    try {
      const res = await executeMovement({
        product_id: selectedProductId,
        type: movementType,
        quantity: qty,
        reason: movementReason,
      });

      setTransactionResult({
        success: true,
        message: `Transação COMMIT com sucesso! Novo saldo: ${res.product.current_stock.toFixed(3)} (Anterior: ${res.movement.previous_stock.toFixed(3)})`,
        details: res,
      });
      refetchProducts();
    } catch (err: any) {
      setTransactionResult({
        success: false,
        message: err.message,
        rollback: err.isRollback || err.status === 422,
        details: err.data || null,
      });
    }
  };

  const handleBarcodeSearch = async () => {
    setBarcodeError(null);
    setFoundProduct(null);
    try {
      const prod = await searchBarcode(barcodeInput);
      if (prod) {
        setFoundProduct(prod);
      } else {
        setBarcodeError('Nenhum produto cadastrado com este código no tenant.');
      }
    } catch (err: any) {
      setBarcodeError(err.message || 'Erro na busca.');
    }
  };

  const handleGeneratePresigned = async () => {
    setIsGeneratingUrl(true);
    setPresignedResult(null);
    try {
      const res = await requestPresignedUploadUrl(uploadFilename, uploadMime, selectedProductId);
      setPresignedResult(res);
    } catch (err: any) {
      setPresignedResult({ error: err.message });
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  const sqlSchemaText = `-- Multi-Tenant Relational Schema (PostgreSQL/MySQL)
CREATE TABLE tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operador')),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE categories (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE products (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id VARCHAR(64) NOT NULL REFERENCES categories(id),
    sku VARCHAR(64) NOT NULL,
    barcode VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    photo_url TEXT,
    CONSTRAINT uq_products_tenant_sku UNIQUE (tenant_id, sku)
);

-- ÍNDICES OBRIGATÓRIOS
CREATE INDEX idx_products_tenant_barcode ON products(tenant_id, barcode);
CREATE INDEX idx_products_tenant_sku ON products(tenant_id, sku);

CREATE TABLE stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    previous_stock NUMERIC(12, 3) NOT NULL,
    new_stock NUMERIC(12, 3) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_movements_tenant_product ON stock_movements(tenant_id, product_id);
CREATE INDEX idx_movements_tenant_created ON stock_movements(tenant_id, created_at DESC);`;

  return (
    <div
      id="saas-inventory-api-workbench"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-950 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                  Arquitetura de API & Banco de Dados (SaaS 100% Online)
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Multi-Tenant
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Exclusivo Administrador
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Tenant: <strong className="text-slate-200">{tenantName}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {isOnlineState ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5" /> 100% Online
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <WifiOff className="w-3.5 h-3.5" /> Offline (Bloqueio Ativo)
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle de Simulação Offline */}
            <button
              type="button"
              onClick={() => handleToggleOnline(isOnlineState)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                !isOnlineState
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Alternar para testar o interceptor de requisições offline"
            >
              {!isOnlineState ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{!isOnlineState ? 'Modo Offline Ativo' : 'Simular Offline'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-950/60 px-5 border-b border-slate-800 flex gap-2 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>1. Transação Atômica & Concorrência</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('barcode')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'barcode'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScanBarcode className="w-4 h-4" />
            <span>2. Busca Barcode & SKU</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presigned')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'presigned'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>3. Upload Presigned S3/R2</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>4. Schema SQL Relacional</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>5. Sessão & Cache 100% Online</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: TRANSAÇÃO ATÔMICA */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span>POST /api/stock/movements</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                        BEGIN ... FOR UPDATE ... COMMIT
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Executa validação com trava de concorrência. Se for saída e o estoque for insuficiente, o banco efetua ROLLBACK imediato.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchProducts()}
                    className="self-end sm:self-auto px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 border border-slate-800 rounded-lg hover:bg-slate-800"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Atualizar Produtos</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                  {/* Produto */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Produto Selecionado
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Saldo: {p.current_stock.toFixed(3)})
                        </option>
                      ))}
                    </select>
                    {currentSelectedProduct && (
                      <div className="mt-2 text-[11px] text-slate-400 space-y-0.5 bg-slate-900/60 p-2 rounded border border-slate-800">
                        <div>SKU: <span className="text-slate-200 font-mono">{currentSelectedProduct.sku}</span></div>
                        <div>Barcode: <span className="text-slate-200 font-mono">{currentSelectedProduct.barcode || 'N/A'}</span></div>
                        <div>Saldo Atual: <strong className="text-emerald-400">{currentSelectedProduct.current_stock.toFixed(3)}</strong> (Mín: {currentSelectedProduct.min_stock})</div>
                      </div>
                    )}
                  </div>

                  {/* Tipo & Quantidade */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        Tipo de Operação
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['SAIDA', 'ENTRADA', 'AJUSTE'] as StockMovementType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setMovementType(t)}
                            className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                              movementType === t
                                ? t === 'SAIDA'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                  : t === 'ENTRADA'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                  : 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.001"
                        value={movementQuantity}
                        onChange={(e) => setMovementQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Motivo & Botões */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        Motivo / Observação
                      </label>
                      <input
                        type="text"
                        value={movementReason}
                        onChange={(e) => setMovementReason(e.target.value)}
                        placeholder="Ex: Baixa para preparo salão"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => handleRunTransaction()}
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                      >
                        {isMutating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        <span>Executar Transação Atômica</span>
                      </button>

                      {/* Botão para Forçar Teste de Concorrência / Rollback de Saldo Negativo */}
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => {
                          setMovementType('SAIDA');
                          const excessQty = (currentSelectedProduct?.current_stock || 10) + 50;
                          handleRunTransaction(excessQty);
                        }}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center justify-center gap-1 transition-all"
                        title="Tenta retirar mais do que o estoque possui para testar a rejeição com rollback automático"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span>Testar Rejeição de Saldo Insuficiente (Rollback)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultado da Transação */}
              {transactionResult && (
                <div
                  className={`p-4 rounded-xl border flex flex-col gap-2 animate-in fade-in duration-150 ${
                    transactionResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {transactionResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold text-xs sm:text-sm">
                      {transactionResult.success ? 'TRANSAÇÃO ATÔMICA EFETUADA (COMMIT)' : 'FALHA NA TRANSAÇÃO (ROLLBACK)'}
                    </span>
                    {transactionResult.rollback && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 font-mono font-bold uppercase">
                        Saldo Protegido
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed">{transactionResult.message}</p>
                  {transactionResult.details && (
                    <pre className="bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                      {JSON.stringify(transactionResult.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BUSCA CÓDIGO DE BARRAS & SKU */}
          {activeTab === 'barcode' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h4 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <span>GET /api/products/search?barcode=:code</span>
                  <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded">
                    Índice: (tenant_id, barcode)
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  Permite leitura instantânea via leitor óptico, scanner de câmera mobile ou digitação manual. Garante que nunca vaze produto de outro restaurante.
                </p>

                <div className="flex gap-2 max-w-xl">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Código de barras EAN-13 ou SKU..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    disabled={isBarcodeSearching}
                    onClick={handleBarcodeSearch}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <ScanBarcode className="w-4 h-4" />
                    <span>Buscar</span>
                  </button>
                </div>

                {/* Atalhos Rápidos */}
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                  <span>Exemplos cadastrados:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput('7891234560012');
                      searchBarcode('7891234560012').then(setFoundProduct);
                    }}
                    className="text-amber-400 hover:underline font-mono text-[11px]"
                  >
                    7891234560012 (Picanha)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput('7891234560036');
                      searchBarcode('7891234560036').then(setFoundProduct);
                    }}
                    className="text-amber-400 hover:underline font-mono text-[11px]"
                  >
                    7891234560036 (Queijo Brie)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput('7791234560050');
                      searchBarcode('7791234560050').then(setFoundProduct);
                    }}
                    className="text-amber-400 hover:underline font-mono text-[11px]"
                  >
                    7791234560050 (Vinho Catena)
                  </button>
                </div>
              </div>

              {foundProduct && (
                <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  {foundProduct.photo_url && (
                    <img
                      src={foundProduct.photo_url}
                      alt={foundProduct.name}
                      className="w-20 h-20 rounded-lg object-cover border border-slate-800"
                    />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400">Produto Localizado no Tenant</span>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        SKU: {foundProduct.sku}
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-slate-100">{foundProduct.name}</h5>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>Código de Barras: <strong className="text-slate-200 font-mono">{foundProduct.barcode}</strong></span>
                      <span>Saldo Atual: <strong className="text-emerald-400">{foundProduct.current_stock.toFixed(3)}</strong></span>
                      <span>Preço Médio: <strong className="text-slate-200">{formatCurrency(foundProduct.unit_price)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {barcodeError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {barcodeError}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UPLOAD PRESIGNED URL */}
          {activeTab === 'presigned' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h4 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <span>POST /api/uploads/presigned-url</span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                    S3 / Cloudflare R2 / GCS
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  O cliente Web ou Mobile solicita a URL pré-assinada e faz o upload binário direto para o storage (S3/R2) via PUT, sem sobrecarregar a API com tráfego de imagens. O banco armazena apenas a chave isolada por tenant.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Nome do Arquivo</label>
                    <input
                      type="text"
                      value={uploadFilename}
                      onChange={(e) => setUploadFilename(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Tipo MIME</label>
                    <select
                      value={uploadMime}
                      onChange={(e) => setUploadMime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono"
                    >
                      <option value="image/jpeg">image/jpeg (.jpg)</option>
                      <option value="image/png">image/png (.png)</option>
                      <option value="image/webp">image/webp (.webp)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={isGeneratingUrl}
                    onClick={handleGeneratePresigned}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isGeneratingUrl ? 'Gerando assinatura...' : 'Gerar URL Pré-Assinada'}</span>
                  </button>
                </div>
              </div>

              {presignedResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Chave & URL Pré-Assinada Geradas com Sucesso</span>
                  </h5>
                  <pre className="bg-slate-900 p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                    {JSON.stringify(presignedResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SCHEMA SQL RELACIONAL */}
          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    Schema Relacional com Isolamento Multi-Tenant Estrito
                  </h4>
                  <p className="text-xs text-slate-400">
                    Compatível com PostgreSQL 14+ e MySQL 8+. Índices em (tenant_id, barcode) e (tenant_id, sku).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sqlSchemaText);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-all border border-slate-700"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden">
                <pre className="text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-[380px] leading-relaxed">
                  {sqlSchemaText}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: ARQUITETURA DE CLIENTE & CACHE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Armazenamento Seguro de Sessão */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>1. Armazenamento Seguro de Sessão</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-400">
                    <li>• <strong className="text-slate-200">Mobile (React Native / Expo):</strong> Gravação de tokens exclusivamente no hardware Keystore / Keychain via <code className="text-amber-300 font-mono">expo-secure-store</code>.</li>
                    <li>• <strong className="text-slate-200">Web:</strong> Tokens efêmeros em memória / HttpOnly Cookies SameSite.</li>
                    <li>• <strong className="text-rose-400 font-semibold">Regra Estrita de Ouro:</strong> Nenhuma quantidade de estoque, tabela de preços ou regra de negócio é salva em SQLite, WatermelonDB ou LocalStorage offline no celular.</li>
                  </ul>
                </div>

                {/* Cache Efêmero em Memória */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 text-sky-400">
                    <Layers className="w-4 h-4" />
                    <span>2. Cache Efêmero (TanStack Query)</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-400">
                    <li>• <strong className="text-slate-200">staleTime curto (15s):</strong> Garante que os operadores visualizem o saldo em tempo real sem sobrecarregar o banco com requisições repetidas.</li>
                    <li>• <strong className="text-slate-200">Invalidação Automática:</strong> Qualquer mutação de <code className="text-amber-300 font-mono">/api/stock/movements</code> invalida o cache de produtos na hora.</li>
                    <li>• <strong className="text-slate-200">refetchOnReconnect:</strong> Ao restabelecer a internet, o app sincroniza imediatamente com a verdade do servidor.</li>
                  </ul>
                </div>
              </div>

              {/* Interceptor de Conexão */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 text-emerald-400">
                  <Wifi className="w-4 h-4" />
                  <span>3. Tratamento de Conexão & Pre-flight Interceptor</span>
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  O cliente HTTP possui um interceptor antes do envio que checa o estado de conectividade. Caso o operador esteja sem internet no subsolo da adega ou câmara fria, o app bloqueia imediatamente a submissão, impedindo inconsistências e informando o operador na hora:
                </p>
                <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-rose-300 text-xs font-mono">
                  OfflineConnectionError: Operação bloqueada. Dispositivo desconectado da internet. O sistema opera 100% online para garantir saldo real.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>API REST Multi-Tenant Pronta & Conectada</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
