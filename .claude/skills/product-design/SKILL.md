---
name: product-design
description: Build or review polished, consistent product UI for the user's TanStack Start and React projects. Use for dashboard pages, navigation, cards, charts, data tables, forms, dialogs, settings, AI chat, responsive layouts, and loading, empty, error, or stale-data states. Also use when the user asks to make an interface beautiful, premium, clean, dense, professional, less generic, or consistent with their existing product.
---

# Personal Product Design

Create calm, precise, production-ready interfaces that feel designed as one product. Treat this skill as a reusable design contract, not a fixed brand theme.

## Resolve the design authority

Apply constraints in this order:

1. Follow the user's explicit requirements and reference images.
2. Follow the current repository's instructions, tokens, components, and established visual language.
3. Use the defaults in this skill only where the project has no answer.

Do not replace an established project identity with this skill's defaults. Ask about brand choices only when the missing decision would materially change the result; otherwise use semantic tokens and proceed.

## Work with the preferred stack

When the project supports it, prefer:

- TanStack Start and file-based TanStack Router
- React 19 with TypeScript
- TanStack Query for remote state, caching, and revalidation
- TanStack Table for non-trivial data tables
- Tailwind CSS v4 with CSS-first semantic tokens
- shadcn/ui primitives, using the project's installed backing library
- Recharts for charts
- Lucide React for interface icons
- Vercel AI SDK and assistant-ui for AI conversations

Do not install another UI kit merely to reproduce a component already available in the project. Do not rewrite working routing, data, or deployment architecture for a visual task.

## Inspect before designing

Before editing UI:

1. Read project instructions and the relevant package manifest.
2. Locate global styles, theme tokens, fonts, shared layouts, and UI primitives.
3. Find the closest existing page or component and reuse its structure.
4. Identify the primary user task, information hierarchy, actions, and required states.
5. Separate functional requirements from optional decoration.

Prefer extending an existing idiom over introducing a second visual language.

## Default visual profile

Use these defaults only when the project has no established values.

### Color

- Use semantic tokens such as `background`, `foreground`, `card`, `muted`, `muted-foreground`, `primary`, `accent`, `destructive`, `border`, `input`, and `ring`.
- Define tokens in OKLCH when creating a new Tailwind v4 theme.
- Start with a near-neutral grayscale and one restrained brand accent.
- Reserve green, amber, and red for meaningful success, warning, and error states.
- Ensure every surface works in light and dark mode.
- Never hardcode `bg-white`, `text-black`, or raw brand colors inside reusable components.

### Typography

- Preserve the project's font. For a new product, default to Geist Variable with Geist Mono for code and tabular technical values.
- Page title: `text-xl` or `text-2xl`, semibold, tight tracking.
- Section heading: `text-sm font-medium` with an optional muted icon.
- Body: `text-sm`.
- Dense controls: `text-[13px]`.
- Metadata: `text-xs text-muted-foreground`.
- Avoid oversized marketing typography inside operational product screens.

### Shape and spacing

- Default controls to 8-10px radius and cards to 12-14px radius.
- Use a small spacing vocabulary: `gap-1.5` compact, `gap-2` standard, `gap-4` generous, and `gap-6` between major page sections.
- Use `rounded-xl border bg-card shadow-sm` as the baseline card surface.
- Keep borders low contrast and shadows shallow.
- Use a very subtle surface gradient only for a deliberate focal or premium surface, not every card.
- Align headings, controls, cards, and table columns to a consistent grid.

### Icons and motion

- Prefer Lucide icons at `size-4`, or `size-3.5` for compact controls, with restrained stroke weight.
- Use motion to explain change, hierarchy, or state; avoid decorative continuous movement.
- Respect reduced-motion preferences.

## Compose product screens

Use this hierarchy for dashboards and internal tools:

