import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'

/**
 * The portal's one case-view convention: a back link to the owning list, a
 * heading with the record's status, and label/value fields — every detail
 * screen reads the same way, and loading / error / not-found are owned here
 * so a dead service degrades identically on all of them (ADR-048: an honest
 * error state, never a fabricated record).
 */

export function DetailHeader({
  backTo,
  backLabel,
  title,
  badge,
  actions,
}: {
  backTo: string
  backLabel: string
  title: string
  badge?: ReactNode
  /** Commands available on this case, pushed to the trailing edge. */
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        to={backTo}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {badge}
        {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Loading / error / not-found for a detail query; render children only on data. */
export function DetailStates({
  isPending,
  error,
  notFoundMessage,
  children,
}: {
  isPending: boolean
  error: unknown
  notFoundMessage: string
  children: ReactNode
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error instanceof ApiError && error.status === 404) {
    return <p className="text-sm text-muted-foreground">{notFoundMessage}</p>
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof ApiError ? error.message : 'The owning service did not answer.'}
      </p>
    )
  }
  return children
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </dl>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children ?? '—'}</dd>
    </div>
  )
}
