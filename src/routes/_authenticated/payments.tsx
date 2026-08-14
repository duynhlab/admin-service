import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { DataTable, dataTableFeatures } from '@/components/data-table'
import { listOpenAttempts, listPayments, listReconRuns, PAYMENT_STATUSES } from '@/features/payments/api'
import type { Payment, PaymentAttempt, PaymentStatus, ReconRun } from '@/features/payments/api'
import { ApiError } from '@/lib/api'
import { formatMinor, StatusChips } from '@/lib/format'
import { cn } from '@/lib/utils'

const searchSchema = z.object({
  view: z.enum(['payments', 'attempts', 'reconciliation']).catch('payments'),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce.number().int().min(1).max(100).catch(20),
  status: z.enum(PAYMENT_STATUSES).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/payments')({
  validateSearch: searchSchema,
  component: PaymentsPage,
})

export const paymentsQuery = (q: { page: number; page_size: number; status?: PaymentStatus }) =>
  queryOptions({ queryKey: ['payments', 'list', q] as const, queryFn: ({ signal }) => listPayments(q, signal) })

export const reconRunsQuery = (q: { page: number; page_size: number }) =>
  queryOptions({ queryKey: ['payments', 'recon', q] as const, queryFn: ({ signal }) => listReconRuns(q, signal) })

export const openAttemptsQuery = (q: { page: number; page_size: number }) =>
  queryOptions({
    queryKey: ['payments', 'open-attempts', q] as const,
    queryFn: ({ signal }) => listOpenAttempts(q, signal),
  })

const payCol = createColumnHelper<typeof dataTableFeatures, Payment>()
const runCol = createColumnHelper<typeof dataTableFeatures, ReconRun>()
const attCol = createColumnHelper<typeof dataTableFeatures, PaymentAttempt>()

const payVariant = (s: PaymentStatus) =>
  s === 'failed' || s === 'expired' ? 'destructive'
  : s === 'captured' || s === 'refunded' ? 'secondary' : 'outline'

function PaymentsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const pagination: PaginationState = { pageIndex: search.page - 1, pageSize: search.page_size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    const next = typeof u === 'function' ? u(pagination) : u
    void navigate({ search: (prev) => ({ ...prev, page: next.pageIndex + 1, page_size: next.pageSize }) })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Payment views">
        {(['payments', 'attempts', 'reconciliation'] as const).map((view) => (
          <button
            key={view}
            role="tab"
            aria-selected={search.view === view}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, view, page: 1 }) })}
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition-colors',
              search.view === view
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {view}
          </button>
        ))}
      </div>
      {search.view === 'payments' ? (
        <PaymentsView pagination={pagination} onPaginationChange={onPaginationChange} />
      ) : search.view === 'attempts' ? (
        <OpenAttemptsView pagination={pagination} onPaginationChange={onPaginationChange} />
      ) : (
        <ReconView pagination={pagination} onPaginationChange={onPaginationChange} />
      )}
    </div>
  )
}

function PaymentsView({ pagination, onPaginationChange }: {
  pagination: PaginationState
  onPaginationChange: (u: Updater<PaginationState>) => void
}) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(paymentsQuery({ page: search.page, page_size: search.page_size, status: search.status }))

  const columns = payCol.columns([
    payCol.accessor('id', {
      header: 'Payment',
      cell: (i) => (
        <Link
          to="/payments/$paymentId"
          params={{ paymentId: String(i.getValue()) }}
          className="font-medium underline-offset-2 hover:underline"
        >
          #{i.getValue()}
        </Link>
      ),
    }),
    payCol.accessor('user_id', {
      header: 'Customer',
      cell: (i) => <span className="font-mono text-xs text-muted-foreground">{i.getValue()}</span>,
    }),
    payCol.accessor('status', {
      header: 'Status',
      cell: (i) => <Badge variant={payVariant(i.getValue())}>{i.getValue()}</Badge>,
    }),
    payCol.accessor('amount_minor', {
      header: 'Amount',
      cell: (i) => <span className="tabular-nums">{formatMinor(i.getValue(), i.row.original.currency)}</span>,
    }),
    payCol.accessor('payment_method', { header: 'Method' }),
    payCol.accessor('created_at', { header: 'Created' }),
  ])

  return (
    <div className="flex flex-col gap-3">
      <StatusChips
        options={PAYMENT_STATUSES}
        value={search.status}
        onChange={(status) => void navigate({ search: (prev) => ({ ...prev, status, page: 1 }) })}
      />
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowCount={query.data?.total_items}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={query.isPending}
        error={query.error instanceof ApiError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="No payments in this state."
      />
    </div>
  )
}