1. Persistent product navigation
2. Compact global toolbar or breadcrumb row
3. Page title, concise description, and primary actions
4. Filters or segmented controls close to the content they affect
5. Clearly labeled sections with equal visual treatment at the same hierarchy level
6. Cards, charts, or tables arranged by decision importance rather than arbitrary symmetry

Do not give every metric equal visual weight. Promote exceptions and actionable information; keep normal status dense and quiet.

## Component rules

- Keep generated shadcn primitives pristine. Customize at the call site or through application-level wrappers.
- Merge classes with the project's class utility instead of ad hoc string concatenation.
- Make the whole summary card clickable when it opens one detail view. Preserve keyboard access and avoid nested competing buttons.
- Centralize durable card, chart, table, skeleton, and empty-state patterns.
- Reuse one segmented-control treatment across time ranges, views, and small option groups.
- Keep focus states visible and maintain sufficient contrast.

## Data fetching and revalidation

- Use TanStack Query for server state instead of mirroring it into local state.
- Match loading skeletons to the final content geometry to prevent layout shift.
- On initial failure with no data, show a full error state with a useful retry.
- On background refresh failure, keep the last good data and show a subtle stale indicator.
- Distinguish empty, no-results, filtered-empty, offline, timeout, and permission states when the recovery action differs.
- Keep refresh controls, time ranges, filters, and URL state predictable.

## Charts

- Wrap charts in one shared container that owns loading, empty, error, stale, title, metadata, and retry behavior.
- Use Recharts primitives behind application-level chart components rather than wiring each screen independently.
- Use semantic chart tokens and keep series colors stable across pages.
- Limit simultaneous series and labels to what users can compare.
- Use sensible axis formatting, units, tooltips, and accessible summaries.
- Do not use a chart when a number, proportion list, or compact table communicates the answer faster.

## Tables

- Use TanStack Table for sorting, filtering, resizing, pagination, virtualization, selection, or row actions.
- Keep high-value columns visible and move secondary detail into expansion or a side sheet.
- Use tabular numerals and consistent unit formatting.
- Avoid wrapping every cell by default; provide deliberate truncation, wrapping, or detail behavior.
- Make row interaction discoverable without turning every value into a button.

## AI interfaces

- Use assistant-ui patterns for message composition, streaming, attachments, and scroll behavior when already installed.
- Show what page or data context the assistant can access.
- Separate suggestions, tool activity, generated answers, and errors visually without excessive container nesting.
- Keep the AI surface consistent with the rest of the product instead of giving it an unrelated neon or gradient theme.

## Responsive behavior

- Collapse persistent navigation into a drawer or compact rail at smaller widths.
- Reduce a four-column dashboard to two columns and then one column based on usable content width.
- Keep primary actions reachable; move secondary actions into an overflow menu.
- Allow dense toolbars and tab strips to scroll horizontally rather than wrap unpredictably.
- Verify touch targets, table fallback behavior, and dialog or sheet sizing on mobile.

## Avoid generic AI styling

- Do not add gradient blobs, glow orbs, glassmorphism, or decorative grids without a product reason.
- Do not stack a colored border, accent rail, badge, icon, and tinted background to repeat one status.
- Do not wrap every label in a pill.
- Do not use saturated fills for large operational surfaces.
- Do not create arbitrary radii, shadows, colors, or spacing values.
- Do not hide weak hierarchy behind decoration.
- Do not make every card hover, animate, or appear clickable.
- Do not invent fake logos or illustrations when a simple icon or lettermark is more credible.

## Implementation workflow

1. State the intended hierarchy and the existing components to reuse.
2. Implement the smallest coherent component set.
3. Add loading, empty, error, stale, and permission states as applicable.
4. Verify desktop and mobile layouts.
5. Verify light and dark themes.
6. Run the repository's formatting, type-checking, tests, and build commands appropriate to the change.
7. Inspect the rendered result and correct overflow, alignment, contrast, density, and layout shift.

When handing off, summarize what was reused, what was introduced, and any design decision that should become a durable project token or component.
