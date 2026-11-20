---
name: nextjs-architecture
description: Applies Knowledge Assistant frontend architecture when creating or modifying Next.js routes, layouts, components, features, Server Actions, styling, state or API integrations in apps/web.
---

# Next.js Architecture

## Source of truth

Read [apps/web/ARCHITECTURE.md](../../../apps/web/ARCHITECTURE.md) before changing
frontend organization. Follow [AGENTS.md](../../../AGENTS.md) for authority and
budget. This skill does not approve a migration, new feature or dependency.

## Workflow

1. Define the approved scope, allowed files and acceptance criteria.
2. Use `graphify-local` for exact relevant symbols; confirm their source.
   After structural moves, Graphify may contain stale paths: verify locations
   against the current filesystem. Do not rebuild the index; ask the user to
   update it when needed. Do not scan the monorepo.
3. Choose the owner:
   - Next entrypoint or HTTP callback: `src/app/`.
   - Feature scenario, UI, action, validation/model: `src/features/<feature>/`.
   - Feature-independent reusable UI/layout: `src/components/`.
   - Supabase/NestJS infrastructure: `src/lib/`.
   - Named routes and access rules: separate files under `src/config/`.
   - Shared pure utility/global CSS/tooling: `utils/`, `styles/`, `scripts/`
     only when actually needed.
4. The Architecture Foundation and feature migrations are complete. Follow the
   current structure in `apps/web/ARCHITECTURE.md`. URL constants belong only
   in `apps/web/src/config/routes.ts`; the sole default-deny security policy is
   in `apps/web/src/config/access-policy.ts`. Do not duplicate the public allowlist
   or create empty target directories.
5. Make the smallest authorized change, run affected checks, report and stop.

## Checklists

### Route/layout

- Keep `page`, `layout`, `route`, metadata and other Next special files in `app/`.
- Use `(protected)` for product pages and shared SSR verification via `getUser`.
- Add a named URL to `config/routes.ts`; this never makes a route public.
- Keep default-deny proxy policy. Public access is an explicit approved exception.
- Preserve callbacks, POST actions, asset exceptions, cookie refresh and recovery
  CSP/connect-src, including dev HMR. Never bounce ordinary sessions out of recovery.

### Component/feature

- Feature-specific UI goes in the feature, reusable UI in `components/`.
- Complex component: `ComponentName/ComponentName.tsx`, adjacent test and optional
  `ComponentName.module.css`. Small components may stay flat.
- Use Mantine first; add CSS Modules only when needed. No complex responsive
  inline styling. Keep local state local; no new shared store without a need.
- Use `'use client'` only for interactive leaves; do not convert server layouts.

### API adapter

- Server-to-server NestJS calls only; preserve internal/public URL precedence,
  Bearer isolation, no-store, timeouts and response validation.
- Keep transport in lib and application orchestration in the owning feature's
  server module.
- No product DB CRUD, Prisma/backend imports, client-exposed internal URL,
  service-role key, token props or credential logging.
- Do not import server implementations from Client Components or mix them into
  browser barrels. A filename alone does not enforce a server boundary.

### Server Action

- New actions belong in the owning feature with `'use server'`.
- Validate untrusted input and authorization in the action, not just the layout.
- Recovery requires its one-time `verifyOtp(type: recovery)` before update;
  a login session or client event is never a substitute.
- Return safe action state; use fixed redirects outside broad error catches.
- Keep actions in their owning feature; do not relocate existing actions unless
  the move is explicitly approved.

### Completion

- Colocate tests; check affected route/auth/security behavior with deterministic fakes.
- Run targeted tests, web TypeScript, affected ESLint and Prettier as applicable.
- Do not introduce dependencies, state libraries or layers without approval.
- Do not weaken routing/CSP, change infrastructure, run live Auth tests, move
  unrelated files or begin the next migration phase automatically.
- Report paths, verification, remaining risks and the next human gate.
