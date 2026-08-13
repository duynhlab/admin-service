import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

/**
 * One QueryClient for the app, carried through router context.
 *
 * Defaults tuned for an operator tool over authoritative services: no retry
 * on auth/validation failures (they will not heal), one retry otherwise;
 * remote records are never copied into client stores (ADR-049) — the cache
 * IS the client copy.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status > 0 && error.status < 500) {
          return false
        }
        return failureCount < 1
      },
    },
    mutations: {
      // Commands are never blind-retried by the layer; features retry
      // explicitly with the same idempotency key when the outcome is unknown.
      retry: false,
    },
  },
})
