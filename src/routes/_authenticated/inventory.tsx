import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, dataTableFeatures } from '@/components/data-table'
import type { Balance, Movement, Reservation } from '@/features/inventory/api'
import {
  balancesQuery,
  movementsQuery,
  reservationsQuery,
} from '@/features/inventory/queries'
import {
  AdjustStockDialog,
  ReceiveStockDialog,
} from '@/features/inventory/stock-command-dialogs'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Inventory (RFC-0023 slice A): balances with the low-stock worklist and the
 * receive/adjust commands, the movement ledger, and reservation headers.
 * List state lives in the URL (one authority per state type, ADR-049).
 */

const searchSchema = z.object({
  view: z.enum(['balances', 'movements', 'reservations']).catch('balances'),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce.number().int().min(1).max(100).catch(20),
  sku_id: z.string().optional().catch(undefined),
  low_stock: z.coerce.boolean().optional().catch(undefined),
  status: z
    .enum(['reserved', 'committed', 'released', 'expired'])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_authenticated/inventory')({
  validateSearch: searchSchema,
  component: InventoryPage,
})

const balanceColumns = createColumnHelper<typeof dataTableFeatures, Balance>()
const movementColumns = createColumnHelper<typeof dataTableFeatures, Movement>()
const reservationColumns = createColumnHelper<
  typeof dataTableFeatures,
  Reservation
>()

function InventoryPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const pagination: PaginationState = {
    pageIndex: search.page - 1,
    pageSize: search.page_size,
  }
  const onPaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    void navigate({
      search: (prev) => ({
        ...prev,
        page: next.pageIndex + 1,
        page_size: next.pageSize,
      }),
    })
  }

  const setView = (view: (typeof searchSchema.shape.view)['_output']) =>
    void navigate({ search: (prev) => ({ ...prev, view, page: 1 }) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Inventory views">
        {(['balances', 'movements', 'reservations'] as const).map((view) => (
          <button
            key={view}
            role="tab"
            aria-selected={search.view === view}
            onClick={() => setView(view)}
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

      {search.view === 'balances' ? (
        <BalancesView
          pagination={pagination}
          onPaginationChange={onPaginationChange}
        />
      ) : search.view === 'movements' ? (
        <MovementsView
          pagination={pagination}
          onPaginationChange={onPaginationChange}
        />
      ) : (
        <ReservationsView
          pagination={pagination}
          onPaginationChange={onPaginationChange}
        />
      )}
    </div>
  )
}

interface ViewProps {
  pagination: PaginationState
  onPaginationChange: (u: Updater<PaginationState>) => void
}

function useSkuFilterBox() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [draft, setDraft] = useState(search.sku_id ?? '')
  const apply = () =>
    void navigate({
      search: (prev) => ({ ...prev, sku_id: draft || undefined, page: 1 }),
    })
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Filter by SKU…"
        aria-label="Filter by SKU"
        className="h-8 w-44"
      />
      <Button type="submit" variant="outline" size="sm">
        Filter
      </Button>
    </form>
  )
}

function BalancesView({ pagination, onPaginationChange }: ViewProps) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(
    balancesQuery({
      page: search.page,
      page_size: search.page_size,
      sku_id: search.sku_id,
      low_stock: search.low_stock,
    }),
  )
  const [receiveFor, setReceiveFor] = useState<Balance | null>(null)
  const [adjustFor, setAdjustFor] = useState<Balance | null>(null)
  const skuFilter = useSkuFilterBox()

  const columns = balanceColumns.columns([
    balanceColumns.accessor('sku_id', {
      header: 'SKU',
      cell: (info) => <span className="font-mono text-[13px]">{info.getValue()}</span>,
    }),
    balanceColumns.accessor('warehouse_id', { header: 'Warehouse' }),
    balanceColumns.accessor('on_hand', {
      header: 'On hand',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    balanceColumns.accessor('reserved', {
      header: 'Reserved',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    balanceColumns.accessor('safety_stock', {
      header: 'Safety',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    balanceColumns.accessor('atp', {
      header: 'ATP',
      cell: (info) => {
        const row = info.row.original
        const low = row.atp <= row.safety_stock
        return (
          <span className={cn('font-medium tabular-nums', low && 'text-destructive')}>
            {info.getValue()}
            {low ? <Badge variant="destructive" className="ml-2">low</Badge> : null}
          </span>
        )
      },
    }),
    balanceColumns.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <span className="flex justify-end gap-1">
          <Button variant="outline" size="xs" onClick={() => setReceiveFor(row.original)}>
            Receive
          </Button>
          <Button variant="outline" size="xs" onClick={() => setAdjustFor(row.original)}>
            Adjust
          </Button>
        </span>
      ),
    }),
  ])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {skuFilter}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!search.low_stock}
            onChange={(e) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  low_stock: e.target.checked || undefined,
                  page: 1,
                }),
              })
            }
          />
          Low stock only (ATP ≤ safety)
        </label>
      </div>
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowCount={query.data?.total_items}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={query.isPending}
        error={query.error instanceof ApiError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="No balance rows match this filter."
      />
      {receiveFor ? (
        <ReceiveStockDialog balance={receiveFor} onClose={() => setReceiveFor(null)} />
      ) : null}
      {adjustFor ? (
        <AdjustStockDialog balance={adjustFor} onClose={() => setAdjustFor(null)} />
      ) : null}
    </div>
  )
}

