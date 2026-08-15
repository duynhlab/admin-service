import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/**
 * Typed client for order's protected surface (homelab docs/api/order.md): the
 * cross-customer reads, and the one privileged write — resolving an order out
 * of `manual_review` (ADR-051).
 */

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

/**
 * The operator case view. The order's own fields are inline — the service
 * embeds rather than nests, so this stays assignable to `Order` — plus the
 * version the resolve command echoes back, the three external truths, and the
 * transition history.
 *
 * `degraded` is the distinction that matters when deciding what to resolve: a
 * block that is simply ABSENT (no shipment was ever created, no reservation on
 * the product path) is missing from the response and NOT listed here; a block
 * whose fetch FAILED is missing AND listed. "There is no shipment" and "we
 * could not ask about the shipment" must never render the same.
 */
export interface OrderCase extends Order {
  version: number
  shipment?: ShipmentBlock
  payment?: PaymentBlock
  processing?: ProcessingBlock
  inventory?: InventoryBlock
  status_history: Array<StatusHistoryEntry>
  degraded?: Array<string>
}

export interface ShipmentBlock {
  id: number
  order_id: number
  tracking_number: string
  carrier?: string
  status: string
  estimated_delivery?: string
  created_at: string
  updated_at: string
}

/**
 * Amounts are dollars here, not minor units — this block comes from order's
 * payment client, which already converts. `status` derives
 * `partially_refunded` when refunds exist but do not cover the amount, which is
 * exactly the case an operator resolving a parked order needs to notice.
 */
export interface PaymentBlock {
  status: string
  amount: number
  refunded?: number
  currency: string
  decline_code?: string
}

export interface ProcessingBlock {
  stage: string
  last_step?: string
  last_error_code?: string
  updated_at: string
}

export interface InventoryBlock {
  status: string
}

/** One recorded transition, committed with the transition itself. */
export interface StatusHistoryEntry {
  from_status: string
  to_status: string
  reason_code?: string
  actor_type: string
  actor_id?: string
  note?: string
  command_id: string
  created_at: string
}

export function getOrder(id: string, signal?: AbortSignal) {
  return apiFetch<OrderCase>(`/order/v1/protected/orders/${id}`, { signal })
}

/** Where an operator may move a parked order — the service owns the closed set. */
export const RESOLVE_TARGETS = ['confirmed', 'completed', 'cancelled', 'failed'] as const
export type ResolveTarget = (typeof RESOLVE_TARGETS)[number]

/**
 * Which unaccounted side effect the operator settled by hand. This is the
 * question the next reader of the audit trail has, which is why it is a bounded
 * vocabulary and not free text — the note carries the specifics.
 */
export const RESOLVE_REASONS = [
  { value: 'REFUNDED_MANUALLY', label: 'Refunded by hand' },
  { value: 'STOCK_RELEASED_MANUALLY', label: 'Stock released or returned by hand' },
  { value: 'SHIPMENT_CANCELLED_MANUALLY', label: 'Shipment cancelled by hand' },
  { value: 'NO_SIDE_EFFECTS', label: 'Nothing to unwind' },
  { value: 'WRITTEN_OFF', label: 'Written off — accepted as a loss' },
  { value: 'OPERATOR_RESOLVED', label: 'Other (see the note)' },
] as const
export type ResolveReason = (typeof RESOLVE_REASONS)[number]['value']

export interface ResolveInput {
  target: ResolveTarget
  /** The version read with the case. A stale one is refused, not applied. */
  version: number
  reason: ResolveReason
  note: string
}

/**
 * `applied: false` means this exact decision had already been recorded — the
 * command replayed and wrote nothing, which is a different thing from failing.
 */
export interface ResolveResult {
  order: Order | null
  applied: boolean
}

export function resolveOrder(id: string, input: ResolveInput) {
  return apiFetch<ResolveResult>(`/order/v1/protected/orders/${id}/resolve`, {
    method: 'POST',
    body: input,
  })
}
