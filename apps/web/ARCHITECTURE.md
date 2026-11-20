# Frontend Architecture

## 1. Scope and principles

Knowledge Assistant uses Next.js 16 App Router, React Server Components,
TypeScript, Mantine and CSS Modules in a pnpm/Turborepo workspace.
Use pragmatic feature-based organization, not a full Feature-Sliced Design
framework. Prefer the smallest module that owns a real responsibility.

This document defines the approved standard and records the completed
architecture foundation and UI/infrastructure migrations. Preserve working
authentication, URLs and all unrelated uncommitted changes.
Repository `AGENTS.md` remains authoritative for permissions and execution budget.

## Frontend architecture evolution

The available Git history does not contain a standalone commit named as a
frontend architecture refactor. The first tracked frontend, in bootstrap commit
`a598ab2` (2026-11-02), was a root App Router layout and one home page with a
smoke test. The current structure was introduced with the Authentication work
in `49c378d` (merged as `510ae16`, 2026-11-17); the diff adds files rather than
moving an existing feature tree.

- **Before:** one root page/layout; no auth feature, protected route group,
  server API adapter, or product UI modules existed in the tracked source.
- **Problem / context:** the Authentication scope added public auth forms,
  callbacks, recovery, protected screens, session checks and API orchestration.
  The change needed owners for these responsibilities. This is inferred from
  the change set; the commit does not record a separate refactor rationale.
- **Decision:** keep Next route entrypoints and framework conventions in
  `src/app/`, feature workflows in `src/features/<feature>/`, genuinely shared
  UI in `src/components/`, transport adapters in `src/lib/`, and URL/access
  policy in `src/config/`.
- **Implementation:** `(auth)` and `(protected)` route groups keep their public
  URL paths; `src/proxy.ts` calls the explicit access policy; auth and
  application features own their UI/actions/server orchestration; Supabase and
  Nest transports remain server/browser adapters as appropriate.
- **Result / trade-off:** responsibilities are separated without adopting a
  larger feature framework or generating boilerplate layers. Route groups are
  organizational, not authorization boundaries. No historical file moves or
  independently named frontend-refactor commit can be confirmed from this
  repository's available history.

## 2. Directory responsibilities

- `src/app/`: Next entrypoints and conventions: pages, layouts, route handlers,
  metadata, loading/error boundaries and their route-specific tests. Keep
  entrypoints thin; delegate scenarios instead of building feature libraries here.
- `src/features/<feature>/`: feature UI, actions, orchestration, validation and
  models where those responsibilities actually exist.
- `src/components/`: reusable, feature-independent UI and shared layouts.
  A component used once can stay within its owning feature.
- `src/lib/`: infrastructure clients/adapters for Supabase and NestJS.
  Do not mix transport configuration with feature workflows.
- `src/config/`: named URLs, access policy and shared configuration.
  Add a Mantine theme only when there is an actual customization requirement.
- `src/utils/`: genuinely shared pure utilities, created only when needed.
  Feature-specific validation is not a global utility.
- `src/styles/`: global application CSS when needed. Component styles stay local.
- `apps/web/scripts/`: standalone web tooling only when needed. Existing
  repository-wide launchers remain in root `scripts/`.
- `src/proxy.ts`: Next request interception entrypoint; it stays outside `app/`.

Do not create empty directories, catch-all `helpers.ts` files or boilerplate
`api/model/ui` layers for every feature.

## 3. Current placement versus the approved target

Existing route groups, SSR checks and recovery security remain in the App Router.
Current feature and infrastructure ownership is:

- Auth-specific forms and actions live in `src/features/auth/`.
- Application UI and profile orchestration live in `src/features/application/`.
- Shared AuthLayout lives in `src/components/auth-layout/`.
- `src/lib/api/server.ts` contains only the NestJS HTTP transport;
  bootstrap/profile orchestration is in `src/features/application/server/`.
- Verified request-scoped session logic is in `src/features/auth/server/`.
- Access policy is in `src/config/access-policy.ts`, separate from URL constants.
- Next.js route entrypoints and special files remain under `src/app/`; route
  groups preserve public URLs.

Do not create parallel implementations or empty directories to match a template.

## 4. Dependencies and imports

The intended dependency direction is:

```text
app entrypoints -> feature scenarios/UI -> infrastructure adapters
app/feature UI -> reusable components
proxy -> access policy + Supabase infrastructure
all applicable layers -> pure config/types/utilities
```

- Reusable components must not import feature internals or `app/` entrypoints.
- Infrastructure must not depend on feature UI or route entrypoints.
- Feature UI may import its own Server Actions through the supported Next
  action boundary, never arbitrary server implementations.
