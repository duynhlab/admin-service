import { Badge } from '@/components/ui/badge'
import type { StatusHistoryEntry } from '@/features/orders/api'

/**
 * The order's transition history, newest first.
 *
 * order-service writes one row per transition in the same transaction as the
 * transition itself, so this is not a best-effort log: if the order moved, its
 * row is here. That is what makes it the control on a trusted operator command
 * (ADR-051), and why an operator row is called out rather than blending in with
 * the workflow's own bookkeeping.
 */

/** OPERATOR rows are the ones a human is accountable for; the rest are the saga. */
const actorVariant = (actorType: string) =>
  actorType === 'OPERATOR' ? 'destructive' : actorType === 'USER' ? 'secondary' : 'outline'

export function StatusTimeline({ rows }: { rows: Array<StatusHistoryEntry> }) {
  if (rows.length === 0) {
    return (
      <p role="status" className="py-4 text-sm text-muted-foreground">
        No recorded transitions. Orders that never left their initial state have no
        rows here.
      </p>
    )
  }

  return (
    <ol role="list" className="flex flex-col divide-y">
      {rows.map((row) => (
        <li key={row.command_id} className="flex flex-col gap-1 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={actorVariant(row.actor_type)}>{row.actor_type}</Badge>
            <span className="text-sm">
              <span className="text-muted-foreground">{row.from_status}</span>
              {/* The arrow is decorative; a screen reader cannot read a glyph as
                  a transition, so the words carry it. */}
              <span aria-hidden className="text-muted-foreground">
                {' → '}
              </span>
              <span className="sr-only"> changed to </span>
              <span className="font-medium">{row.to_status}</span>
            </span>
            {row.reason_code && (
              <span className="font-mono text-xs text-muted-foreground">{row.reason_code}</span>
            )}
            <span className="text-xs text-muted-foreground">{row.created_at}</span>
          </div>
          {row.actor_id && (
            <p className="text-sm">
              by{' '}
              <span className="font-mono text-xs" title="the verified token subject (ADR-047)">
                {row.actor_id}
              </span>
            </p>
          )}
          {row.note && <p className="text-sm">{row.note}</p>}
        </li>
      ))}
    </ol>
  )
}
