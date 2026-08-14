import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { DataTable, dataTableFeatures } from '@/components/data-table'
import { listShipments, SHIPMENT_STATUSES } from '@/features/shipments/api'
import type { Shipment, ShipmentStatus } from '@/features/shipments/api'
import { ApiError } from '@/lib/api'
import { StatusChips } from '@/lib/format'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce.number().int().min(1).max(100).catch(20),
  status: z.enum(SHIPMENT_STATUSES).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/shipments')({
  validateSearch: searchSchema,
  component: ShipmentsPage,
})

const col = createColumnHelper<typeof dataTableFeatures, Shipment>()

export const shipmentsQuery = (q: { page: number; page_size: number; status?: ShipmentStatus }) =>
  queryOptions({ queryKey: ['shipments', 'list', q] as const, queryFn: ({ signal }) => listShipments(q, signal) })

function ShipmentsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(shipmentsQuery(search))

  const pagination: PaginationState = { pageIndex: search.page - 1, pageSize: search.page_size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    const next = typeof u === 'function' ? u(pagination) : u
    void navigate({ search: (prev) => ({ ...prev, page: next.pageIndex + 1, page_size: next.pageSize }) })
  }

  const columns = col.columns([
    col.accessor('id', { header: 'Shipment' }),
    col.accessor('order_id', { header: 'Order' }),
    col.accessor('tracking_number', {
      header: 'Tracking',
      cell: (i) => <span className="font-mono text-[13px]">{i.getValue()}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      // As-built vocabulary: code writes pending/cancelled; in_transit and
      // delivered exist only in dev seeds (no FSM — RFC-0023 non-goal).
      cell: (i) => (
        <Badge variant={i.getValue() === 'cancelled' ? 'destructive' : 'secondary'}>{i.getValue()}</Badge>
      ),
    }),
    col.accessor('created_at', { header: 'Created', cell: (i) => i.getValue() ?? '—' }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Shipments</h1>
      <StatusChips
        options={SHIPMENT_STATUSES}
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
        emptyMessage="No shipments in this state."
      />
    </div>
  )
}
