import {
  Tenant,
  User,
  Category,
  Product,
  StockMovement,
  CreateMovementDTO,
} from '../../types/inventory.js';

/**
 * ==============================================================================
 * GUIA DE TRANSAÇÃO SQL REAL (PostgreSQL / MySQL com `pg` ou `mysql2`)
 * ==============================================================================
 * 
 * Em ambiente de produção conectando a um cluster PostgreSQL real:
 * 
 * ```typescript
 * import { Pool } from 'pg';
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * 
 * export async function executeStockMovementPostgres(
 *   tenantId: string,
 *   userId: string,
 *   dto: CreateMovementDTO
 * ) {
 *   const client = await pool.connect();
 *   try {
 *     // 1. INÍCIO DA TRANSAÇÃO ATÔMICA
 *     await client.query('BEGIN');
 * 
 *     // 2. ROW-LEVEL LOCK (SELECT ... FOR UPDATE)
 *     // Impede que duas requisições simultâneas leiam o mesmo saldo antes da atualização
 *     const productResult = await client.query(
 *       `SELECT id, name, current_stock, min_stock 
 *        FROM products 
 *        WHERE id = $1 AND tenant_id = $2 
 *        FOR UPDATE`,
 *       [dto.product_id, tenantId]
 *     );
 * 
 *     if (productResult.rowCount === 0) {
 *       throw new Error('PRODUCT_NOT_FOUND');
 *     }
 * 
 *     const product = productResult.rows[0];
 *     const previousStock = parseFloat(product.current_stock);
 *     let newStock = previousStock;
 * 
 *     if (dto.type === 'SAIDA') {
 *       // 3. VALIDAÇÃO CRÍTICA DE SALDO NÃO NEGATIVO
 *       if (previousStock < dto.quantity) {
 *         throw new Error(
 *           `INSUFFICIENT_STOCK: Saldo insuficiente. Estoque atual: ${previousStock}, Solicitado: ${dto.quantity}`
 *         );
 *       }
 *       newStock = previousStock - dto.quantity;
 *     } else if (dto.type === 'ENTRADA') {
 *       newStock = previousStock + dto.quantity;
 *     } else if (dto.type === 'AJUSTE') {
 *       newStock = dto.quantity;
 *     }
 * 
 *     // 4. ATUALIZAÇÃO DO SALDO DO PRODUTO NA MESMA TRANSAÇÃO
 *     await client.query(
 *       `UPDATE products 
 *        SET current_stock = $1, updated_at = CURRENT_TIMESTAMP 
 *        WHERE id = $2 AND tenant_id = $3`,
 *       [newStock, dto.product_id, tenantId]
 *     );
 * 
 *     // 5. REGISTRO IMUTÁVEL DA MOVIMENTAÇÃO (AUDITORIA / LEDGER)
 *     const movementId = 'mov_' + Date.now();
 *     const movementResult = await client.query(
 *       `INSERT INTO stock_movements 
 *        (id, tenant_id, product_id, user_id, type, quantity, previous_stock, new_stock, reason, created_at)
 *        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
 *        RETURNING *`,
 *       [movementId, tenantId, dto.product_id, userId, dto.type, dto.quantity, previousStock, newStock, dto.reason || null]
 *     );
 * 
 *     // 6. COMMIT ATÔMICO
 *     await client.query('COMMIT');
 *     return { movement: movementResult.rows[0], newStock };
 *   } catch (error) {
 *     // 7. ROLLBACK IMEDIATO EM QUALQUER FALHA
 *     await client.query('ROLLBACK');
 *     throw error;
 *   } finally {
 *     client.release();
 *   }
 * }
 * ```
 */

// ==============================================================================
// BANCO DE DADOS EM MEMÓRIA (MOCK CONCORRENTE COM ACID & ROW-LOCKING SIMULADO)
// Permite execução e testes instantâneos na API sem dependência externa
// ==============================================================================

class InventoryDatabaseStore {
  private tenants: Map<string, Tenant> = new Map();
  private users: Map<string, User> = new Map();
  private categories: Map<string, Category> = new Map();
  private products: Map<string, Product> = new Map();
  private stockMovements: StockMovement[] = [];

  // Mutex para simular Row-Level Locking (SELECT ... FOR UPDATE) por produto
  private productLocks: Map<string, Promise<void>> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Tenant Padrão (Empresa Matriz com CNPJ sem traços)
    const defaultTenant: Tenant = {
      id: '12345678000190',
      name: 'Restaurante & Bar Gourmet (Matriz)',
      document: '12.345.678/0001-90',
      created_at: new Date('2026-01-01').toISOString(),
    };
    this.tenants.set(defaultTenant.id, defaultTenant);
    this.tenants.set('comp-matriz', { ...defaultTenant, id: 'comp-matriz' });

    // Usuário Administrador Padrão (@dm!n2026)
    const adminUser: User = {
      id: 'usr-admin-01',
      tenant_id: defaultTenant.id,
      name: 'Administrador do Sistema',
      email: 'admin@sistema.com',
      role: 'admin',
      created_at: new Date('2026-01-01').toISOString(),
    };
    this.users.set(adminUser.id, adminUser);