/**
 * The doubt worklist. Every row is a provider round-trip whose answer never
 * arrived, so the money effect may or may not have landed — the reconciler
 * resolves them, and this is the backlog it has not reached yet.
 */
function OpenAttemptsView({ pagination, onPaginationChange }: {
  pagination: PaginationState
  onPaginationChange: (u: Updater<PaginationState>) => void
}) {
  const search = Route.useSearch()
  const query = useQuery(openAttemptsQuery({ page: search.page, page_size: search.page_size }))

  const columns = attCol.columns([
    attCol.accessor('ID', { header: 'Attempt' }),
    attCol.accessor('PaymentID', {
      header: 'Payment',
      cell: (i) => (
        <Link
          to="/payments/$paymentId"
          params={{ paymentId: String(i.getValue()) }}
          className="font-medium underline-offset-2 hover:underline"
        >
          #{i.getValue()}
        </Link>
      ),
    }),
    attCol.accessor('Operation', { header: 'Operation' }),
    attCol.accessor('Outcome', {
      header: 'Outcome',
      cell: (i) => <Badge variant="destructive">{i.getValue()}</Badge>,
    }),
    attCol.accessor('ProviderRef', {
      header: 'Provider ref',
      cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span>,
    }),
  ])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Unresolved round-trips across all customers. Read-only: the reconciler
        settles them against the provider — nothing here moves money.
      </p>
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowCount={query.data?.total_items}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={query.isPending}
        error={query.error instanceof ApiError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="No unresolved attempts — every provider round-trip has an answer."
      />
    </div>
  )
}

function ReconView({ pagination, onPaginationChange }: {
  pagination: PaginationState
  onPaginationChange: (u: Updater<PaginationState>) => void
}) {
  const search = Route.useSearch()
  const query = useQuery(reconRunsQuery({ page: search.page, page_size: search.page_size }))

  const columns = runCol.columns([
    runCol.accessor('id', {
      header: 'Run',
      cell: (i) => (
        <Link
          to="/payments/runs/$runId"
          params={{ runId: String(i.getValue()) }}
          className="font-medium underline-offset-2 hover:underline"
        >
          #{i.getValue()}
        </Link>
      ),
    }),
    runCol.accessor('status', {
      header: 'Status',
      cell: (i) => <Badge variant={i.getValue() === 'failed' ? 'destructive' : 'secondary'}>{i.getValue()}</Badge>,
    }),
    runCol.accessor('transactions_scanned', {
      header: 'Scanned',
      cell: (i) => <span className="tabular-nums">{i.getValue()}</span>,
    }),
    runCol.accessor('discrepancies_found', {
      header: 'Discrepancies',
      cell: (i) => (
        <span className={cn('font-medium tabular-nums', i.getValue() > 0 && 'text-destructive')}>
          {i.getValue()}
        </span>
      ),
    }),
    runCol.accessor('started_at', { header: 'Started' }),
  ])

  return (
    <DataTable
      columns={columns}
      data={query.data?.items ?? []}
      rowCount={query.data?.total_items}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={query.isPending}
      error={query.error instanceof ApiError ? query.error : null}
      onRetry={() => void query.refetch()}
      emptyMessage="No reconciliation runs yet — the engine runs every 5 minutes."
    />
  )
}