function MovementsView({ pagination, onPaginationChange }: ViewProps) {
  const search = Route.useSearch()
  const query = useQuery(
    movementsQuery({
      page: search.page,
      page_size: search.page_size,
      sku_id: search.sku_id,
    }),
  )
  const skuFilter = useSkuFilterBox()

  const columns = movementColumns.columns([
    movementColumns.accessor('created_at', { header: 'At' }),
    movementColumns.accessor('type', {
      header: 'Type',
      cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
    }),
    movementColumns.accessor('sku_id', {
      header: 'SKU',
      cell: (info) => <span className="font-mono text-[13px]">{info.getValue()}</span>,
    }),
    movementColumns.accessor('on_hand_delta', {
      header: 'Δ on hand',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    movementColumns.accessor('reserved_delta', {
      header: 'Δ reserved',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    movementColumns.accessor('reason', { header: 'Reason' }),
    movementColumns.accessor('actor', {
      header: 'Actor',
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue() || '—'}
        </span>
      ),
    }),
  ])

  return (
    <div className="flex flex-col gap-3">
      {skuFilter}
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowCount={query.data?.total_items}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={query.isPending}
        error={query.error instanceof ApiError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="The ledger has no rows for this filter."
      />
    </div>
  )
}

const statusVariant: Record<Reservation['status'], 'default' | 'secondary' | 'outline'> = {
  reserved: 'default',
  committed: 'secondary',
  released: 'outline',
  expired: 'outline',
}

function ReservationsView({ pagination, onPaginationChange }: ViewProps) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(
    reservationsQuery({
      page: search.page,
      page_size: search.page_size,
      status: search.status,
    }),
  )

  const columns = reservationColumns.columns([
    reservationColumns.accessor('id', {
      header: 'Reservation',
      cell: (info) => <span className="font-mono text-[13px]">{info.getValue()}</span>,
    }),
    reservationColumns.accessor('order_id', {
      header: 'Order',
      cell: (info) => <span className="font-mono text-[13px]">{info.getValue()}</span>,
    }),
    reservationColumns.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <Badge variant={statusVariant[info.getValue()]}>{info.getValue()}</Badge>
      ),
    }),
    reservationColumns.accessor('created_at', { header: 'Created' }),
    reservationColumns.accessor('expires_at', {
      header: 'Expires',
      cell: (info) => info.getValue() || '—',
    }),
  ])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status filter">
        {([undefined, 'reserved', 'committed', 'released', 'expired'] as const).map(
          (status) => (
            <button
              key={status ?? 'all'}
              onClick={() =>
                void navigate({
                  search: (prev) => ({ ...prev, status, page: 1 }),
                })
              }
              className={cn(
                'rounded-md px-2.5 py-1 text-[13px] font-medium capitalize transition-colors',
                search.status === status
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {status ?? 'all'}
            </button>
          ),
        )}
      </div>
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowCount={query.data?.total_items}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={query.isPending}
        error={query.error instanceof ApiError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="No reservations in this state."
      />
    </div>
  )
}
