import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { BarChart3, Moon, Sun } from 'lucide-react'
import { Button } from '../../src/components/ui/button'
import { AnalyticsOverview } from '../../src/features/analytics/overview'
import type { OverviewState } from '../../src/features/analytics/overview'
import { filtersSchema } from '../../src/features/analytics/contract'
import type { Filters } from '../../src/features/analytics/contract'
import { defaultFilters, makeOverview, previewTime, scenarios } from './fixtures'
import type { Scenario } from './fixtures'
import './preview.css'

const searchSchema = z.object({
  currency: z.enum(['USD', 'VND']).catch('USD'),
  from: z.iso.date().catch(defaultFilters.from), to: z.iso.date().catch(defaultFilters.to),
  scenario: z.enum(scenarios).catch('healthy'), theme: z.enum(['light', 'dark']).catch('light'),
})
const route = createRootRoute({
  validateSearch: (raw) => {
    const parsed = searchSchema.parse(raw)
    const valid = filtersSchema.safeParse({ currency: parsed.currency, from: parsed.from, to: parsed.to })
    return { ...parsed, ...(valid.success ? valid.data : defaultFilters) }
  },
  component: Preview,
})
const router = createRouter({ routeTree: route })
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

export function Preview() {
  const search = route.useSearch()
  const filters: Filters = { currency: search.currency, from: search.from, to: search.to }
  const query = useQuery({
    queryKey: ['analytics-design-preview', filters, search.scenario],
    queryFn: async ({ signal }) => {
      await new Promise<void>((resolve, reject) => {
        const done = () => { signal.removeEventListener('abort', abort); resolve() }
        const timer = window.setTimeout(done, 350)
        function abort() { window.clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
        signal.addEventListener('abort', abort, { once: true })
      })
      return makeOverview(filters, search.scenario)
    },
    enabled: !['loading', 'awaiting', 'forbidden', 'error', 'unavailable'].includes(search.scenario),
  })
  useEffect(() => { document.documentElement.classList.toggle('dark', search.theme === 'dark') }, [search.theme])
  const navigate = (patch: Partial<typeof search>) => { void router.navigate({ to: '/', search: { ...search, ...patch } }) }
  let state: OverviewState
  switch (search.scenario) {
    case 'awaiting': case 'forbidden': case 'error': case 'unavailable': case 'loading':
      state = { kind: search.scenario }; break
    default:
      state = query.data ? { kind: 'ready', data: query.data, refreshing: query.isFetching,
        refreshFailed: search.scenario === 'refresh-error' } : query.isError ? { kind: 'error' } : { kind: 'loading' }
  }
  const refresh = () => {
    if (search.scenario !== 'healthy' && search.scenario !== 'empty') navigate({ scenario: 'healthy' })
    else void query.refetch()
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#analytics-content" className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-background p-3 focus:not-sr-only">Skip to analytics</a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">B</span>
            <div><p className="text-sm font-semibold">Backoffice <span className="font-normal text-muted-foreground">/ Analytics</span></p>
              <p className="text-xs text-muted-foreground">Design preview · Illustrative data only</p></div></div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="scenario" className="text-xs text-muted-foreground">Preview state</label>
            <select id="scenario" className="h-9 rounded-lg border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              value={search.scenario} onChange={(event) => navigate({ scenario: event.target.value as Scenario })}>
              {scenarios.map((scenario) => <option key={scenario} value={scenario}>{scenario.replaceAll('-', ' ')}</option>)}
            </select>
            <Button size="icon" variant="outline" className="size-9" aria-label={search.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              onClick={() => navigate({ theme: search.theme === 'dark' ? 'light' : 'dark' })}>
              {search.theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-8 sm:py-7">
        <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="size-3.5" aria-hidden />
          <span>Preview clock: 13 Oct 2026, 10:00 UTC. Filters change illustrative fixtures, not live business data.</span></div>
        <main id="analytics-content" tabIndex={-1}><AnalyticsOverview filters={filters} onFiltersChange={navigate} state={state} onRefresh={refresh} clock={previewTime} /></main>
        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">RFC-0030 · UI review only · API, authorization and data correctness gates pending</footer>
      </div>
    </div>
  )
}

const element = document.getElementById('root')
if (!element) throw new Error('Missing preview root')
createRoot(element).render(<StrictMode><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)
