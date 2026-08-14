import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/** Typed client for order's protected reads (homelab docs/api/order.md). */

export const ORDER_STATUSES = [
  'pending', 'processing', 'confirmed', 'completed',
  'cancelling', 'cancelled', 'manual_review',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  price: number
  subtotal: number
}

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  items: OrderItem[] | null
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  created_at: string
}

export interface OrderListQuery {
  page: number
  page_size: number
  status?: OrderStatus
}

export function listOrders(q: OrderListQuery, signal?: AbortSignal) {
  return apiFetch<Paginated<Order>>('/order/v1/protected/orders', {
    query: { page: q.page, page_size: q.page_size, status: q.status },
    signal,
  })
}

export function getOrder(id: string, signal?: AbortSignal) {
  return apiFetch<Order>(`/order/v1/protected/orders/${id}`, { signal })
}
