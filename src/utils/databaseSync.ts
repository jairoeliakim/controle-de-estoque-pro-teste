/**
 * Utilitário de Sincronização em Tempo Real com as Rotas do Banco de Dados Relacional
 * Alimenta automaticamente as tabelas do banco com todas as inserções do sistema:
 * - Produtos & Itens de Estoque (stock_items)
 * - Funcionários / Acessos (system_users)
 * - Fornecedores (suppliers)
 * - Empresas / Unidades (tenants_companies)
 * - Categorias de Produtos (categories)
 * - Apontamento de Perdas & CMV (loss_records)
 * - Sessões e Apurações de Contagem (stock_count_sessions)
 * - Pedidos de Compra (purchase_orders)
 * - Notas Fiscais (invoices_history)
 * - Itens Avulsos não cadastrados (unlisted_count_items)
 * - Parametrização Sistêmica (system_settings)
 */

export async function syncEntityToDatabase(table: string, data: any): Promise<boolean> {
  try {
    const response = await fetch(`/api/database/insert/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.warn(`[DB Sync] Servidor retornou código ${response.status} ao alimentar "${table}".`);
      return false;
    }

    const result = await response.json();
    if (result.success) {
      if (result.realDbSynced) {
        console.info(
          `%c[SGBD Persistido] Tabela "${table}" salva no banco externo com sucesso! (${result.insertedCount || 1} registro(s))`,
          'color: #10b981; font-weight: bold;'
        );
      } else if (result.realDbError) {
        console.warn(
          `%c[Aviso SGBD] Tabela "${table}" salva em cache, mas gerou aviso no banco externo: ${result.realDbError}`,
          'color: #f59e0b; font-weight: bold;'
        );
      } else {
        console.info(
          `%c[DB Cache] Tabela "${table}" registrada com sucesso.`,
          'color: #06b6d4; font-weight: bold;'
        );
      }
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[DB Sync Error] Erro ao comunicar com /api/database/insert/${table}:`, error);
    return false;
  }
}

export async function deleteEntityFromDatabase(table: string, id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/database/delete/${table}/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      console.info(
        `%c[DB Removido] Registro "${id}" excluído da tabela "${table}".`,
        'color: #f59e0b; font-weight: bold;'
      );
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[DB Delete Error] Erro ao deletar em /api/database/delete/${table}/${id}:`, error);
    return false;
  }
}

export async function fetchAllDatabaseData(): Promise<any | null> {
  try {
    const response = await fetch('/api/database/all-data');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function syncAllDataToDatabase(payload: any): Promise<{ success: boolean; recordsProcessed: number; message: string }> {
  try {
    const response = await fetch('/api/database/sync-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return { success: false, recordsProcessed: 0, message: `Erro HTTP ${response.status}` };
  } catch (error: any) {
    return { success: false, recordsProcessed: 0, message: error?.message || 'Falha de conexão com a rota de sincronização' };
  }
}
