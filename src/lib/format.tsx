import { cn } from '@/lib/utils'

/** Money in minor units → a display string (platform stores int64 minor). */
export function formatMinor(minor: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)
}

/** One shared status-chip strip: URL-state driven, "all" resets. */
export function StatusChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status filter">
      {[undefined, ...options].map((status) => (
        <button
          key={status ?? 'all'}
          onClick={() => onChange(status)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[13px] font-medium capitalize transition-colors',
            value === status
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {status ?? 'all'}
        </button>
      ))}
    </div>
  )
}
