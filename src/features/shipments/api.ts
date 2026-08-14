import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/** Typed client for shipping's protected reads (homelab docs/api/shipping.md). */

export const SHIPMENT_STATUSES = ['pending', 'cancelled', 'in_transit', 'delivered'] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export interface Shipment {
  id: number
  order_id: number
  tracking_number: string
  carrier?: string
  status: ShipmentStatus
  estimated_delivery?: string
  created_at?: string
}

export function listShipments(
  q: { page: number; page_size: number; status?: ShipmentStatus },
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<Shipment>>('/shipping/v1/protected/shipments', {
    query: { page: q.page, page_size: q.page_size, status: q.status },
    signal,
  })
}
