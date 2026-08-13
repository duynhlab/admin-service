import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { auth, initAuth } from '@/lib/auth'
import { queryClient } from '@/lib/query'
import './index.css'

const router = createRouter({
  routeTree,
  context: { auth, queryClient },
  defaultPreload: 'intent',
  // Remote data is cached by TanStack Query, not the router.
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root is missing')

// Settle the Keycloak session (and process any login redirect) before the
// first render so route guards never see transient unauthenticated state.
void initAuth().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
