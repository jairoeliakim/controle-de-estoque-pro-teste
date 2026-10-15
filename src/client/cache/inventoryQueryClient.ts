import { useState, useEffect, useCallback } from 'react';
import { Product, StockMovement, CreateMovementDTO, PresignedUrlResponseDTO } from '../../types/inventory.js';
import { apiRequest, ApiError, OfflineConnectionError } from '../api/apiClient.js';

/**
 * ==============================================================================
 * GUIA DE CONFIGURAÇÃO COM TANSTACK QUERY V5 (REACT QUERY)
 * ==============================================================================
 * 
 * ```typescript
 * import { QueryClient, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 * 
 * // 1. Configuração do QueryClient para Sistema 100% Online
 * export const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: {
 *       staleTime: 15 * 1000,          // 15 segundos: garante dados ultra-frescos sem flood
 *       gcTime: 5 * 60 * 1000,         // 5 minutos: descarta da memória dados não visualizados
 *       refetchOnWindowFocus: true,    // Revalida ao focar na janela/app
 *       refetchOnReconnect: true,      // Revalida instantaneamente ao reconectar à internet
 *       retry: (failureCount, error) => {
 *         // Nunca repete se for erro de validação ou dispositivo offline
 *         if (error instanceof OfflineConnectionError) return false;
 *         return failureCount < 2;
 *       },
 *     },
 *   },
 * });
 * 
 * // 2. Hook de Mutação com Invalidação Automática do Cache
 * export function useStockMovementMutation() {
 *   const qc = useQueryClient();
 *   return useMutation({
 *     mutationFn: (dto: CreateMovementDTO) =>
 *       apiRequest('/api/stock/movements', {
 *         method: 'POST',
 *         body: JSON.stringify(dto),
 *       }),
 *     onSuccess: (data) => {
 *       // INVALIDAÇÃO IMEDIATA: Força refetch de todas as listas de produtos
 *       qc.invalidateQueries({ queryKey: ['products'] });
 *       qc.invalidateQueries({ queryKey: ['product', data.data.product.id] });
 *       qc.invalidateQueries({ queryKey: ['stock-movements'] });
 *     },
 *   });
 * }
 * ```
 */

// ==============================================================================
// GERENCIADOR DE CACHE EFÊMERO EM MEMÓRIA NATIVO (STANDALONE)
// Permite uso direto e reatividade total na aplicação
// ==============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class EphemeralMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private listeners = new Set<() => void>();
  private readonly defaultStaleTime = 15 * 1000; // 15 segundos

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    this.notify();
  }

  get<T>(key: string, maxAge = this.defaultStaleTime): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const isStale = Date.now() - entry.timestamp > maxAge;
    if (isStale) return null; // Expirado
    return entry.data as T;
  }

  invalidate(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
    this.notify();
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const memoryCache = new EphemeralMemoryCache();

// ==============================================================================
// HOOKS REATIVOS DE CONSUMO 100% ONLINE
// ==============================================================================

export function useOnlineProducts(searchQuery?: string, categoryId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `products_${categoryId || 'all'}_${searchQuery || ''}`;

  const fetchProducts = useCallback(async (force = false) => {
    try {
      if (!force) {
        const cached = memoryCache.get<Product[]>(cacheKey);
        if (cached) {
          setProducts(cached);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (categoryId) params.append('category_id', categoryId);
      if (searchQuery) params.append('search', searchQuery);

      const url = `/api/products${params.toString() ? '?' + params.toString() : ''}`;
      const response = await apiRequest<{ success: boolean; data: Product[] }>(url);

      setProducts(response.data);
      memoryCache.set(cacheKey, response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar produtos do estoque online.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, categoryId, searchQuery]);

  useEffect(() => {
    fetchProducts();
    // Revalida automaticamente ao invalidar o cache
    const unsubscribe = memoryCache.subscribe(() => {
      fetchProducts(true);
    });
    return unsubscribe;
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: () => fetchProducts(true) };
}

/**
 * Hook para Executar Movimentação Atômica com Invalidação Automática de Cache
 */
export function useStockMovementMutation() {
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const executeMovement = async (dto: CreateMovementDTO): Promise<{ movement: StockMovement; product: Product }> => {
    setIsMutating(true);
    setMutationError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        message: string;
        data: { movement: StockMovement; product: Product };
      }>('/api/stock/movements', {
        method: 'POST',
        body: JSON.stringify(dto),
      });

      // INVALIDAÇÃO AUTOMÁTICA EM MEMÓRIA
      // Qualquer tela aberta na Web ou Mobile receberá o saldo atualizado instantaneamente
      memoryCache.invalidate('products');
      memoryCache.invalidate('movements');

      return response.data;
    } catch (err: any) {
      const errorMsg = err instanceof ApiError ? err.message : err.message || 'Erro ao registrar movimentação.';
      setMutationError(errorMsg);
      throw err;
    } finally {
      setIsMutating(false);
    }
  };

  return { executeMovement, isMutating, mutationError };
}

/**
 * Hook para Busca Instantânea por Código de Barras (Leitor ou Digitação)
 */
export function useBarcodeSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchBarcode = async (barcode: string): Promise<Product | null> => {
    if (!barcode.trim()) return null;
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await apiRequest<{ success: boolean; data: Product }>(
        `/api/products/search?barcode=${encodeURIComponent(barcode.trim())}`
      );
      return response.data;
    } catch (err: any) {
      setSearchError(err.message || 'Código de barras não localizado.');
      return null;
    } finally {
      setIsSearching(false);
    }
  };

  return { searchBarcode, isSearching, searchError };
}

/**
 * Hook para Geração de Presigned URL de Upload S3 / R2
 */
export async function requestPresignedUploadUrl(
  filename: string,
  contentType: string,
  productId?: string
): Promise<PresignedUrlResponseDTO> {
  const response = await apiRequest<{ success: boolean; data: PresignedUrlResponseDTO }>(
    '/api/uploads/presigned-url',
    {
      method: 'POST',
      body: JSON.stringify({ filename, content_type: contentType, product_id: productId }),
    }
  );
  return response.data;
}
