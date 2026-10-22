import { queryOptions } from '@tanstack/react-query'
import { getOverview } from '@/features/analytics/api'
import type { Filters } from '@/features/analytics/contract'

/**
 * One key per validated filter set (ADR-049: URL state is the cache key).
 * The read model is bounded-eventual, so a 30 s staleTime and a 60 s
 * background refetch track the source heartbeats without hammering the edge;
 * the page re-evaluates freshness against the clock between refetches.
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (filters: Filters) => [...analyticsKeys.all, 'overview', filters] as const,
}

export const overviewQuery = (filters: Filters) =>
  queryOptions({
    queryKey: analyticsKeys.overview(filters),
    queryFn: ({ signal }) => getOverview(filters, signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    // 4xx answers are final for this request; the page shows the state.
    retry: false,
  })
