import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/**
 * Typed client for inventory's protected surface — the as-built contract in
 * homelab docs/api/inventory.md (RFC-0023 slice A). Commands use the body
 * `command_id` idempotency style; the caller owns the id so an uncertain
 * retry replays instead of double-applying.
 */

export interface Balance {
  sku_id: string
  warehouse_id: number
  on_hand: number
  reserved: number
  safety_stock: number
  atp: number
  updated_at: string
}

export interface Movement {
  id: number
  command_id: string
  sku_id: string
  warehouse_id: number
  type: string
  on_hand_delta: number
  reserved_delta: number
  reference_type: string
  reference_id: string
  reason: string
  actor: string
  created_at: string
}

export interface Reservation {
  id: string
  order_id: string
  status: 'reserved' | 'committed' | 'released' | 'expired'
  expires_at: string
  created_at: string
  updated_at: string
}

export interface BalanceListQuery {
  page: number
  page_size: number
  sku_id?: string
  low_stock?: boolean
}

export function listBalances(q: BalanceListQuery, signal?: AbortSignal) {
  return apiFetch<Paginated<Balance>>('/inventory/v1/protected/balances', {
    query: {
      page: q.page,
      page_size: q.page_size,
      sku_id: q.sku_id || undefined,
      low_stock: q.low_stock ? 'true' : undefined,
    },
    signal,
  })
}

export interface MovementListQuery {
  page: number
  page_size: number
  sku_id?: string
}

export function listMovements(q: MovementListQuery, signal?: AbortSignal) {
  return apiFetch<Paginated<Movement>>('/inventory/v1/protected/movements', {
    query: {
      page: q.page,
      page_size: q.page_size,
      sku_id: q.sku_id || undefined,
    },
    signal,
  })
}

export interface ReservationListQuery {
  page: number
  page_size: number
  status?: Reservation['status']
}

export function listReservations(q: ReservationListQuery, signal?: AbortSignal) {
  return apiFetch<Paginated<Reservation>>('/inventory/v1/protected/reservations', {
    query: {
      page: q.page,
      page_size: q.page_size,
      status: q.status,
    },
    signal,
  })
}

export interface CommandResult {
  command_id: string
  /** false = idempotent replay of an already-applied command. */
  applied: boolean
}

export interface ReceiptInput {
  command_id: string
  sku_id: string
  warehouse_id: number
  quantity: number
  reason?: string
}

export function receiveStock(input: ReceiptInput) {
  return apiFetch<CommandResult>('/inventory/v1/protected/receipts', {
    method: 'POST',
    body: input,
  })
}

export interface AdjustmentInput {
  command_id: string
  sku_id: string
  warehouse_id: number
  delta: number
  reason: string
}

export function adjustStock(input: AdjustmentInput) {
  return apiFetch<CommandResult>('/inventory/v1/protected/adjustments', {
    method: 'POST',
    body: input,
  })
}
