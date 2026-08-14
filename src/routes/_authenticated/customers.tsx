import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, dataTableFeatures } from '@/components/data-table'
import { searchCustomers } from '@/features/customers/api'
import type { CustomerRow } from '@/features/customers/api'
import { ApiError } from '@/lib/api'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce.number().int().min(1).max(100).catch(20),
  query: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/customers')({
  validateSearch: searchSchema,
  component: CustomersPage,
})

const col = createColumnHelper<typeof dataTableFeatures, CustomerRow>()

export const customersQuery = (q: { page: number; page_size: number; query?: string }) =>
  queryOptions({ queryKey: ['customers', 'search', q] as const, queryFn: ({ signal }) => searchCustomers(q, signal) })

function CustomersPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const query = useQuery(customersQuery(search))
  const [draft, setDraft] = useState(search.query ?? '')

  const pagination: PaginationState = { pageIndex: search.page - 1, pageSize: search.page_size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    const next = typeof u === 'function' ? u(pagination) : u
    void navigate({ search: (prev) => ({ ...prev, page: next.pageIndex + 1, page_size: next.pageSize }) })
  }

  const columns = col.columns([
    col.accessor('user_id', {
      header: 'Subject',
      cell: (i) => (
        <Link
          to="/customers/$userId"
          params={{ userId: i.getValue() }}
          className="font-mono text-xs underline-offset-2 hover:underline"
        >
          {i.getValue()}
        </Link>
      ),
    }),
    col.accessor('name', { header: 'Name', cell: (i) => i.getValue() || '—' }),
    col.accessor('phone', { header: 'Phone', cell: (i) => i.getValue() || '—' }),
    col.accessor('created_at', { header: 'Since' }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Search by name, phone, or exact subject — identity claims (email, username)
          live in Keycloak, not here.
        </p>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void navigate({ search: (prev) => ({ ...prev, query: draft || undefined, page: 1 }) })
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search name, phone, or user id…"
          aria-label="Search customers"
          className="h-8 w-72"
        />
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowCount={query.data?.total_items}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={query.isPending}
        error={query.error instanceof ApiError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="No customers match this search."
      />
    </div>
  )
}
