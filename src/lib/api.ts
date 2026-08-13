import { auth } from '@/lib/auth'

/**
 * Typed fetch wrapper for the platform edge (Envoy Gateway).
 *
 * Every call targets the gateway — never a service directly (ADR-048) and
 * never `/internal/` (ADR-047). Protected routes follow the conventions in
 * homelab `docs/api/api.md` § Protected route conventions: shared error
 * envelope `{error, code}`, standard `page`/`page_size` pagination, and two
 * idempotency styles (header `Idempotency-Key`, or a body `command_id` owned
 * by the calling feature).
 */

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

/** The platform's shared error envelope, thrown for every non-2xx response. */
export class ApiError extends Error {
  /** HTTP status. 0 means the request never reached the edge. */
  readonly status: number
  /** Stable machine-readable code (`FORBIDDEN`, `VALIDATION_ERROR`, …). */
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Standard list envelope — `docs/api/api.md` § List pagination. */
export interface Paginated<T> {
  items: Array<T>
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

export interface PageQuery {
  page?: number
  page_size?: number
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Query string parameters; undefined values are dropped. */
  query?: Record<string, string | number | undefined>
  /** Wire this to TanStack Query's queryFn signal so stale requests abort. */
  signal?: AbortSignal
  /** Sets the `Idempotency-Key` header (payment-lineage command style). */
  idempotencyKey?: string
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await auth.getToken()

  const url = new URL(API_BASE_URL + path)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const headers = new Headers({ 'X-Request-ID': crypto.randomUUID() })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? null,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'The platform edge is unreachable')
  }

  if (!response.ok) {
    // Parse the shared envelope; fall back to a stable shape when a proxy or
    // the edge itself answered without one.
    const envelope = (await response.json().catch(() => null)) as {
      error?: string
      code?: string
    } | null
    throw new ApiError(
      response.status,
      envelope?.code ?? 'INTERNAL_ERROR',
      envelope?.error ?? `Request failed with status ${response.status}`,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
