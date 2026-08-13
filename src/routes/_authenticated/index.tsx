import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { auth } from '@/lib/auth'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

/**
 * Dashboard skeleton. Attention cards (low stock, manual-review backlog,
 * payment discrepancies, recent orders) arrive with their owning services'
 * protected read slices — each card gets its own query key and error state,
 * and a failed domain never blanks the page (ADR-048). Until then the only
 * real data on this screen is the operator's own session.
 */
function DashboardPage() {
  const roles = auth.realmRoles()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Business operations across the duynhlab platform.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Session</CardTitle>
          <CardDescription>
            Verified by Keycloak; services re-check every request.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Operator</span>
            <span className="text-sm font-medium">{auth.username() ?? '—'}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-muted-foreground">Realm roles</span>
            <span className="flex flex-wrap justify-end gap-1">
              {roles.map((role) => (
                <Badge
                  key={role}
                  variant={role === 'backoffice_admin' ? 'default' : 'secondary'}
                >
                  {role}
                </Badge>
              ))}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium">Attention cards land with their API slices</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Low/out-of-stock, manual-review and cancelling backlogs, payment
          discrepancies, and recent orders appear here as each owning service
          ships its protected reads — real data only, no placeholders.
        </p>
      </div>
    </div>
  )
}