    // Categorias Oficiais do Restaurante
    const catCarnes: Category = {
      id: 'cat-carnes',
      tenant_id: defaultTenant.id,
      name: 'Carnes & Porcionamentos',
    };
    const catLaticinios: Category = {
      id: 'cat-laticinios',
      tenant_id: defaultTenant.id,
      name: 'Laticínios & Derivados',
    };
    const catHortifruti: Category = {
      id: 'cat-hortifruti',
      tenant_id: defaultTenant.id,
      name: 'Hortifruti & Insumos',
    };
    const catBebidas: Category = {
      id: 'cat-bebidas',
      tenant_id: defaultTenant.id,
      name: 'Bebidas, Bar & Adega',
    };
    const catPetiscos: Category = {
      id: 'cat-petiscos',
      tenant_id: defaultTenant.id,
      name: 'Petiscos & Congelados',
    };

    [catCarnes, catLaticinios, catHortifruti, catBebidas, catPetiscos].forEach((c) =>
      this.categories.set(c.id, c)
    );

    // Produtos e movimentações iniciam limpos.
    // Todas as inserções do sistema irão alimentar o banco.
    this.products.clear();
    this.stockMovements = [];
  }

  // ============================================================================
  // TRANSAÇÃO ATÔMICA COM ROW-LOCKING (Concorrência Segura)
  // ============================================================================
  async executeAtomicStockMovement(
    tenantId: string,
    userId: string,
    dto: CreateMovementDTO
  ): Promise<{ movement: StockMovement; product: Product }> {
    if (!dto.product_id) {
      throw new Error('VALIDATION_ERROR: O campo product_id é obrigatório.');
    }
    if (!dto.quantity || dto.quantity <= 0) {
      throw new Error('VALIDATION_ERROR: A quantidade deve ser estritamente maior que zero.');
    }
    if (!['ENTRADA', 'SAIDA', 'AJUSTE'].includes(dto.type)) {
      throw new Error('VALIDATION_ERROR: Tipo inválido. Deve ser ENTRADA, SAIDA ou AJUSTE.');
    }

    // Adquire trava na linha do produto (Row-Level Lock)
    const lockKey = `${tenantId}:${dto.product_id}`;
    let releaseLock: () => void = () => {};

    const currentLock = this.productLocks.get(lockKey) || Promise.resolve();
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.productLocks.set(lockKey, currentLock.then(() => nextLock));

    await currentLock;

    try {
      // 1. Busca produto com isolamento estrito de tenant
      const product = this.products.get(dto.product_id);
      if (!product || product.tenant_id !== tenantId) {
        throw new Error('NOT_FOUND: Produto não encontrado para o tenant autenticado.');
      }

      const previousStock = Number(product.current_stock);
      let newStock = previousStock;

      // 2. Validação Atômica de Saída
      if (dto.type === 'SAIDA') {
        if (previousStock < dto.quantity) {
          // ROLLBACK: Lança erro antes de alterar qualquer estado
          throw new Error(
            `INSUFFICIENT_STOCK: Saldo insuficiente em estoque. Saldo atual: ${previousStock.toFixed(
              3
            )}, Solicitado: ${dto.quantity.toFixed(3)}.`
          );
        }
        newStock = previousStock - dto.quantity;
      } else if (dto.type === 'ENTRADA') {
        newStock = previousStock + dto.quantity;
      } else if (dto.type === 'AJUSTE') {
        newStock = dto.quantity;
      }

      // 3. Atualização Atômica na tabela Products
      const updatedProduct: Product = {
        ...product,
        current_stock: Math.round(newStock * 1000) / 1000,
        updated_at: new Date().toISOString(),
      };
      this.products.set(product.id, updatedProduct);

      // 4. Registro no Ledger de Auditoria (stock_movements)
      const movement: StockMovement = {
        id: 'mov_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now(),
        tenant_id: tenantId,
        product_id: product.id,
        user_id: userId,
        type: dto.type,
        quantity: dto.quantity,
        previous_stock: previousStock,
        new_stock: updatedProduct.current_stock,
        reason: dto.reason?.trim() || null,
        created_at: new Date().toISOString(),
      };
      this.stockMovements.unshift(movement);

      return { movement, product: updatedProduct };
    } finally {
      // Libera o lock
      releaseLock();
    }
  }

  // ============================================================================
  // BUSCA E LISTAGEM DE PRODUTOS COM ISOLAMENTO DE TENANT
  // ============================================================================
  getProductsByTenant(
    tenantId: string,
    options?: { categoryId?: string; search?: string; barcode?: string }
  ): Product[] {
    let result = Array.from(this.products.values()).filter((p) => p.tenant_id === tenantId);

    if (options?.barcode) {
      const barcodeClean = options.barcode.trim();
      return result.filter((p) => p.barcode === barcodeClean);
    }

    if (options?.categoryId) {
      result = result.filter((p) => p.category_id === options.categoryId);
    }

    if (options?.search) {
      const term = options.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.barcode && p.barcode.includes(term))
      );
    }

    return result;
  }

  getProductById(tenantId: string, productId: string): Product | null {
    const p = this.products.get(productId);
    if (!p || p.tenant_id !== tenantId) return null;
    return p;
  }

  getMovementsByTenant(tenantId: string, limit = 50): StockMovement[] {
    return this.stockMovements.filter((m) => m.tenant_id === tenantId).slice(0, limit);
  }

  getCategoriesByTenant(tenantId: string): Category[] {
    return Array.from(this.categories.values()).filter((c) => c.tenant_id === tenantId);
  }

  upsertProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  deleteProduct(productId: string): boolean {
    return this.products.delete(productId);
  }

  upsertUser(user: User): void {
    this.users.set(user.id, user);
  }

  deleteUser(userId: string): boolean {
    return this.users.delete(userId);
  }
}

// Instância Singleton do banco em memória
export const inventoryStore = new InventoryDatabaseStore();
