import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/auth'

const searchSchema = z.object({
  /** Where to land after Keycloak returns; internal paths only. */
  redirect: z.string().startsWith('/').optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: search.redirect ?? '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectPath } = Route.useSearch()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">duynhlab Backoffice</h1>
          <p className="text-sm text-muted-foreground">
            Operator sign-in is handled by Keycloak. You need the{' '}
            <span className="font-mono text-[13px]">backoffice_admin</span> role.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => void auth.login(redirectPath ?? '/')}
        >
          Sign in with Keycloak
        </Button>
      </div>
    </main>
  )
}
