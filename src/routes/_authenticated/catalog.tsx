import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, dataTableFeatures } from '@/components/data-table'
import {
  CategoryFormDialog,
  ProductFormDialog,
  TransitionDialog,
} from '@/features/catalog/catalog-dialogs'
import { catalogKeys } from '@/features/catalog/queries'
import {
  PRODUCT_STATUSES,
  listCategories,
  listCatalogProducts,
} from '@/features/catalog/api'
import type { CatalogProduct, Category, LifecycleAction, ProductStatus } from '@/features/catalog/api'
import { ApiError } from '@/lib/api'
import { StatusChips } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Catalog (RFC-0023 slice B) — the portal's only write-heavy screen. Products
 * carry a lifecycle, so the table's job is to make the current state obvious and
 * offer only the transitions that state allows; the service refuses the rest
 * anyway, but an operator should not have to discover that by being told no.
 */

const searchSchema = z.object({
  view: z.enum(['products', 'categories']).catch('products'),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce.number().int().min(1).max(100).catch(20),
  status: z.enum(PRODUCT_STATUSES).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/catalog')({
  validateSearch: searchSchema,
  component: CatalogPage,
})

const productsQuery = (q: { page: number; page_size: number; status?: ProductStatus }) =>
  queryOptions({
    queryKey: [...catalogKeys.all, 'products', q] as const,
    queryFn: ({ signal }) => listCatalogProducts(q, signal),
  })

const categoriesQuery = (q: { page: number; page_size: number }) =>
  queryOptions({
    queryKey: [...catalogKeys.all, 'categories', q] as const,
    queryFn: ({ signal }) => listCategories(q, signal),
  })

const prodCol = createColumnHelper<typeof dataTableFeatures, CatalogProduct>()
const catCol = createColumnHelper<typeof dataTableFeatures, Category>()

const statusVariant = (s: ProductStatus) =>
  s === 'ARCHIVED' ? 'destructive' : s === 'ACTIVE' ? 'secondary' : 'outline'

/** The transitions the lifecycle actually allows from a given state. */
function availableActions(status: ProductStatus): LifecycleAction[] {
  switch (status) {
    case 'DRAFT':
      return ['publish', 'archive']
    case 'ACTIVE':
      return ['archive']
    case 'ARCHIVED':
      return ['restore']
  }
}

function CatalogPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const pagination: PaginationState = { pageIndex: search.page - 1, pageSize: search.page_size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    const next = typeof u === 'function' ? u(pagination) : u
    void navigate({ search: (prev) => ({ ...prev, page: next.pageIndex + 1, page_size: next.pageSize }) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Products move DRAFT → ACTIVE → ARCHIVED by command; every change is recorded with your
          operator identity.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Catalog views">
        {(['products', 'categories'] as const).map((view) => (
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
      {search.view === 'products' ? (
        <ProductsView pagination={pagination} onPaginationChange={onPaginationChange} />
      ) : (
        <CategoriesView pagination={pagination} onPaginationChange={onPaginationChange} />
      )}
    </div>
  )
}

function ProductsView({ pagination, onPaginationChange }: {
  pagination: PaginationState
  onPaginationChange: (u: Updater<PaginationState>) => void
}) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(productsQuery({ page: search.page, page_size: search.page_size, status: search.status }))

  const [formFor, setFormFor] = useState<CatalogProduct | 'new' | null>(null)
  const [transition, setTransition] = useState<{ product: CatalogProduct; action: LifecycleAction } | null>(null)

  const columns = prodCol.columns([
    prodCol.accessor('id', {
      header: 'ID',
      cell: (i) => (
        <Link
          to="/catalog/$productId"
          params={{ productId: i.getValue() }}
          className="font-medium underline-offset-2 hover:underline"
        >
          #{i.getValue()}
        </Link>
      ),
    }),
    prodCol.accessor('name', { header: 'Name' }),
    prodCol.accessor('status', {
      header: 'Status',
      cell: (i) => <Badge variant={statusVariant(i.getValue())}>{i.getValue()}</Badge>,
    }),
    prodCol.accessor('price', {
      header: 'Price',
      cell: (i) => <span className="tabular-nums">${i.getValue().toFixed(2)}</span>,
    }),
    prodCol.accessor('category', { header: 'Category', cell: (i) => i.getValue() || '—' }),
    prodCol.accessor('version', {
      header: 'Ver',
      cell: (i) => <span className="tabular-nums text-muted-foreground">{i.getValue()}</span>,
    }),
    prodCol.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="xs" onClick={() => setFormFor(row.original)}>
            Edit
          </Button>
          {availableActions(row.original.status).map((action) => (
            <Button
              key={action}
              variant={action === 'archive' ? 'destructive' : 'outline'}
              size="xs"
              className="capitalize"
              onClick={() => setTransition({ product: row.original, action })}
            >
              {action}
            </Button>
          ))}
        </div>
      ),
    }),
  ])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusChips
          options={PRODUCT_STATUSES}
          value={search.status}
          onChange={(status) => void navigate({ search: (prev) => ({ ...prev, status, page: 1 }) })}
        />
        <Button size="sm" onClick={() => setFormFor('new')}>
          New product
        </Button>
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
        emptyMessage="No products in this state."
      />
      <ProductFormDialog product={formFor} onClose={() => setFormFor(null)} />
      <TransitionDialog
        product={transition?.product ?? null}
        action={transition?.action ?? 'publish'}
        onClose={() => setTransition(null)}
      />
    </div>
  )
}

function CategoriesView({ pagination, onPaginationChange }: {
  pagination: PaginationState
  onPaginationChange: (u: Updater<PaginationState>) => void
}) {
  const search = Route.useSearch()
  const query = useQuery(categoriesQuery({ page: search.page, page_size: search.page_size }))
  const [formFor, setFormFor] = useState<Category | 'new' | null>(null)

  const columns = catCol.columns([
    catCol.accessor('id', { header: 'ID' }),
    catCol.accessor('name', { header: 'Name' }),
    catCol.accessor('description', { header: 'Description', cell: (i) => i.getValue() || '—' }),
    catCol.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="outline" size="xs" onClick={() => setFormFor(row.original)}>
          Rename
        </Button>
      ),
    }),
  ])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setFormFor('new')}>
          New category
        </Button>
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
        emptyMessage="No categories yet."
      />
      <CategoryFormDialog category={formFor} onClose={() => setFormFor(null)} />
    </div>
  )
}
