import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { DataTable, dataTableFeatures } from '@/components/data-table'
import { listOrders, ORDER_STATUSES } from '@/features/orders/api'
import type { Order, OrderStatus } from '@/features/orders/api'
import { ApiError } from '@/lib/api'
import { formatMinor, StatusChips } from '@/lib/format'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce.number().int().min(1).max(100).catch(20),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/orders')({
  validateSearch: searchSchema,
  component: OrdersPage,
})

export const ordersQuery = (q: { page: number; page_size: number; status?: OrderStatus }) =>
  queryOptions({
    queryKey: ['orders', 'list', q] as const,
    queryFn: ({ signal }) => listOrders(q, signal),
  })

const col = createColumnHelper<typeof dataTableFeatures, Order>()

// Attention states carry the destructive tone; terminal good states stay quiet.
const statusVariant = (s: OrderStatus) =>
  s === 'manual_review' || s === 'cancelling' ? 'destructive'
  : s === 'completed' || s === 'confirmed' ? 'secondary' : 'outline'

function OrdersPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(ordersQuery(search))

  const pagination: PaginationState = { pageIndex: search.page - 1, pageSize: search.page_size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    const next = typeof u === 'function' ? u(pagination) : u
    void navigate({ search: (prev) => ({ ...prev, page: next.pageIndex + 1, page_size: next.pageSize }) })
  }

  const columns = col.columns([
    col.accessor('id', { header: 'Order' }),
    col.accessor('user_id', {
      header: 'Customer',
      cell: (i) => <span className="font-mono text-xs text-muted-foreground">{i.getValue()}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (i) => <Badge variant={statusVariant(i.getValue())}>{i.getValue()}</Badge>,
    }),
    col.accessor('total', {
      header: 'Total',
      cell: (i) => <span className="tabular-nums">{formatMinor(i.getValue())}</span>,
    }),
    col.accessor('created_at', { header: 'Created' }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
      <StatusChips
        options={ORDER_STATUSES}
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
        emptyMessage="No orders in this state."
      />
    </div>
  )
}
