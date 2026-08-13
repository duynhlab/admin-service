import { CircleDashed } from 'lucide-react'

/**
 * Honest empty state for a section whose backend slice has not shipped yet.
 * The portal never mocks data (owner rule): until the owning service exposes
 * its `/protected/` routes, the section says so explicitly.
 */
export function AwaitingApi({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <CircleDashed className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Waiting for its API slice</p>
        <p className="max-w-md text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}
