import { useEffect, useState } from 'react'
import { Clock3, Database, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AnalyticsFilters } from './filters'
import { availability, money } from './contract'
import type { Filters, Overview } from './contract'
import { CaptureTrend } from './trend'

export type OverviewState =
  | { kind: 'loading' }
  | { kind: 'awaiting' | 'unavailable' | 'error' | 'forbidden' }
  | { kind: 'ready'; data: Overview; refreshFailed?: boolean; refreshing?: boolean }

export function AnalyticsOverview({ filters, onFiltersChange, state, onRefresh, clock }: {
  filters: Filters; onFiltersChange: (filters: Filters) => void; state: OverviewState; onRefresh: () => void
  /** Frozen clock for the isolated design preview; real consumers use wall time. */
  clock?: number
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (clock !== undefined) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [clock])
  const currentTime = clock ?? now
  const data = state.kind === 'ready' ? state.data : undefined
  const health = data ? availability(data, currentTime) : 'unavailable'
  const blocked = state.kind === 'ready' && health === 'unavailable' ? 'unavailable' : state.kind
  const empty = data && data.funnel.checkout_started === 0 && data.kpis.captured_orders === 0
    && data.trend.every((row) => row.settled_capture_minor === 0 && row.refunded_minor === 0)
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="mb-1 text-xs font-medium text-muted-foreground">Commerce intelligence</p>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Understand captured payments and the path from checkout to completion.</p></div>
        <Button variant="outline" className="h-9" onClick={onRefresh} disabled={state.kind === 'loading' || state.kind === 'forbidden' || state.kind === 'awaiting' || (state.kind === 'ready' && state.refreshing)}>
          <RefreshCw className="size-3.5" aria-hidden />{state.kind === 'ready' && state.refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>
      <AnalyticsFilters key={`${filters.currency}:${filters.from}:${filters.to}`} filters={filters} onChange={onFiltersChange} />
      {blocked === 'loading' ? <LoadingOverview /> : blocked !== 'ready' ? (
        <Unavailable kind={blocked} onRetry={onRefresh} />
      ) : data && (
        <>
          <section aria-label="Data freshness" className={cn('rounded-xl border px-4 py-3', health === 'stale' ? 'border-primary/40 bg-primary/5' : 'bg-card')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5"><Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div><p className="text-sm font-medium">{health === 'stale' ? 'Delayed data' : 'Data is fresh'}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Through {utc(data.meta.data_through)}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{health === 'stale' ? 'A source is 2–5 minutes behind. Values may change as it catches up.' : 'All three sources are within the two-minute freshness window.'}</p>
                </div>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums" aria-label="Source lag">
                {data.meta.sources.map((source) => <li key={source.name} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{source.name}</span>
                  <span>{source.synced_at ? `${Math.ceil(Math.max(source.lag_seconds ?? 0, (currentTime - Date.parse(source.synced_at)) / 1000))}s` : 'unknown'}</span>
                </li>)}
              </ul>
            </div>
            {state.kind === 'ready' && state.refreshFailed && <p role="status" className="mt-3 border-t pt-3 text-sm">
              Refresh failed. Showing the last successful result while its source timestamps remain within five minutes. Try Refresh again.
            </p>}
          </section>
          {empty ? <section className="rounded-xl border bg-card px-5 py-14 text-center" aria-labelledby="empty-heading">
            <Database className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
            <h2 id="empty-heading" className="text-base font-medium">No activity in this interval</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sources are available. Try another date range or currency.</p>
          </section> : <>
            <KPIs data={data} />
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <CaptureTrend data={data.trend} currency={filters.currency} />
              <CheckoutFunnel data={data.funnel} />
            </div>
            <TopProducts data={data} />
          </>}
          <p className="text-xs text-muted-foreground">Generated {utc(data.meta.generated_at)} · Eventual consistency across sources; not a transactional snapshot.</p>
        </>
      )}
    </div>
  )
}

function utc(value: string) {
  return `${value.slice(0, 10)} ${value.slice(11, 19)} UTC`
}

function KPIs({ data }: { data: Overview }) {
  const { kpis, filters } = data
  const items = [
    { title: 'Net captured', value: money(kpis.net_captured_minor, filters.currency), hint: 'Settled capture less refunds', featured: true },
    { title: 'Settled capture', value: money(kpis.settled_capture_minor, filters.currency), hint: 'Capture less reversals' },
    { title: 'Refunded', value: money(kpis.refunded_minor, filters.currency), hint: 'Successful ledger postings' },
    { title: 'Captured orders', value: kpis.captured_orders.toLocaleString('en-US'), hint: 'Positive non-reversed capture' },
    { title: 'Avg. captured order', value: money(kpis.average_captured_order_minor, filters.currency), hint: 'Settled capture / captured orders' },
  ]
  return <section aria-label="Commerce KPIs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    {items.map((item) => <div key={item.title} className={cn('min-w-0 rounded-xl border bg-card p-4', item.featured && 'border-primary/35 sm:col-span-2 xl:col-span-1')}>
      <h2 className="text-xs font-medium text-muted-foreground">{item.title}</h2>
      <p className={cn('my-2 break-words text-2xl font-semibold tracking-tight tabular-nums', item.featured && 'text-primary')}>{item.value}</p>
      <p className="text-xs text-muted-foreground">{item.hint}</p>
    </div>)}
  </section>
}

