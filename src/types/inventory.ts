export type UserRole = 'admin' | 'operador';

export type StockMovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface Tenant {
  id: string;
  name: string;
  document: string; // CNPJ ou CPF
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  created_at?: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  current_stock: number;
  min_stock: number;
  unit_price: number;
  photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  user_id: string;
  type: StockMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string | null;
  created_at: string;
}

export interface AuthTokenPayload {
  user_id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface CreateMovementDTO {
  product_id: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

export interface PresignedUrlRequestDTO {
  filename: string;
  content_type: string;
  product_id?: string;
}

export interface PresignedUrlResponseDTO {
  upload_url: string;
  public_url: string;
  file_key: string;
  expires_in_seconds: number;
  headers: Record<string, string>;
}
