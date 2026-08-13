import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { AuthApi } from '@/lib/auth'

export interface RouterContext {
  auth: AuthApi
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This page does not exist or is not visible to you.
      </p>
      <a href="/" className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to the dashboard
      </a>
    </main>
  )
}
