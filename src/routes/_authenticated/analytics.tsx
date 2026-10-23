import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { filtersSchema } from '@/features/analytics/contract'
import type { Filters } from '@/features/analytics/contract'
import { AnalyticsOverview } from '@/features/analytics/overview'
import type { OverviewState } from '@/features/analytics/overview'
import { overviewQuery } from '@/features/analytics/queries'
import { ApiError } from '@/lib/api'

/**
 * Analytics (ADR-069): one bounded, read-only commerce overview served by
 * analytics-service from ClickHouse serving views. Filter state lives in the
 * URL (ADR-049); an invalid or missing interval falls back to the last seven
 * UTC days ending today. Freshness is the server's decision — the page shows
 * stale and unavailable states and never fabricates a number.
 */

const day = 86_400_000

// `to` is exclusive, so the default window ends tomorrow (UTC): the last seven
// days including today. Ending it today would hide everything from today.
function defaultFilters(): Filters {
  const today = new Date().toISOString().slice(0, 10)
  const to = new Date(Date.parse(today) + day).toISOString().slice(0, 10)
  const from = new Date(Date.parse(to) - 7 * day).toISOString().slice(0, 10)
  return { currency: 'USD', from, to }
}

const searchSchema = z.object({
  currency: z.enum(['USD']).catch('USD'),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/analytics')({
  validateSearch: (raw): Filters => {
    const parsed = searchSchema.parse(raw)
    const candidate = filtersSchema.safeParse(parsed)
    return candidate.success ? candidate.data : defaultFilters()
  },
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(overviewQuery(filters))

  let state: OverviewState
  if (query.data) {
    state = {
      kind: 'ready',
      data: query.data,
      refreshing: query.isFetching,
      refreshFailed: query.isError,
    }
  } else if (query.isPending) {
    state = { kind: 'loading' }
  } else {
    state = { kind: stateFor(query.error) }
  }

  return (
    <AnalyticsOverview
      filters={filters}
      onFiltersChange={(next) => void navigate({ search: next })}
      state={state}
      onRefresh={() => void query.refetch()}
    />
  )
}

/**
 * The edge and the service answer with the shared envelope. 403 is the role
 * gate (the token is valid but lacks backoffice_admin); 503 and a network
 * failure mean the read model cannot be certified right now; a contract
 * violation (schema parse) is an error the operator can report, not retry.
 */
function stateFor(error: unknown): 'forbidden' | 'unavailable' | 'error' {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden'
    if (error.status === 503 || error.status === 0) return 'unavailable'
  }
  return 'error'
}
