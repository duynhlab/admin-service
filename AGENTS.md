# AGENTS.md

Source of truth for AI agents working in **`admin-service`** — the duynhlab
**Backoffice Admin Portal** (RFC-0023). Despite the `-service` suffix this
repository is a **static frontend only**: no Go service, no database, no BFF
(ADR-048). Platform/GitOps/docs live in `duynhlab/homelab`; business logic
lives in the owning `*-service` repos.

## What this app is

A React SPA for a single platform operator: read-heavy business screens plus
narrow, audited commands, calling `/{service}/v1/protected/…` APIs **directly
through the Envoy Gateway edge** — never `/internal/`, never a service
bypassing the edge (ADR-047/048).

| Fact | Value |
|------|-------|
| Stack | React 19 + TypeScript strict + Vite; TanStack Router/Query/Table/Form; zod; Tailwind v4 + shadcn/ui (`base-nova`, Base UI primitives — `render` prop, **not** `asChild`); keycloak-js |
| Auth | Keycloak realm `duynhlab`, public client `admin-portal`, PKCE S256, in-memory tokens (`src/lib/auth.ts`) |
| Operator role | `backoffice_admin` — frontend guard is UX only; services re-verify everything |
| Dev server | `npm run dev` → **http://localhost:3009** (the port the realm client + edge CORS allowlist) |
| Local platform | `cd ../homelab/local-stack && docker compose up -d` (Keycloak :8081, edge :8080) |
| Demo users | `alice` / `password123` (operator), `bob` (customer — hits the 403 gate). Login by **username** |
| API truth | homelab **`docs/api/`** (esp. `api.md` § Protected route conventions) — never service READMEs |
| Design authority | The owner's **`product-design`** skill (agent IDE); tokens live in `src/index.css` |

## Hard rules

- **No mock data, ever** (owner rule): screens without a shipped backend slice
  render the explicit `AwaitingApi` state. E2E runs against the real compose
  stack.
- **One authority per state type** (ADR-049): URL ↔ Router (`validateSearch`
  with zod), remote records ↔ Query (never copied into component state or a
  store), tables ↔ Table (`manualPagination` + server `rowCount` via
  `DataTable`), drafts ↔ Form, session ↔ keycloak-js.
- **Tokens stay in memory** — never web storage, never logged, never in
  Playwright reports.
- shadcn `src/components/ui/*` stay pristine; customize at call sites.
- Errors surface the shared envelope (`ApiError`: `{status, code, message}`):
  401 → the single re-auth path in `lib/auth`; 403 → permission page, never
  retried; partial failure degrades the panel, never the page.
- English only in UI copy, code, and docs; Mermaid for diagrams.

## Layout

```text
src/routes/        file-based routes; _authenticated/ is the guarded shell
src/components/    app-shell, data-table, awaiting-api; ui/ = shadcn (pristine)
src/lib/           auth (keycloak singleton) · api (edge fetch + envelope) · query · utils
tests/             Playwright + axe against the real stack
```

## Build, test

```bash
npm run dev        # :3009
npm run build      # tsc -b && vite build — must stay clean
npm run lint       # oxlint — zero warnings
npm run test:e2e   # Playwright (+ axe); requires local-stack up
```

Verification for any change: `npm run build && npm run lint`, plus the e2e
suite when auth, routing, or an API surface is touched. UI work follows the
`product-design` skill's implementation workflow (states, both themes,
responsive, inspect rendered output).

## Workflow

- Commits/branches follow the homelab contribution rules: imperative ≤50-char
  subject, no attribution trailers, `feat/ fix/ chore/ docs/` branch prefixes,
  one logical change per branch.
- RFC-0023 governs scope; substantial design changes go through the homelab
  RFC/ADR gate, not this repo.
