import {
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { PaginationState, Updater } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ApiError } from '@/lib/api'

/**
 * The portal's one table convention (ADR-049): server-driven pagination only
 * (`manualPagination` + server `rowCount`), with owned loading / empty /
 * error states so every list screen behaves identically. Domain pages own
 * their columns; pagination state lives in the URL via the route's
 * `validateSearch`, never in component state.
 */
export const dataTableFeatures = tableFeatures({ rowPaginationFeature })

interface DataTableProps<TData extends object> {
  // Column defs are built per-page with createColumnHelper(dataTableFeatures);
  // their precise generic shape stays with the caller.
  columns: Array<never> | Array<object>
  data: Array<TData>
  /** Server-reported total (`total_items`); drives the page count. */
  rowCount: number | undefined
  pagination: PaginationState
  onPaginationChange: (updater: Updater<PaginationState>) => void
  isLoading?: boolean
  error?: ApiError | null
  onRetry?: () => void
  emptyMessage?: string
}

export function DataTable<TData extends object>({
  columns,
  data,
  rowCount,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  onRetry,
  emptyMessage = 'Nothing here yet.',
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column
    // defs are typed at the call site via createColumnHelper(dataTableFeatures)
    columns: columns as any,
    data,
    manualPagination: true,
    rowCount,
    state: { pagination },
    onPaginationChange,
  })

  const columnCount = table.getAllLeafColumns().length

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pagination.pageSize > 5 ? 5 : pagination.pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columnCount}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <p className="text-sm font-medium">Could not load this list</p>
                    <p className="text-sm text-muted-foreground">
                      {error.message} <span className="font-mono text-xs">({error.code})</span>
                    </p>
                    {onRetry ? (
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {rowCount !== undefined ? `${rowCount.toLocaleString()} total` : ' '}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {pagination.pageIndex + 1}
            {rowCount !== undefined ? ` of ${Math.max(1, table.getPageCount())}` : ''}
          </span>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage() || isLoading}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Next page"
            disabled={!table.getCanNextPage() || isLoading}
            onClick={() => table.nextPage()}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
