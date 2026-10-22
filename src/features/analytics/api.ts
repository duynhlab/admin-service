import { apiFetch } from '@/lib/api'
import { overviewSchema } from './contract'
import type { Filters, Overview } from './contract'

/**
 * Typed client for the analytics protected surface — the contract in homelab
 * docs/api/analytics.md (ADR-069). One bounded read: money arrives as decimal
 * integer strings and is validated, never coerced, so the page can only show
 * exact figures or an explicit unavailable state.
 */
export function getOverview(filters: Filters, signal?: AbortSignal): Promise<Overview> {
  return apiFetch<unknown>('/analytics/v1/protected/commerce/overview', {
    query: { currency: filters.currency, from: filters.from, to: filters.to },
    signal,
  }).then((body) => overviewSchema.parse(body))
}
