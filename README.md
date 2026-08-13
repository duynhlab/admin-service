# admin-service — duynhlab Backoffice

The operator-facing **Admin Portal** for the duynhlab platform
([RFC-0023](https://github.com/duynhlab/homelab/tree/main/docs/proposals/rfc/RFC-0023)):
a static React SPA for business operations — catalog, stock, orders, payments,
shipments, customers — over role-gated `/{service}/v1/protected/…` APIs.
Despite the repository name it contains **no backend**: no Go service, no
database, no BFF (ADR-048).

| | |
|---|---|
| Stack | React 19 · TypeScript · Vite · TanStack Router/Query/Table/Form · zod · Tailwind v4 · shadcn/ui · keycloak-js |
| Auth | Keycloak **`duynhlab-staff`** realm (workforce, ADR-050), `admin-portal` client (PKCE S256), role `backoffice_admin` |
| Dev URL | http://localhost:3009 |
| API | Envoy Gateway edge at http://localhost:8080 (local) — contracts in homelab `docs/api/` |

## Run it

```bash
# 1. Bring up the platform (Keycloak, services, edge):
cd ../homelab/local-stack && docker compose up -d

# 2. Start the portal:
npm install
npm run dev            # http://localhost:3009 — sign in as duyne / p@ss1234

# Checks:
npm run build          # typecheck + bundle
npm run lint
npm run test:e2e       # Playwright + axe against the running stack
```

Configuration is baked at build time via `VITE_API_BASE_URL`,
`VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`
(defaults target local-stack).

Agent guidance: [AGENTS.md](AGENTS.md).
