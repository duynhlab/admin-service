import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/** Typed client for user's protected reads (homelab docs/api/user.md). */

export interface CustomerRow {
  user_id: string
  name: string
  phone: string
  created_at: string
}

export interface CustomerDetail extends CustomerRow {
  address: string
  updated_at: string
}

export function searchCustomers(
  q: { page: number; page_size: number; query?: string },
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<CustomerRow>>('/user/v1/protected/users', {
    query: { page: q.page, page_size: q.page_size, query: q.query },
    signal,
  })
}

export function getCustomer(userId: string, signal?: AbortSignal) {
  return apiFetch<CustomerDetail>(`/user/v1/protected/users/${userId}`, { signal })
}
