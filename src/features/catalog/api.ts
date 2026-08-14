import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/**
 * Typed client for product's protected catalog (homelab docs/api/product.md,
 * RFC-0023 slice B).
 *
 * Two conflict codes matter to the UI and both are operator-actionable, not
 * bugs: VERSION_CONFLICT means someone else edited the row since it was read,
 * and INVALID_TRANSITION means the lifecycle edge does not exist from the
 * product's current state.
 */

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export interface CatalogProduct {
  id: string
  name: string
  price: number
  description: string
  category: string
  status: ProductStatus
  /** Optimistic-concurrency token: every edit sends back the version it read. */
  version: number
}

export interface Category {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface AuditRow {
  id: number
  action: string
  actor_sub: string
  reason: string
  changed_fields: Record<string, unknown> | null
  version_before: number | null
  version_after: number | null
  created_at: string
}

export function listCatalogProducts(
  q: { page: number; page_size: number; status?: ProductStatus },
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<CatalogProduct>>('/product/v1/protected/products', {
    query: { page: q.page, page_size: q.page_size, status: q.status },
    signal,
  })
}

export function getCatalogProduct(id: string, signal?: AbortSignal) {
  return apiFetch<CatalogProduct>(`/product/v1/protected/products/${id}`, { signal })
}

export function listProductAudit(id: string, signal?: AbortSignal) {
  return apiFetch<{ items: AuditRow[] }>(`/product/v1/protected/products/${id}/audit`, { signal })
}

export interface CreateProductInput {
  name: string
  price: number
  description?: string
  category?: string
}

/** Creates a DRAFT product. A duplicate name answers 409 — that is what makes a retry safe. */
export function createProduct(input: CreateProductInput) {
  return apiFetch<CatalogProduct>('/product/v1/protected/products', {
    method: 'POST',
    body: input,
  })
}

export interface UpdateProductInput extends CreateProductInput {
  /** The version the form was loaded with; a stale one answers 409. */
  version: number
  reason?: string
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return apiFetch<CatalogProduct>(`/product/v1/protected/products/${id}`, {
    method: 'PUT',
    body: input,
  })
}

export type LifecycleAction = 'publish' | 'archive' | 'restore'

/** Applies one lifecycle command. An illegal edge answers 409 INVALID_TRANSITION. */
export function transitionProduct(id: string, action: LifecycleAction, reason?: string) {
  return apiFetch<CatalogProduct>(`/product/v1/protected/products/${id}/${action}`, {
    method: 'POST',
    body: reason ? { reason } : undefined,
  })
}

export function listCategories(q: { page: number; page_size: number }, signal?: AbortSignal) {
  return apiFetch<Paginated<Category>>('/product/v1/protected/categories', {
    query: { page: q.page, page_size: q.page_size },
    signal,
  })
}

export function createCategory(input: { name: string; description?: string }) {
  return apiFetch<Category>('/product/v1/protected/categories', { method: 'POST', body: input })
}

export function updateCategory(id: number, input: { name: string; description?: string }) {
  return apiFetch<Category>(`/product/v1/protected/categories/${id}`, {
    method: 'PUT',
    body: input,
  })
}
