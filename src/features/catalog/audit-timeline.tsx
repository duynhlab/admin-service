import { Badge } from '@/components/ui/badge'
import type { AuditRow } from '@/features/catalog/api'

/**
 * The audit trail as a timeline (RFC-0023 slice B / ADR-047). product-service
 * writes one row per privileged change in the same transaction as the change
 * itself, so this list is not a best-effort log — if a change happened, its row
 * is here.
 *
 * `changed_fields` arrives in two shapes and the difference is meaningful, so
 * the renderer keeps both instead of flattening them:
 *   CREATE      {"name": "Widget", "price": 24.5}          — the values it was born with
 *   UPDATE/etc  {"price": {"before": 20, "after": 25}}     — what moved
 */

/** A per-field before/after pair, as the service records it for an edit. */
interface FieldDiff {
  before?: unknown
  after?: unknown
}

function isDiff(value: unknown): value is FieldDiff {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    ('before' in value || 'after' in value)
  )
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Action tone: the destructive ones read destructive, the rest stay quiet.
 * Never colour alone — the action name is always the label, so the state is
 * legible without perceiving hue.
 */
const actionVariant = (action: string) =>
  action === 'ARCHIVE' ? 'destructive' : action === 'CREATE' ? 'outline' : 'secondary'

function ChangedFields({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields)
  if (entries.length === 0) return null

  return (
    <dl className="mt-2 flex flex-col gap-1">
      {entries.map(([field, value]) => (
        <div key={field} className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <dt className="font-medium text-muted-foreground">{field}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-1.5">
            {isDiff(value) ? (
              <>
                <span className="text-muted-foreground line-through">{renderValue(value.before)}</span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                {/* The arrow is decorative; the words carry the meaning for a
                    screen reader, which cannot read a glyph as a transition. */}
                <span className="sr-only">changed to</span>
                <span className="font-medium">{renderValue(value.after)}</span>
              </>
            ) : (
              <span>{renderValue(value)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function AuditTimeline({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        No recorded changes. Products that predate the audit trail — or that were
        only ever seeded — have no rows here.
      </p>
    )
  }

  return (
    <ol role="list" className="flex flex-col divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={actionVariant(row.action)}>{row.action}</Badge>
            <span className="text-sm text-muted-foreground">{row.created_at}</span>
            {row.version_before !== null && row.version_after !== null && (
              <span className="text-xs tabular-nums text-muted-foreground">
                v{row.version_before} → v{row.version_after}
              </span>
            )}
            {row.version_before === null && row.version_after !== null && (
              <span className="text-xs tabular-nums text-muted-foreground">v{row.version_after}</span>
            )}
          </div>
          <p className="text-sm">
            by{' '}
            <span className="font-mono text-xs" title="the verified token subject (ADR-047)">
              {row.actor_sub}
            </span>
            {row.reason && <> — {row.reason}</>}
          </p>
          {row.changed_fields && <ChangedFields fields={row.changed_fields} />}
        </li>
      ))}
    </ol>
  )
}
