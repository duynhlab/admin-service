# Commerce Analytics design preview

Review the RFC-0030 Analytics screen before its Go API and Linux qualification
are available. This is an isolated frontend preview, not a deployed Admin page.
The owner authorized illustrative fixtures for this preview; the application's
no-mock rule remains in force.

```bash
npm ci
npm run dev:analytics
# http://127.0.0.1:3010/
```

No containers, Keycloak session or backend credentials are required. The preview
has a separate HTML entry and Vite configuration. It imports presentation
components but never imports the application's auth, API client, route tree or
shell. The production entry imports neither the preview nor its fixtures;
Docker excludes `previews/`. There is no Analytics navigation or protected route
yet. Keep fixture imports inside this directory.

## Review the screen

The page places interval/currency filters and freshness before KPIs, the daily
capture trend, checkout cohort stages and a bounded top-products table. It
reuses the app's Geist fonts, semantic colors, buttons, inputs and skeletons.
Recharts lives behind `CaptureTrend`; its exact daily values are also available
in an accessible table. Reduced-motion users see the same static chart.

The preview toolbar selects healthy, stale, empty, loading, unavailable, unknown
freshness, initial error, failed refresh, forbidden and awaiting-API states.
Refresh/Try again simulates recovery; it does not call an endpoint. The preview
clock is frozen at **2026-10-13 10:00 UTC**, prominently labelled on screen.

- Presets select 7/30/90 days ending at the current `to` date.
- Custom intervals are `[from, to)` in UTC, between one and 90 days.
- Applied filters, scenario and theme live in TanStack Router search state;
  Back/Forward restores them. Unapplied filter drafts belong to TanStack Form.
- Query owns the asynchronously loaded illustrative result. Filter changes do
  not carry a previous currency/range's result into the new view.
- USD and VND demonstrate two decimal exponents, not currency conversion or a
  promise about the backend's supported currency list.

## Draft presentation contract

`src/features/analytics/contract.ts` defines Zod schemas and inferred TypeScript
types for review. The accepted RFC/ADR govern semantics; these field names are
not yet an as-built API contract. Final API ownership stays in homelab
`docs/api/analytics.md` when the backend is implemented.

| Field | Meaning |
|---|---|
| `filters` | Applied currency and UTC interval, echoed to identify the result |
| `kpis.settled_capture_minor` | Capture less reversal, derived by the backend from merchant-revenue ledger legs |
| `kpis.refunded_minor` | Successful refund postings |
| `kpis.net_captured_minor` | Settled capture less refund |
| `kpis.captured_orders` | Distinct orders with positive non-reversed capture |
| `kpis.average_captured_order_minor` | Settled capture / captured orders, rounded to a minor unit; null when the denominator is zero |
| `trend` | Up to 90 UTC-day rows of settled capture, refund and net; backend owns aggregation |
| `funnel` | Checkout-start cohort: started, durable order, positive settled capture, completed order |
| `top_products` | At most ten rows ranked by item subtotal, with historical name, quantity and order count; item subtotal is not revenue |
| `meta` | `generated_at`, oldest source `data_through`, `stale`, and exactly order/checkout/payment source health |

Current presentation schemas accept only safe integer minor-unit values. The
backend integration must settle encoding for larger int64 totals and confirm
supported currencies and metric window semantics before publishing the contract.
The UI must never silently coerce unsafe JSON integers or sum across currencies.

All business values come from the response. Only formatting, cohort percentages
and conservative expiry of cached freshness are calculated in the view. A
fresh result must have all sources at most two minutes behind; any source above
two minutes is stale. More than five minutes, future timestamps or unknown
freshness hides the numbers. A failed refresh can retain the last good result
only while its timestamps remain within that same bound. Empty data is an
explicit successful result, never a replacement for an error.

## Verification

```bash
npm run build
npm run lint
npm run check:analytics
npx playwright install chromium
npm run test:analytics
```

The dedicated Playwright suite covers contract boundaries, filters/history,
preview states, keyboard use, no backend requests, and axe at desktop/mobile
sizes in both themes. Screenshots go to `/tmp`; traces/results remain ignored.
These tests are **not** authentication, production routing, API, ClickHouse,
CDC, performance or release evidence. The real-stack E2E suite remains separate.

Before enabling the real route: finalize the API contract, connect the shared
edge client under the existing staff guard, validate response shape, handle
401/403/503 with the shared policies, run all Linux/data gates, and complete the
real-stack browser audit. Follow-up is tracked in
[RFC-0030 handoff #1266](https://github.com/duynhlab/homelab/issues/1266).

## References

- [RFC-0030](https://github.com/duynhlab/homelab/tree/main/docs/proposals/rfc/RFC-0030)
- [ADR-069](https://github.com/duynhlab/homelab/tree/main/docs/proposals/adr/ADR-069-serve-commerce-analytics-through-read-only-service)
- [Recharts responsive container](https://recharts.github.io/en-US/api/ResponsiveContainer/)
