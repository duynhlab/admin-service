import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DetailHeader, DetailStates, Field, FieldGrid } from '@/components/detail'
import { getOrder } from '@/features/orders/api'
import type { OrderStatus } from '@/features/orders/api'
import { ResolveDialog } from '@/features/orders/order-dialogs'
import { ordersKeys } from '@/features/orders/queries'
import { StatusTimeline } from '@/features/orders/status-timeline'
import { ExternalTruths } from '@/features/orders/external-truths'
import { formatMinor } from '@/lib/format'

/**
 * The operator case view. Beyond the order itself it carries the three external
 * truths (payment, reservation, shipment) and the transition history, because
 * the decision this page can lead to — resolving out of `manual_review` — is
 * one the service cannot verify (ADR-051). Everything an operator needs to
 * check has to be here, or they will check nothing.
 */

export const Route = createFileRoute('/_authenticated/orders_/$orderId')({
  component: OrderCasePage,
})

const orderQuery = (id: string) =>
  queryOptions({
    queryKey: [...ordersKeys.all, 'detail', id] as const,
    queryFn: ({ signal }) => getOrder(id, signal),
  })

const statusVariant = (s: OrderStatus) =>
  s === 'manual_review' || s === 'cancelling' ? 'destructive'
  : s === 'completed' || s === 'confirmed' ? 'secondary' : 'outline'

function OrderCasePage() {
  const { orderId } = Route.useParams()
  const query = useQuery(orderQuery(orderId))
  const order = query.data
  const [resolving, setResolving] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/orders"
        backLabel="Orders"
        title={`Order #${orderId}`}
        badge={order && <Badge variant={statusVariant(order.status)}>{order.status}</Badge>}
        actions={
          order?.status === 'manual_review' && (
            <Button variant="destructive" onClick={() => setResolving(true)}>
              Resolve
            </Button>
          )
        }
      />
      <DetailStates
        isPending={query.isPending}
        error={query.error}
        notFoundMessage="No order with this id — it may never have existed."
      >
        {order && (
          <>
            <FieldGrid>
              <Field label="Customer">
                <Link
                  to="/customers/$userId"
                  params={{ userId: order.user_id }}
                  className="font-mono text-xs underline-offset-2 hover:underline"
                >
                  {order.user_id}
                </Link>
              </Field>
              <Field label="Created">{order.created_at}</Field>
              <Field label="Subtotal"><span className="tabular-nums">{formatMinor(order.subtotal)}</span></Field>
              <Field label="Shipping"><span className="tabular-nums">{formatMinor(order.shipping)}</span></Field>
              <Field label="Tax"><span className="tabular-nums">{formatMinor(order.tax)}</span></Field>
              <Field label="Discount"><span className="tabular-nums">{formatMinor(order.discount)}</span></Field>
              <Field label="Total"><span className="font-medium tabular-nums">{formatMinor(order.total)}</span></Field>
            </FieldGrid>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Items</h2>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.items ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          The order service returned no line items for this order.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (order.items ?? []).map((it) => (
                        <TableRow key={it.product_id}>
                          <TableCell className="font-mono text-xs">{it.product_id}</TableCell>
                          <TableCell>{it.product_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMinor(it.price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMinor(it.subtotal)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <ExternalTruths order={order} />

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Transition history</h2>
              <p className="text-xs text-muted-foreground">
                Every status change, newest first. order-service writes each row in the
                same transaction as the change, so this is the record — not a log that
                could be missing one.
              </p>
              <div className="rounded-xl border bg-card px-4">
                {order.degraded?.includes('status_history') ? (
                  <p className="py-4 text-sm text-destructive">
                    The history could not be read. Do not read this as "nothing
                    happened" — reload before deciding.
                  </p>
                ) : (
                  <StatusTimeline rows={order.status_history} />
                )}
              </div>
            </section>
          </>
        )}
      </DetailStates>

      {order && resolving && (
        <ResolveDialog order={order} onClose={() => setResolving(false)} />
      )}
    </div>
  )
}
