import { z } from 'zod'

// Draft presentation contract for RFC-0030; not a deployed API contract.
export const currencies = ['USD', 'VND'] as const
const day = 86_400_000
export const filtersSchema = z.object({
  currency: z.enum(currencies),
  from: z.iso.date(),
  to: z.iso.date(),
}).strict().superRefine(({ from, to }, ctx) => {
  const days = (Date.parse(to) - Date.parse(from)) / day
  if (days <= 0 || days > 90) {
    ctx.addIssue({ code: 'custom', message: 'Choose a UTC interval of 1 to 90 days.', path: ['to'] })
  }
})
export type Filters = z.infer<typeof filtersSchema>
export const sourceNames = ['order', 'checkout', 'payment'] as const
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const minor = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
const amounts = { settled_capture_minor: minor, refunded_minor: minor, net_captured_minor: minor }
export const overviewSchema = z.object({
  filters: filtersSchema,
  kpis: z.object({ ...amounts, captured_orders: count, average_captured_order_minor: minor.nullable() }),
  trend: z.array(z.object({ date: z.iso.date(), ...amounts })).max(90),
  funnel: z.object({ checkout_started: count, order_created: count, payment_captured: count, order_completed: count }),
  top_products: z.array(z.object({
    product_id: z.string(), product_name: z.string(), quantity: count, order_count: count, item_subtotal_minor: minor,
  })).max(10),
  meta: z.object({
    generated_at: z.iso.datetime(), data_through: z.iso.datetime(), stale: z.boolean(),
    sources: z.array(z.object({
      name: z.enum(sourceNames), synced_at: z.iso.datetime().nullable(),
      lag_seconds: z.number().nonnegative().nullable(), state: z.enum(['healthy', 'stale', 'unavailable']),
    })).length(3).refine((sources) => new Set(sources.map((s) => s.name)).size === 3, 'Every source is required exactly once'),
  }),
})
export type Overview = z.infer<typeof overviewSchema>
export type Source = Overview['meta']['sources'][number]
export type Availability = 'healthy' | 'stale' | 'unavailable'

// Re-evaluate cached data against the clock, not only the last HTTP response.
// Never let a failed refresh keep apparently healthy figures on screen forever.
export function availability(data: Overview, now: number): Availability {
  let stale = data.meta.stale
  for (const source of data.meta.sources) {
    if (source.synced_at === null || source.lag_seconds === null || source.state === 'unavailable') return 'unavailable'
    const observedAge = (now - Date.parse(source.synced_at)) / 1000
    if (observedAge < 0) return 'unavailable'
    const age = Math.max(source.lag_seconds, observedAge)
    if (!Number.isFinite(age) || age < 0 || age > 300) return 'unavailable'
    if (age > 120 || source.state === 'stale') stale = true
  }
  const throughAge = (now - Date.parse(data.meta.data_through)) / 1000
  if (!Number.isFinite(throughAge) || throughAge < 0 || throughAge > 300) return 'unavailable'
  return stale || throughAge > 120 ? 'stale' : 'healthy'
}

export function money(value: number | null, currency: Filters['currency']): string {
  if (value === null) return '—'
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'symbol' })
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(value / 10 ** exponent)
}

export function presetFilters(filters: Filters, days: number): Filters {
  return { ...filters, from: new Date(Date.parse(filters.to) - days * day).toISOString().slice(0, 10) }
}
