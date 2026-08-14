import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listBalances } from '@/features/inventory/api'
import { listOrders } from '@/features/orders/api'
import { listOpenAttempts, listReconRuns } from '@/features/payments/api'
import { auth } from '@/lib/auth'
import { formatMinor } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

/**
 * Attention cards (RFC-0023): every card is its own query key with its own
 * loading/error state — one failed domain read never blanks the page and
 * never fabricates a number (ADR-048).
 */
const lowStockQuery = queryOptions({
  queryKey: ['dashboard', 'low-stock'] as const,
  queryFn: ({ signal }) => listBalances({ page: 1, page_size: 1, low_stock: true }, signal),
})
const manualReviewQuery = queryOptions({
  queryKey: ['dashboard', 'manual-review'] as const,
  queryFn: ({ signal }) => listOrders({ page: 1, page_size: 1, status: 'manual_review' }, signal),
})
const cancellingQuery = queryOptions({
  queryKey: ['dashboard', 'cancelling'] as const,
  queryFn: ({ signal }) => listOrders({ page: 1, page_size: 1, status: 'cancelling' }, signal),
})
const openAttemptsQuery = queryOptions({
  queryKey: ['dashboard', 'open-attempts'] as const,
  queryFn: ({ signal }) => listOpenAttempts({ page: 1, page_size: 1 }, signal),
})
const latestReconQuery = queryOptions({
  queryKey: ['dashboard', 'recon'] as const,
  queryFn: ({ signal }) => listReconRuns({ page: 1, page_size: 1 }, signal),
})
const recentOrdersQuery = queryOptions({
  queryKey: ['dashboard', 'recent-orders'] as const,
  queryFn: ({ signal }) => listOrders({ page: 1, page_size: 5 }, signal),
})

function AttentionCard({
  title,
  to,
  search,
  query,
  value,
  alarmWhenPositive = true,
}: {
  title: string
  to: string
  /** Landing view on the target page, e.g. the payments page's tab. */
  search?: Record<string, string>
  query: UseQueryResult<unknown>
  value: number | undefined
  alarmWhenPositive?: boolean
}) {
  return (
    <Link
      to={to}
      search={search}
      className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-2"
    >
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {query.isPending ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : query.isError ? (
        <p className="mt-2 text-sm text-destructive">unavailable</p>
      ) : (
        <p
          className={cn(
            'mt-1 text-2xl font-semibold tabular-nums',
            alarmWhenPositive && (value ?? 0) > 0 && 'text-destructive',
          )}
        >
          {value}
        </p>
      )}
    </Link>
  )
}

function DashboardPage() {
  const lowStock = useQuery(lowStockQuery)
  const manualReview = useQuery(manualReviewQuery)
  const cancelling = useQuery(cancellingQuery)
  const openAttempts = useQuery(openAttemptsQuery)
  const recon = useQuery(latestReconQuery)
  const recent = useQuery(recentOrdersQuery)

  const latestRun = recon.data?.items?.[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{auth.username()}</span> —
          every number below is a live read from its owning service.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AttentionCard
          title="Low / out of stock"
          to="/inventory"
          query={lowStock}
          value={lowStock.data?.total_items}
        />
        <AttentionCard
          title="Manual review"
          to="/orders"
          query={manualReview}
          value={manualReview.data?.total_items}
        />
        <AttentionCard
          title="Cancelling"
          to="/orders"
          query={cancelling}
          value={cancelling.data?.total_items}
        />
        <AttentionCard
          title="Unresolved attempts"
          to="/payments"
          search={{ view: 'attempts' }}
          query={openAttempts}
          value={openAttempts.data?.total_items}
        />
        <AttentionCard
          title="Recon discrepancies (latest run)"
          to="/payments"
          search={{ view: 'reconciliation' }}
          query={recon}
          value={latestRun ? latestRun.discrepancies_found : 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent orders</CardTitle>
          <CardDescription>The five newest orders across all customers.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : recent.isError ? (
            <p className="text-sm text-destructive">Order service unavailable — other cards stay live.</p>
          ) : recent.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {recent.data.items.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">#{o.id}</span>
                    <Badge
                      variant={
                        o.status === 'manual_review' || o.status === 'cancelling'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {o.status}
                    </Badge>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatMinor(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