function CheckoutFunnel({ data }: { data: Overview['funnel'] }) {
  const steps = [
    ['Checkout started', data.checkout_started], ['Order created', data.order_created],
    ['Payment captured', data.payment_captured], ['Order completed', data.order_completed],
  ] as const
  return <section aria-labelledby="funnel-heading" className="rounded-xl border bg-card p-4 sm:p-5">
    <h2 id="funnel-heading" className="text-sm font-medium">Checkout conversion</h2>
    <p className="mt-1 text-xs text-muted-foreground">Sessions started in the selected UTC interval</p>
    <ol className="mt-6 space-y-5">
      {steps.map(([label, count], index) => {
        const percent = data.checkout_started ? count / data.checkout_started * 100 : 0
        return <li key={label}>
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2"><span className="text-xs text-muted-foreground">0{index + 1}</span>{label}</span>
            <span className="font-medium tabular-nums">{count.toLocaleString('en-US')} <span className="ml-1 text-xs font-normal text-muted-foreground">{percent.toFixed(1)}%</span></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percent)}%`, opacity: 1 - index * 0.16 }} /></div>
        </li>
      })}
    </ol>
    <p className="mt-5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">Each stage is measured against the starting cohort. Completion and capture are independent observations, not a required sequence.</p>
  </section>
}

function TopProducts({ data }: { data: Overview }) {
  // The API returns a bounded top ten; there is no client-side ranking or pagination.
  return <section aria-labelledby="products-heading" className="min-w-0 rounded-xl border bg-card">
    <div className="p-4 sm:p-5"><h2 id="products-heading" className="text-sm font-medium">Top products in captured orders</h2>
      <p className="mt-1 text-xs text-muted-foreground">Ranked by item subtotal · Historical names and prices · Not payment revenue</p><p className="mt-1 text-xs text-muted-foreground sm:hidden">Scroll horizontally to see item subtotals.</p></div>
    {data.top_products.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">No product items for these captured orders.</p> : (
      <div className="overflow-x-auto" role="region" aria-label="Top products table" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Top products in {data.filters.currency}; item subtotal is not revenue</caption>
          <thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr>
            <th className="px-4 py-3 font-medium sm:px-5">Product</th><th className="px-4 py-3 text-right font-medium">Quantity</th>
            <th className="px-4 py-3 text-right font-medium">Orders</th><th className="whitespace-nowrap px-4 py-3 text-right font-medium sm:px-5">Item subtotal</th>
          </tr></thead>
          <tbody>{data.top_products.map((product, index) => <tr key={product.product_id} className="border-b last:border-0">
            <th scope="row" className="min-w-48 px-4 py-3 font-normal sm:px-5"><span className="mr-3 text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>{product.product_name}</th>
            <td className="px-4 py-3 text-right tabular-nums">{product.quantity.toLocaleString('en-US')}</td>
            <td className="px-4 py-3 text-right tabular-nums">{product.order_count.toLocaleString('en-US')}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums sm:px-5">{money(product.item_subtotal_minor, data.filters.currency)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    )}
  </section>
}

function LoadingOverview() {
  return <div role="status" aria-label="Loading analytics" className="space-y-5">
    <span className="sr-only">Loading analytics</span><Skeleton className="h-20 rounded-xl" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className={cn('h-28 rounded-xl', i === 0 && 'sm:col-span-2 xl:col-span-1')} />)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div><Skeleton className="h-72 rounded-xl" />
  </div>
}

function Unavailable({ kind, onRetry }: { kind: Exclude<OverviewState['kind'], 'ready' | 'loading'>; onRetry: () => void }) {
  const states = {
    awaiting: { title: 'Analytics is not connected yet', text: 'This view is waiting for the analytics API. No business values are available.', icon: Database },
    unavailable: { title: 'Analytics is unavailable', text: 'A source is more than five minutes behind, its freshness is unknown, or the pipeline cannot be reached. Figures are hidden until freshness is verified.', icon: Clock3 },
    error: { title: 'Could not load analytics', text: 'The request failed. Retry to fetch this interval again; no values have been substituted.', icon: TriangleAlert },
    forbidden: { title: 'Analytics access required', text: 'Your staff account does not have permission to view analytics. Contact your administrator.', icon: ShieldAlert },
  }
  const selected = states[kind]
  return <section className="rounded-xl border bg-card px-5 py-16 text-center" aria-labelledby="state-heading">
    <selected.icon className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
    <h2 id="state-heading" className="text-base font-medium">{selected.title}</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{selected.text}</p>
    {(kind === 'unavailable' || kind === 'error') && <Button variant="outline" className="mt-5" onClick={onRetry}><RefreshCw aria-hidden />Try again</Button>}
  </section>
}
