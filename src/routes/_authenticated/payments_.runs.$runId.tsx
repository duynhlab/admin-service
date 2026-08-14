import { createFileRoute } from '@tanstack/react-router'
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
import { getReconRun } from '@/features/payments/api'
import { formatMinor } from '@/lib/format'

export const Route = createFileRoute('/_authenticated/payments_/runs/$runId')({
  component: ReconRunPage,
})

const runQuery = (id: number) =>
  queryOptions({
    queryKey: ['payments', 'recon-run', id] as const,
    queryFn: ({ signal }) => getReconRun(id, signal),
  })

function ReconRunPage() {
  const { runId } = Route.useParams()
  const query = useQuery(runQuery(Number(runId)))
  const data = query.data
  const run = data?.run

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/payments"
        backLabel="Payments"
        title={`Reconciliation run #${runId}`}
        badge={
          run && (
            <Badge variant={run.discrepancies_found > 0 ? 'destructive' : 'secondary'}>
              {run.status}
            </Badge>
          )
        }
      />
      <DetailStates
        isPending={query.isPending}
        error={query.error}
        notFoundMessage="No reconciliation run with this id."
      >
        {run && (
          <>
            <FieldGrid>
              <Field label="Scanned"><span className="tabular-nums">{run.transactions_scanned}</span></Field>
              <Field label="Discrepancies">
                <span className={run.discrepancies_found > 0 ? 'font-medium text-destructive tabular-nums' : 'tabular-nums'}>
                  {run.discrepancies_found}
                </span>
              </Field>
              <Field label="Started">{run.started_at}</Field>
              <Field label="Finished">{run.finished_at ?? 'running'}</Field>
            </FieldGrid>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Discrepancies</h2>
              <p className="text-xs text-muted-foreground">
                Detect-only: each row is a provider/ledger mismatch for a human to
                triage — nothing here mutates money.
              </p>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Provider payment</TableHead>
                      <TableHead className="text-right">Internal</TableHead>
                      <TableHead className="text-right">Provider</TableHead>
                      <TableHead>Statuses</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.discrepancies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Clean run — nothing to triage.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.discrepancies.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Badge variant="destructive">{d.class}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{d.provider_payment_id}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinor(d.internal_amount_minor)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinor(d.provider_amount_minor)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {d.internal_status || '—'} / {d.provider_status || '—'}
                          </TableCell>
                          <TableCell className="max-w-64 text-xs text-muted-foreground">{d.detail}</TableCell>
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
