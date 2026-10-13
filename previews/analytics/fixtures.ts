import { overviewSchema } from '../../src/features/analytics/contract'
import type { Filters, Overview } from '../../src/features/analytics/contract'

// Owner-approved design fixtures. This module is never imported by the app entry.
export const previewTime = Date.parse('2026-10-13T10:00:00Z')
export const scenarios = ['healthy', 'stale', 'empty', 'loading', 'unavailable', 'unknown', 'error', 'refresh-error', 'forbidden', 'awaiting'] as const
export type Scenario = typeof scenarios[number]
export const defaultFilters: Filters = { currency: 'USD', from: '2026-10-06', to: '2026-10-13' }

export function makeOverview(filters: Filters, scenario: Scenario): Overview {
  const empty = scenario === 'empty'
  const days = (Date.parse(filters.to) - Date.parse(filters.from)) / 86_400_000
  const unit = filters.currency === 'USD' ? 1 : 250
  const trend: Overview['trend'] = []
  let capturedOrders = 0
  let started = 0
  let created = 0
  let completed = 0
  for (let index = 0; index < days; index++) {
    const timestamp = Date.parse(filters.from) + index * 86_400_000
    const seed = Math.floor(timestamp / 86_400_000) % 11
    const captured = empty ? 0 : 12 + seed
    capturedOrders += captured
    started += empty ? 0 : captured + 15
    created += empty ? 0 : captured + 6
    completed += empty ? 0 : captured - 3
    const settled = captured * (5900 + seed * 100) * unit
    const refunded = empty ? 0 : (seed % 3) * 2900 * unit
    trend.push({ date: new Date(timestamp).toISOString().slice(0, 10), settled_capture_minor: settled,
      refunded_minor: refunded, net_captured_minor: settled - refunded })
  }
  const settled = trend.reduce((sum, row) => sum + row.settled_capture_minor, 0)
  const refunded = trend.reduce((sum, row) => sum + row.refunded_minor, 0)
  const sources: Overview['meta']['sources'] = [
    { name: 'order', synced_at: new Date(previewTime - 30_000).toISOString(), lag_seconds: 30, state: 'healthy' },
    { name: 'checkout', synced_at: new Date(previewTime - 45_000).toISOString(), lag_seconds: 45, state: 'healthy' },
    { name: 'payment', synced_at: new Date(previewTime - 55_000).toISOString(), lag_seconds: 55, state: 'healthy' },
  ]
  const payment = sources[2]!
  if (scenario === 'stale' || scenario === 'refresh-error') {
    payment.synced_at = new Date(previewTime - 160_000).toISOString()
    payment.lag_seconds = 160
    payment.state = 'stale'
  } else if (scenario === 'unknown') {
    payment.synced_at = null
    payment.lag_seconds = null
    payment.state = 'unavailable'
  }
  const names = ['Mechanical keyboard', 'USB-C dock', 'Studio headphones', 'Wireless mouse', 'Desk mat']
  return overviewSchema.parse({
    filters,
    kpis: { settled_capture_minor: settled, refunded_minor: refunded, net_captured_minor: settled - refunded,
      captured_orders: capturedOrders, average_captured_order_minor: capturedOrders ? Math.round(settled / capturedOrders) : null },
    trend,
    funnel: { checkout_started: started, order_created: created, payment_captured: capturedOrders, order_completed: completed },
    top_products: empty ? [] : names.map((name, index) => ({
      product_id: `preview-${index + 1}`, product_name: name,
      quantity: Math.floor(capturedOrders / (index + 2)) + 2,
      order_count: Math.floor(capturedOrders / (index + 2)),
      item_subtotal_minor: (Math.floor(capturedOrders / (index + 2)) + 2) * (5900 - index * 900) * unit,
    })),
    meta: { generated_at: new Date(previewTime).toISOString(),
      data_through: new Date(Math.min(...sources.filter((s) => s.synced_at !== null).map((s) => Date.parse(s.synced_at!)))).toISOString(),
      stale: scenario === 'stale' || scenario === 'refresh-error', sources },
  })
}
