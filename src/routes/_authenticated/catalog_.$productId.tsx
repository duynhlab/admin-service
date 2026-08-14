import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DetailHeader, DetailStates, Field, FieldGrid } from '@/components/detail'
import { getCatalogProduct, listProductAudit } from '@/features/catalog/api'
import type { ProductStatus } from '@/features/catalog/api'
import { AuditTimeline } from '@/features/catalog/audit-timeline'
import { catalogKeys } from '@/features/catalog/queries'
import { ApiError } from '@/lib/api'

/**
 * Product case view: the row as it is now, and every privileged change that got
 * it there. The audit read is its own query so the record loads (and fails)
 * independently of the product — a product that renders with an unavailable
 * history is more useful than a blank page, and an empty history must never be
 * mistaken for "nothing ever changed" (ADR-048).
 */

export const Route = createFileRoute('/_authenticated/catalog_/$productId')({
  component: ProductCasePage,
})

const productQuery = (id: string) =>
  queryOptions({
    queryKey: [...catalogKeys.all, 'product', id] as const,
    queryFn: ({ signal }) => getCatalogProduct(id, signal),
  })

const auditQuery = (id: string) =>
  queryOptions({
    queryKey: [...catalogKeys.all, 'audit', id] as const,
    queryFn: ({ signal }) => listProductAudit(id, signal),
  })

const statusVariant = (s: ProductStatus) =>
  s === 'ARCHIVED' ? 'destructive' : s === 'ACTIVE' ? 'secondary' : 'outline'

function ProductCasePage() {
  const { productId } = Route.useParams()
  const product = useQuery(productQuery(productId))
  const audit = useQuery(auditQuery(productId))

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/catalog"
        backLabel="Catalog"
        title={product.data?.name ?? `Product #${productId}`}
        badge={
          product.data && (
            <Badge variant={statusVariant(product.data.status)}>{product.data.status}</Badge>
          )
        }
      />
      <DetailStates
        isPending={product.isPending}
        error={product.error}
        notFoundMessage="No product with this id."
      >
        {product.data && (
          <FieldGrid>
            <Field label="ID">
              <span className="font-mono text-xs">{product.data.id}</span>
            </Field>
            <Field label="Price">
              <span className="tabular-nums">${product.data.price.toFixed(2)}</span>
            </Field>
            <Field label="Category">{product.data.category || '—'}</Field>
            <Field label="Version">
              <span className="tabular-nums">{product.data.version}</span>
            </Field>
            <Field label="Description">{product.data.description || '—'}</Field>
          </FieldGrid>
        )}
      </DetailStates>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Change history</h2>
        <p className="text-xs text-muted-foreground">
          Every privileged change, newest first, with the operator who made it — the
          actor comes from the verified token, never from the request.
        </p>
        <div className="rounded-xl border bg-card px-4">
          {audit.isPending ? (
            <div className="flex flex-col gap-2 py-4" aria-busy>
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-56" />
            </div>
          ) : audit.isError ? (
            <p className="py-4 text-sm text-destructive">
              {audit.error instanceof ApiError
                ? `The history could not be read (${audit.error.code}) — the product above is still current.`
                : 'The history could not be read — the product above is still current.'}
            </p>
          ) : (
            <AuditTimeline rows={audit.data.items} />
          )}
        </div>
      </section>
    </div>
  )
}
