import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DetailHeader, DetailStates, Field, FieldGrid } from '@/components/detail'
import { getPaymentCase } from '@/features/payments/api'
import type { PaymentStatus } from '@/features/payments/api'
import { formatMinor } from '@/lib/format'

export const Route = createFileRoute('/_authenticated/payments_/$paymentId')({
  component: PaymentCasePage,
})

const caseQuery = (id: number) =>
  queryOptions({
    queryKey: ['payments', 'case', id] as const,
    queryFn: ({ signal }) => getPaymentCase(id, signal),
  })

const statusVariant = (s: PaymentStatus) =>
  s === 'failed' || s === 'expired' ? 'destructive'
  : s === 'captured' || s === 'refunded' ? 'secondary' : 'outline'

function PaymentCasePage() {
  const { paymentId } = Route.useParams()
  const query = useQuery(caseQuery(Number(paymentId)))
  const data = query.data
  const payment = data?.payment

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/payments"
        backLabel="Payments"
        title={`Payment #${paymentId}`}
        badge={payment && <Badge variant={statusVariant(payment.status)}>{payment.status}</Badge>}
      />
      <DetailStates
        isPending={query.isPending}
        error={query.error}
        notFoundMessage="No payment with this id."
      >
        {payment && (
          <>
            <FieldGrid>
              <Field label="Amount">
                <span className="font-medium tabular-nums">
                  {formatMinor(payment.amount_minor, payment.currency)}
                </span>
              </Field>
              <Field label="Customer">
                <Link
                  to="/customers/$userId"
                  params={{ userId: payment.user_id }}
                  className="font-mono text-xs underline-offset-2 hover:underline"
                >
                  {payment.user_id}
                </Link>
              </Field>
              <Field label="Order">
                {payment.order_id ? (
                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: String(payment.order_id) }}
                    className="underline-offset-2 hover:underline"
                  >
                    #{payment.order_id}
                  </Link>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Method">{payment.payment_method}</Field>
              <Field label="Capture">{payment.capture_method}</Field>
              <Field label="Provider ref">{payment.provider_payment_id || '—'}</Field>
              <Field label="Decline code">{payment.decline_code || '—'}</Field>
              <Field label="Created">{payment.created_at}</Field>
            </FieldGrid>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Attempts</h2>
              <p className="text-xs text-muted-foreground">
                Every provider round-trip, oldest first — an UNKNOWN outcome is an
                unresolved round-trip the reconciler still owns.
              </p>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Provider ref</TableHead>
                      <TableHead>Provider status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.attempts ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No attempts recorded for this payment.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data.attempts ?? []).map((a) => (
                        <TableRow key={a.ID}>
                          <TableCell className="tabular-nums">{a.ID}</TableCell>
                          <TableCell>{a.Operation}</TableCell>
                          <TableCell>
                            <Badge variant={a.Outcome === 'unknown' ? 'destructive' : 'secondary'}>
                              {a.Outcome}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{a.ProviderRef || '—'}</TableCell>
                          <TableCell>{a.ProviderStatus || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Ledger</h2>
              <p className="text-xs text-muted-foreground">
                Append-only money lineage — one row per balanced transaction.
              </p>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>External ref</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ledger.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No ledger transactions yet — nothing has been captured or refunded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.ledger.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="tabular-nums">{t.id}</TableCell>
                          <TableCell>{t.kind}</TableCell>
                          <TableCell className="font-mono text-xs">{t.external_ref || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinor(t.amount_minor, payment.currency)}
                          </TableCell>
                          <TableCell>{t.created_at}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </DetailStates>
    </div>
  )
}
