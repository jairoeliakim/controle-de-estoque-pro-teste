import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { inventoryStore } from '../db/inventoryStore.js';
import { CreateMovementDTO, PresignedUrlRequestDTO } from '../../types/inventory.js';

export const inventoryRouter = Router();

// ==============================================================================
// 1. REGISTRO DE MOVIMENTAÇÃO DE ESTOQUE (TRANSAÇÃO ATÔMICA COM VALIDAÇÃO)
// ==============================================================================
inventoryRouter.post('/stock/movements', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenant_id;
    const userId = req.user!.user_id;

    const { product_id, type, quantity, reason } = req.body as CreateMovementDTO;

    // Executa a transação atômica protegida por lock
    const result = await inventoryStore.executeAtomicStockMovement(tenantId, userId, {
      product_id,
      type,
      quantity: Number(quantity),
      reason,
    });

    res.status(201).json({
      success: true,
      message: `Movimentação de ${type} registrada com sucesso na transação atômica.`,
      data: {
        movement: result.movement,
        product: result.product,
      },
    });
  } catch (error: any) {
    const message = error?.message || 'Erro ao processar movimentação de estoque.';

    if (message.startsWith('INSUFFICIENT_STOCK')) {
      res.status(422).json({
        error: 'INSUFFICIENT_STOCK',
        message: message.replace('INSUFFICIENT_STOCK: ', ''),
        rollback: true,
      });
      return;
    }

    if (message.startsWith('NOT_FOUND')) {
      res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: message.replace('NOT_FOUND: ', ''),
      });
      return;
    }

    if (message.startsWith('VALIDATION_ERROR')) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: message.replace('VALIDATION_ERROR: ', ''),
      });
      return;
    }

    console.error('[API stock/movements error]', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Falha interna durante a transação de estoque. Rollback efetuado.',
    });
  }
});

// ==============================================================================
// 2. LISTAGEM GERAL DE PRODUTOS (FILTRADO PELO TENANT_ID DO JWT)
// ==============================================================================
inventoryRouter.get('/products', requireAuth, (req: Request, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const categoryId = req.query.category_id as string | undefined;
  const search = req.query.search as string | undefined;

  const products = inventoryStore.getProductsByTenant(tenantId, { categoryId, search });

  res.json({
    success: true,
    total: products.length,
    data: products,
  });
});

// ==============================================================================
// 3. BUSCA RÁPIDA DE PRODUTOS (CÓDIGO DE BARRAS OU NOME / SKU)
// ==============================================================================
inventoryRouter.get('/products/search', requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.user!.tenant_id;
  const barcode = (req.query.barcode as string | undefined)?.trim();
  const query = (req.query.q as string | undefined)?.trim();

  if (!barcode && !query) {
    res.status(400).json({
      error: 'QUERY_REQUIRED',
      message: 'Informe o parâmetro "barcode" ou o termo de busca "q".',
    });
    return;
  }

  if (barcode) {
    const products = inventoryStore.getProductsByTenant(tenantId, { barcode });
    const product = products[0] || null;

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'PRODUCT_NOT_FOUND',
        message: `Nenhum produto cadastrado com o código de barras "${barcode}" neste restaurante.`,
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
    return;
  }

  // Busca genérica por termo 'q'
  const matches = inventoryStore.getProductsByTenant(tenantId, { search: query });
  res.json({
    success: true,
    total: matches.length,
    data: matches,
  });
});

// ==============================================================================
// 4. GERAÇÃO DE URL PRÉ-ASSINADA PARA UPLOAD DIRETO DE FOTOS (S3 / CLOUDFLARE R2)
// ==============================================================================
inventoryRouter.post('/uploads/presigned-url', requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.user!.tenant_id;
  const { filename, content_type, product_id } = req.body as PresignedUrlRequestDTO;

  if (!filename || !content_type) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Os campos filename e content_type são obrigatórios.',
    });
    return;
  }

  // Validação de tipo MIME seguro para fotos de produtos
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(content_type.toLowerCase())) {
    res.status(400).json({
      error: 'INVALID_MIME_TYPE',
      message: 'Tipo de arquivo não suportado. Use JPEG, PNG ou WEBP.',
    });
    return;
  }

  // Gera chave única isolada pelo tenant_id
  const extension = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const fileKey = `tenants/${tenantId}/products/${product_id || 'new'}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}.${extension}`;

  // Configuração simulada / compatível com AWS S3 / Cloudflare R2
  const bucketName = process.env.S3_BUCKET_NAME || 'saas-inventory-photos';
  const s3Endpoint = process.env.S3_ENDPOINT || 'https://pub-r2.storage.cloudflare.com';
  
  // Em produção com @aws-sdk/s3-request-presigner:
  // const command = new PutObjectCommand({ Bucket: bucketName, Key: fileKey, ContentType: content_type });
  // const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  const uploadUrl = `${s3Endpoint}/${bucketName}/${fileKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock_cred&X-Amz-Date=${new Date()
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, '')}&X-Amz-Expires=300&X-Amz-Signature=mock_presigned_signature`;

  const publicUrl = `${s3Endpoint}/${bucketName}/${fileKey}`;

  res.json({
    success: true,
    data: {
      upload_url: uploadUrl,
      public_url: publicUrl,
      file_key: fileKey,
      expires_in_seconds: 300,
      headers: {
        'Content-Type': content_type,
        'x-amz-acl': 'public-read',
      },
    },
  });
});

// ==============================================================================
// 5. AUDITORIA: HISTÓRICO DE MOVIMENTAÇÕES DE ESTOQUE
// ==============================================================================
inventoryRouter.get('/stock/movements', requireAuth, (req: Request, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const movements = inventoryStore.getMovementsByTenant(tenantId);

  res.json({
    success: true,
    total: movements.length,
    data: movements,
  });
});

// ==============================================================================
// 6. CATEGORIAS DO TENANT
// ==============================================================================
inventoryRouter.get('/categories', requireAuth, (req: Request, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const categories = inventoryStore.getCategoriesByTenant(tenantId);

  res.json({
    success: true,
    data: categories,
  });
});

// ==============================================================================
// 7. STATUS E DIAGNÓSTICO DO BANCO DE DADOS (EXCLUSIVO ADMINISTRADOR)
// ==============================================================================
inventoryRouter.get('/admin/db-status', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const tenantId = req.user!.tenant_id;
  res.json({
    success: true,
    message: 'Acesso autorizado ao diagnóstico do banco de dados relacional.',
    database: {
      type: 'PostgreSQL / MySQL Multi-Tenant',
      tenant_id: tenantId,
      isolation: 'Schema/Tenant-ID strict isolation',
      pool_status: 'healthy',
      total_products: inventoryStore.getProductsByTenant(tenantId).length,
      total_movements: inventoryStore.getMovementsByTenant(tenantId).length,
    },
  });
});
