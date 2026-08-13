import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'

/**
 * Pathless layout guarding every operator screen (RFC-0023).
 *
 * This is a UX gate only: it keeps signed-out users and non-operators off the
 * shell. The authoritative checks are in the services — every request is
 * re-verified (token + `backoffice_admin`) by `pkg/authmw` (ADR-047).
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!context.auth.hasBackofficeRole()) {
      throw redirect({ to: '/forbidden' })
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
