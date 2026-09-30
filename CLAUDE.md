@AGENTS.md

## Claude Code

- Commit messages and PR bodies carry **no attribution trailers** (no
  `Co-Authored-By: Claude …`, no "Generated with Claude Code"). The homelab
  contribution rules win over the tool's default reminder.
- Load the `product-design` skill (`.claude/skills/product-design`) before
  writing or reviewing any UI, and finish its workflow: states, both themes,
  responsive, inspect the rendered output.
- Use plan mode for changes under `src/lib/auth.ts` and `src/lib/api.ts`: the
  first owns the in-memory token and the single 401 re-auth path, the second
  the error envelope every screen depends on.
- "No mock data" includes tests and fixtures: never add MSW handlers, fake
  JSON, or stubbed responses. A screen with no shipped backend renders
  `AwaitingApi`; e2e runs against `../homelab/local-stack` only.
- Do not edit `src/components/ui/*` (shadcn, pristine). Customize at the call
  site; Base UI primitives take `render`, not `asChild`.
- Before reporting done: `npm run build && npm run lint`, both clean. Add
  `npm run test:e2e` with the compose stack up when auth, routing, or an API
  surface changed.