- Avoid cross-feature internals. Extract genuinely shared UI or a narrow
  infrastructure adapter rather than introducing cycles.
- Use explicit imports and `import type` for browser-safe types. Avoid broad
  barrel exports, especially barrels mixing browser and server modules.
- Keep current relative imports; introducing aliases or new lint enforcement
  is a separate scoped change, not a prerequisite.
- Browser-safe API types belong in `packages/contracts`. Do not change that
  package for a file-organization refactor without demonstrated need.

## 5. Server and Client Components

Pages/layouts are Server Components by default. Keep authentication checks,
access tokens, internal URLs and authenticated NestJS fetches on the server.
Place `'use client'` on interactive leaves using hooks, events or browser APIs.
Do not mark a root/protected layout client-side to solve an import issue.

Pass only explicitly selected, serializable UI data across the boundary.
Never pass session objects, Bearer tokens or internal configuration as props.
`lib/supabase/server.ts` uses `next/headers` and the `server-only` marker.

Server-only API, session, Supabase server/config/recovery adapters and feature
orchestration import the `server-only` marker. Keep this marker out of browser
modules. Vitest unit tests mock the marker locally; production imports retain it.

## 6. Server Actions and route handlers

- New feature actions belong in `features/<feature>/actions/` with
  `'use server'`. They are callable entrypoints, not ordinary private helpers.
- Validate untrusted FormData and check authorization inside each protected
  action; a layout having run is not proof of authorization.
- Keep callbacks/HTTP handlers as `app/**/route.ts`. Helpers can be delegated,
  but do not move Next special files out of the routing tree.
- Keep redirects fixed or explicitly allowlisted. Avoid catching Next redirect
  control flow in a generic error handler; redirect after successful work.
- Return safe, typed action state. Never expose raw SDK/network exceptions.
- Existing actions are located in their owning feature's `actions/` directory.

## 7. NestJS and Supabase integration

- NestJS owns product business rules, authorization and database operations.
  Web never imports database/backend packages, Prisma, `pg` or queue libraries.
- Server API routing prefers `API_INTERNAL_URL ?? NEXT_PUBLIC_API_URL`.
  Docker uses `http://api:3001`; local Windows may use its public loopback URL.
  An explicit internal URL must not silently fall back to public routing.
- Keep Bearer requests server-side, private/no-store, bounded by a timeout,
  without following untrusted redirects. Validate API responses before rendering.
- Bootstrap is idempotent and belongs to the application-profile scenario, not
  every protected layout. Preserve POST bootstrap followed by GET me.
- Browser Supabase uses the public URL/key; server/proxy use the internal URL
  with public fallback. Preserve the shared cookie name derived from public
  configuration and existing `getAll`/`setAll` behavior.
- Recovery is an intentional isolated-client exception: no incoming login
  cookies, no persistent recovery session, recovery-only `verifyOtp` immediately
  before password update. A normal session cannot replace recovery proof.

## 8. Security invariants

- Only publishable/anon Supabase keys may reach browser code, never service-role
  keys. Do not log passwords, tokens, cookies, action bodies or callback queries.
- Verify users with Supabase `getUser`; cookie/session presence alone is not
  authorization. Backend JWT checks remain independent.
- Preserve PKCE confirmation, one-time recovery validation, token-free success
  redirects, local logout and explicit projection of profile data.
- Preserve no-store/no-referrer and recovery CSP, including public Supabase
  `connect-src` and development HMR support after client-side navigation.
- Do not weaken policy/CSP or redesign auth as part of structural cleanup.

## 9. Routes and access policy

`src/config/routes.ts` names existing pathnames. It does not define publicity,
generate route files or introduce redirect destinations from user input.
Query-state handling stays in its current handlers until separately approved.

`src/config/access-policy.ts` is the sole active policy, separate from URL
constants in `src/config/routes.ts`. Keep its exact allowlist and default-deny
semantics; changing either requires a separate security decision.

Root `/` redirects after server verification. `(auth)` provides the public
auth UI shell; `(protected)` applies the shared SSR check. Route groups do not
change public URLs and are not security boundaries on their own.
Proxy matches all routes and defaults to requiring authentication, including
new routes outside the protected group. Preserve the exact public allowlist
and narrow framework asset exceptions; never exempt arbitrary extensions or
all `/_next/data`. One separate exception forwards `POST /app` with a
`Next-Action` header to Next before Proxy's `getUser()` check, with
`Cache-Control: private, no-store`. This preserves the Next action/Flight
redirect response when a stale tab submits logout after another tab changes the
shared session. The header is not authorization and the exception is not
restricted to a particular action ID.

