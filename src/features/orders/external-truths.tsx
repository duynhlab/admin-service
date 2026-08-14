import { Badge } from '@/components/ui/badge'
import type { OrderCase } from '@/features/orders/api'

/**
 * The three truths that live outside order-service — the payment, the stock
 * reservation, the shipment — plus where the saga stopped.
 *
 * These are here because the resolve command cannot check them (ADR-051): the
 * service records what a human decided, so the human has to be able to see what
 * they are deciding about without leaving the page.
 *
 * Absence and failure are rendered differently, and that difference is the whole
 * point. "No shipment was ever created" is a fact an operator can act on;
 * "shipping did not answer" means they know nothing yet and must not treat the
 * blank as an answer. The service marks the second case in `degraded`.
 */

function Card({
  title,
  degraded,
  children,
}: {
  title: string
  degraded: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {degraded && (
          <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
            unavailable
          </Badge>
        )}
      </div>
      {degraded ? (
        <p className="text-sm text-muted-foreground">
          The service did not answer. This is not "nothing to settle" — check again
          before deciding.
        </p>
      ) : (
        children
      )}
    </div>
  )
}

const money = (n: number, currency: string) =>
  `${n.toFixed(2)} ${currency.toUpperCase()}`

export function ExternalTruths({ order }: { order: OrderCase }) {
  const degraded = new Set(order.degraded ?? [])

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Outside this service</h2>
      <p className="text-xs text-muted-foreground">
        Read from payment, inventory and shipping when this page loaded. Settle what
        is unaccounted for before recording a decision.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Payment" degraded={degraded.has('payment')}>
          {order.payment ? (
            <dl className="flex flex-col gap-0.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{order.payment.status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Charged</dt>
                <dd className="tabular-nums">
                  {money(order.payment.amount, order.payment.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Refunded</dt>
                <dd className="tabular-nums">
                  {money(order.payment.refunded ?? 0, order.payment.currency)}
                </dd>
              </div>
              {order.payment.decline_code && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Decline</dt>
                  <dd className="font-mono text-xs">{order.payment.decline_code}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No payment for this order.</p>
          )}
        </Card>

        <Card title="Reservation" degraded={degraded.has('inventory')}>
          {order.inventory ? (
            <p className="text-sm font-medium">{order.inventory.status}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No reservation — normal for an order whose stock the product path owns.
            </p>
          )}
        </Card>

        <Card title="Shipment" degraded={degraded.has('shipment')}>
          {order.shipment ? (
            <dl className="flex flex-col gap-0.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{order.shipment.status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Tracking</dt>
                <dd className="font-mono text-xs">{order.shipment.tracking_number}</dd>
              </div>
              {order.shipment.carrier && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Carrier</dt>
                  <dd>{order.shipment.carrier}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No shipment was created.</p>
          )}
        </Card>

        <Card title="Where it stopped" degraded={degraded.has('processing')}>
          {order.processing ? (
            <dl className="flex flex-col gap-0.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="font-medium">{order.processing.stage}</dd>
              </div>
              {order.processing.last_step && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Last step</dt>
                  <dd className="font-mono text-xs">{order.processing.last_step}</dd>
                </div>
              )}
              {order.processing.last_error_code && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Error</dt>
                  <dd className="font-mono text-xs">{order.processing.last_error_code}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No projection row — the order predates it, or never entered the saga.
            </p>
          )}
        </Card>
      </div>
    </section>
  )
}
