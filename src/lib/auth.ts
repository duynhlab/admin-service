import Keycloak from 'keycloak-js'

/**
 * Keycloak singleton (RFC-0023, mirroring the customer SPA's proven adapter
 * shape from RFC-0024 P3).
 *
 * Authentication is delegated to Keycloak — the WORKFORCE realm
 * `duynhlab-staff` (ADR-050: operators and customers are separate identity
 * populations; the customer realm cannot mint a token this app or the
 * protected APIs accept), public client `admin-portal`, Authorization Code +
 * PKCE S256. Tokens live in memory
 * inside the keycloak-js adapter — never web storage, never logged. The
 * frontend role check is UX only: every service re-verifies the token and the
 * `backoffice_admin` role on every request (ADR-047).
 *
 * Config mirrors the platform's VITE_* conditional-bake pattern:
 *   VITE_KEYCLOAK_URL       → Keycloak origin (default http://localhost:8081)
 *   VITE_KEYCLOAK_REALM     → realm name (default duynhlab-staff)
 *   VITE_KEYCLOAK_CLIENT_ID → public client id (default admin-portal)
 */

export const BACKOFFICE_ROLE = 'backoffice_admin'

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'duynhlab-staff',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'admin-portal',
})

/**
 * keycloak-js event handlers are single-assignment; the singleton owns them
 * and fans out to a window event so React state can re-read adapter state.
 */
function notifyAuthChange() {
  window.dispatchEvent(new Event('auth-change'))
}

keycloak.onAuthSuccess = notifyAuthChange
keycloak.onAuthLogout = notifyAuthChange
keycloak.onAuthRefreshSuccess = notifyAuthChange
keycloak.onTokenExpired = () => {
  // Proactive refresh when the 15-min access token expires while the tab is
  // idle; if the SSO session is gone too, the next API call re-authenticates.
  keycloak.updateToken(30).catch(() => notifyAuthChange())
}

let initPromise: Promise<boolean> | null = null

/**
 * Initialize the adapter exactly once (check-sso: resume an existing SSO
 * session silently via the hidden iframe, never force a login redirect).
 * main.tsx awaits this before rendering so route guards see settled state.
 */
export function initAuth(): Promise<boolean> {
  initPromise ??= keycloak
    .init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    })
    .catch((error: unknown) => {
      // Keycloak unreachable or misconfigured: render logged-out instead of a
      // blank page; a login attempt will surface the failure.
      if (import.meta.env.DEV) {
        console.error('[keycloak] init failed:', error)
      }
      return false
    })
  return initPromise
}

export const auth = {
  isAuthenticated: () => !!keycloak.authenticated,

  /** UX-only gate — services are the authoritative role check (ADR-047). */
  hasBackofficeRole: () => keycloak.hasRealmRole(BACKOFFICE_ROLE),

  username: (): string | undefined =>
    keycloak.tokenParsed?.['preferred_username'] as string | undefined,

  realmRoles: (): Array<string> =>
    (keycloak.tokenParsed?.realm_access?.roles ?? []) as Array<string>,

  /** Redirect to the Keycloak login page, returning to `redirectPath`. */
  login: (redirectPath = '/') =>
    keycloak.login({ redirectUri: window.location.origin + redirectPath }),

  logout: () =>
    keycloak.logout({ redirectUri: `${window.location.origin}/login` }),

  /**
   * The single controlled re-auth path: refresh when <60s validity remains;
   * a dead SSO session falls back to an explicit login redirect (never a
   * loop — the caller's request simply never fires).
   */
  getToken: async (): Promise<string | null> => {
    if (!keycloak.authenticated) return null
    try {
      await keycloak.updateToken(60)
    } catch {
      await keycloak.login({ redirectUri: window.location.href })
      return null
    }
    return keycloak.token ?? null
  },

  /** Subscribe to adapter state changes; returns the unsubscribe function. */
  onChange: (listener: () => void): (() => void) => {
    window.addEventListener('auth-change', listener)
    return () => window.removeEventListener('auth-change', listener)
  },
}

export type AuthApi = typeof auth