The logout action itself calls `getUser()` before local sign-out; it returns a
safe error when Auth is unavailable, but can clear an already missing session.
Do not infer that every action has been checked: future protected actions must
independently authenticate and authorize. Ordinary protected requests still use
Proxy's check. Keep auth callbacks/actions accessible without bouncing an
ordinary signed-in user away from recovery. Preserve the existing 303 handling
for denied POSTs.

## 10. Styling: Mantine and CSS Modules

Use Mantine components, props and design tokens for ordinary spacing, layout,
inputs and states. Do not create a CSS Module when these are sufficient.
Use colocated CSS Modules for complex responsive composition or component-owned
styles; do not implement complex responsive layouts with inline styles.

Complex components use:

```text
  src/components/auth-layout/
  AuthLayout.tsx
  AuthLayout.module.css
  AuthLayout.test.tsx
```

Small components may stay as a single file with an adjacent test.
Feature-specific equivalents belong under `features/<feature>/ui/`.
Avoid global Mantine-internal overrides. Global CSS belongs in `styles/` and
is imported by the root layout; existing Mantine stylesheet imports stay intact.
Preserve AuthLayout's `100dvh` minimum, fluid max-width, mobile padding and scroll
behavior, including the on-screen keyboard.

## 11. State management

- Local fields, visibility, pending flags and validation state stay in the
  component. Use `useState`, `useRef` and `useActionState` as appropriate.
- Server/API state remains server-owned; do not mirror session/token objects
  into a global client store or manually persist JWTs in localStorage.
- `React.cache` for verified sessions is scoped to a server render/request,
  never a module-global promise shared between users.
- Use local React context only for a real shared UI need. Lift state to the
  nearest owner before creating a shared feature model.
- Add `features/<feature>/model/` only for actual shared feature state/types.
  No Zustand, Redux, query library or new architecture layer without approval.

## 12. Validation and errors

Use pure feature-local validation functions when reuse/testing warrants
extraction. Validate HTTP/action input on the server regardless of browser checks.
Do not unify distinct login/signup/recovery password rules by accident.
Keep field errors accessible and actionable; catch failures without exposing
technical details. Recovery requests must not disclose account existence.
Distinguish unauthenticated, unavailable and successful states; never retry
invalid credentials automatically or add delays to hide a failure.

Current loading/error patterns are feature-owned: `AuthForm` and
`ForgotPasswordForm` keep local pending/status state; `RecoveryForm` and
`LogoutButton` use `useActionState`; the protected `/app` page renders the
discriminated `ProfileResult` as a safe error or profile. There are currently no
route-level `loading.tsx` or `error.tsx` files. Add route boundaries only when a
route needs them, rather than creating empty boilerplate.

## 13. Tests

Use colocated `*.test.ts`/`*.test.tsx`, Vitest and Testing Library with deterministic
SDK/API fakes. Keep route/layout tests by their entrypoints and feature tests by
the implementation. CSS tests do not establish real browser geometry.

For each scoped change run affected tests, web TypeScript, targeted ESLint and
Prettier. Reuse successful evidence when the affected code is unchanged.
Security/routing changes require default-deny, SSR, callback, action, CSP and
cookie regressions as applicable. No live users, Docker/Supabase startup, full
monorepo suite or Graphify rebuild without separate need/permission.

## 14. Adding code

For a new feature:

1. Establish approved scope, ownership and acceptance criteria.
2. Choose its feature owner. Create only the files the scenario needs.
3. Put the Next entrypoint in the appropriate route group; keep it thin.
4. Name any new URL in `config/routes.ts`. Public access requires a separate
   explicit policy decision and tests; a constant does not grant access.
5. Keep UI/client state near the form, actions in the feature, transport in lib.
6. Add colocated tests and run the targeted verification gate.

Example target, created only when such a scenario is approved:

```text
app/(protected)/documents/page.tsx
features/documents/ui/DocumentList/
  DocumentList.tsx
  DocumentList.test.tsx
features/documents/actions/upload-document.ts
features/documents/actions/upload-document.test.ts
lib/api/documents.server.ts
lib/api/documents.server.test.ts
```

This example is not permission to implement documents or add dependencies.
Use the project [nextjs-architecture skill](../../.agents/skills/nextjs-architecture/SKILL.md)
to apply this document. Authentication flow details and manual verification remain
in [AUTHENTICATION.md](./AUTHENTICATION.md); keep its flow descriptions aligned
with the implementation without duplicating this architecture standard.
