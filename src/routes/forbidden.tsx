import { createFileRoute } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/auth'

/**
 * Terminal permission-denied page (403): the session is valid but the account
 * lacks `backoffice_admin`. Deliberately not behind the guard, and never
 * retried — the only exits are signing out or asking for the role.
 */
export const Route = createFileRoute('/forbidden')({
  component: ForbiddenPage,
})

function ForbiddenPage() {
  const username = auth.username()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <ShieldX className="size-6 text-destructive" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            {username ? (
              <>
                <span className="font-medium text-foreground">{username}</span> is
                signed in but does not hold the{' '}
                <span className="font-mono text-[13px]">backoffice_admin</span> role.
              </>
            ) : (
              <>This account does not hold the backoffice operator role.</>
            )}
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => void auth.logout()}>
          Sign out
        </Button>
      </div>
    </main>
  )
}
