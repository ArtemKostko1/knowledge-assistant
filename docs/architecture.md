# System Architecture

This document describes the checked-in source and configuration at the current
`main` snapshot. It does not claim a production deployment, successful current
CI run, or database migration state. The repository's architecture evolved from
the November 2026 monorepo bootstrap through the Authentication, API, type-safety,
and Prisma task-ordering work; relevant commits are listed below.

## Product scope

Implemented: Next.js Authentication UI and protected application shell; Supabase
Auth-backed signup, login, email confirmation and password recovery; NestJS
JWT verification and AppUser bootstrap/profile endpoints; Prisma persistence
for the AppUser model; API health endpoint; and a pg-boss worker process.

Not implemented: organization membership/role authorization, knowledge-base or
document CRUD, ingestion, embeddings/retrieval, chat/widget, billing, queue
producers/handlers, and product background jobs. Supabase Storage is configured
for local development but is not used by current application code. The
`/health` endpoint reports API process health only.

## System overview

```mermaid
flowchart LR
  Browser[Browser] --> Web[Next.js web]
  Web -->|Signup, login, recovery, user verification| Auth[Supabase Auth]
  Web -->|Server-side Bearer requests| API[NestJS API]
  API -->|JWKS and getUser(token)| Auth
  API --> UserRepo[AppUserRepository]
  UserRepo --> DBPackage[packages/database]
  DBPackage --> PG[(PostgreSQL)]
  Worker[Worker] --> Queue[pg-boss]
  Queue --> PG
```

The browser owns presentation and starts user-facing Supabase Auth flows. The
Next.js server verifies sessions and calls the API without exposing access
tokens to Client Components. The API independently verifies the Bearer JWT,
re-checks the current Supabase user for bootstrap, and owns AppUser writes.
`packages/database` owns Prisma client construction, schema and migrations.
The worker currently starts pg-boss against PostgreSQL but registers no product
jobs. Supabase-owned Auth/Storage schemas are not modeled or migrated by Prisma.

## Monorepo and ownership

The pnpm workspace includes `apps/*` and `packages/*`. Supabase configuration,
Docker/Compose, root scripts, end-to-end smoke tests and GitHub Actions live
outside the pnpm workspace.

| Path                                                             | Responsibility and current boundary                                                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                       | Next.js 16 App Router, React 19, Mantine UI, Supabase browser/SSR clients, protected route handling, and server-side API orchestration. It does not own product CRUD or final authorization.   |
| `apps/api`                                                       | NestJS 12 HTTP application. Feature modules own controllers/providers; API owns business rules, JWT verification and authorization decisions. Current feature modules are `auth` and `health`. |
| `apps/worker`                                                    | Node.js process using pg-boss. It owns asynchronous jobs when introduced; currently it starts the queue and handles lifecycle failures, with no product jobs.                                  |
| `packages/contracts`                                             | Browser-safe TypeScript contract for `AppUserProfile`, consumed by web and API.                                                                                                                |
| `packages/database`                                              | Server-only Prisma client, `AppUser` schema and migrations, and database factory. It does not own HTTP DTOs or Supabase-managed schemas.                                                       |
| `packages/backend`                                               | Server-only placeholder; no application service is currently implemented or imported by API/worker source.                                                                                     |
| `packages/config-typescript`, `config-eslint`, `config-prettier` | Shared compiler, lint and formatter configuration. The root Prettier configuration is authoritative for root commands.                                                                         |
| `infra/docker`, `compose.yaml`                                   | Multi-stage application image and local `client`, `api`, and `worker` containers. Supabase CLI services run separately.                                                                        |
| `supabase`                                                       | Local Supabase CLI configuration, including PostgreSQL, Auth, Storage and email preview. Configuration does not imply a hosted deployment.                                                     |
| `tests/e2e`                                                      | Playwright HTTP smoke test for an already-running API; it is not a browser product-flow suite.                                                                                                 |

### Dependency and trust boundaries

- Web imports browser-safe contracts only; it must not import Prisma,
  `packages/database`, `pg`, queue packages, or other server-only modules.
- Web sends authenticated API requests from server code. `API_INTERNAL_URL`
  takes precedence over `NEXT_PUBLIC_API_URL`; the bearer token remains
  server-side.
- The API derives the authenticated principal from a verified JWT, not from a
  client-provided organization or user ID. Organization-level product
  authorization does not exist yet and must not be implied by the current
  Authentication guard.
- API repositories use `packages/database`; Prisma models are projected into
  explicit HTTP contracts. Do not expose Prisma models as API responses.
- The worker is the owner for future async processing. Queue handlers must be
  idempotent; no product handler currently exists.
- Supabase supplies Auth and local PostgreSQL/Storage services. The current
  application uses Auth; it does not expose Storage or document listing.

## Current HTTP surface

The API currently exposes:

- `GET /health` → `{ "status": "ok" }`; process-only health.
- `POST /auth/bootstrap` → verifies the authenticated Supabase user and
  upserts its AppUser record; accepts no body or query.
- `GET /auth/me` → returns an existing AppUser profile; accepts no body or
  query and does not create the profile.

Authentication endpoints use Bearer JWT verification and `Cache-Control:
no-store`. Web route groups organize pages but are not security boundaries:
the Next.js Proxy, server operations and API each enforce their own
responsibility. See [API architecture](../apps/api/ARCHITECTURE.md),
[API Authentication](../apps/api/AUTHENTICATION.md), and
[web Authentication](../apps/web/AUTHENTICATION.md) for the detailed contracts.

## Architecture evolution and decision record

The available Git history begins at `a598ab2` (2026-11-02) and ends at
`b87990f` (2026-11-19), the current `main` snapshot. Short SHAs below identify
the implementation commits; where the repository does not record a rationale,
the note is labeled as an architectural interpretation rather than historical
fact. There is no separate ADR directory in the current documentation tree;
this section records the decisions without introducing a new ADR system.

### Frontend structure and Authentication — `49c378d`, merged as `510ae16`

- **Before:** the bootstrap commit `a598ab2` contained a root App Router layout,
  a single home page, and its smoke test.
- **Problem / context:** the Authentication change introduced public auth
  screens, protected application UI, callbacks, recovery, session verification,
  and authenticated API orchestration. The commit adds these as distinct
  responsibilities. The commit does not state a separate architecture-refactor
  rationale.
- **Decision / implementation:** keep Next App Router entrypoints under
  `src/app/`, organize auth and application behavior under
  `src/features/<feature>/`, share feature-independent UI through
  `src/components/`, and isolate Supabase/API transport in `src/lib/`.
  Route groups `(auth)` and `(protected)` preserve URL paths; `src/proxy.ts`
  applies the explicit access policy.
- **Result / trade-off:** routes and feature responsibilities are separated
  while server/client boundaries remain explicit. The history shows new files,
  not a rename/move of an earlier feature tree; no independent frontend-refactor
  commit is available. Historical detail and current rules are in
  [Frontend Architecture](../apps/web/ARCHITECTURE.md).

### Modular NestJS API — `6d8a09a`, merged as `2fea9bb`

- **Context:** Authentication/API concerns initially lived in a small bootstrap
  layout; more endpoints required explicit feature ownership.
- **Decision / implementation:** organize API features under
  `apps/api/src/modules/<feature>/`, keep `AppModule` as the composition root,
  and keep shared HTTP infrastructure under `src/common/`.
- **Rationale / trade-off:** current module boundaries and DI avoid placing all
  behavior in a single application module. Feature modules export only
  providers with a concrete external consumer; `packages/backend` remains a
  placeholder rather than a required extra layer.

### Supabase Authentication and persistence boundary — `49c378d`, `510ae16`

- **Decision / implementation:** Supabase Auth handles user signup, login,
  confirmation and recovery. The API verifies configured ES256 JWTs and
  performs a fresh `getUser(token)` check when bootstrapping. API code uses
  `AppUserRepository` and `packages/database`; web owns SSR/session and
  server-to-server API integration.
- **Rationale / trade-off:** provider identity is checked independently by the
  API and the AppUser record is keyed by the verified UUID. This implements
  Authentication only; it does not implement organization membership, roles,
  or authorization for future product resources.
- **Migration boundary:** Prisma owns `AppUser` and the repository's product
  migrations. Supabase Auth tables/schemas remain Supabase-owned. A migration
  file being present does not prove it has been applied to any database.

### OpenAPI, HTTP errors and safe logging — `680af90`/`35a3987`,

`89bdbf6`/`cf517ca`, `2800283`/`a0c848a`

- **OpenAPI:** Swagger decorators and response classes describe actual API
  endpoints. `/docs` and `/docs-json` are enabled by default outside production;
  `SWAGGER_ENABLED=false` disables them. They are always disabled in
  production. Runtime HTTP behavior remains the source of truth; OpenAPI must
  match it.
- **HTTP errors:** one typed formatter is shared by the Nest global filter and
  the isolated Express parser boundary. Request IDs are generated by the
  server; arbitrary exception fields/messages are not trusted or serialized.
  The adapter preserves unknown exception provenance until the safe filter.
- **Logging:** `SafeLogger` wraps Nest's `ConsoleLogger`; application events
  are projected through a runtime allowlist. Production output is JSON Lines;
  normal events go to stdout and error/fatal events to stderr. The trade-off is
  intentional loss of raw exception diagnostics and no delivery guarantee on
  broken output or abrupt termination.
- **Compatibility:** these boundaries preserve existing response contracts,
  Authentication `no-store`, and request-ID correlation. Changes to HTTP
  payloads, headers, logging record shape, or runtime policy require separate
  approval.

### Stage 5 type safety and contracts — `ddf1855`/`dbb1ed1`,

`b0fc788`/`c41c087`, `f8e460e`/`676f732`, `a591821`/`8545375`,
`6b63bb8`/`a558ec2`

- **Scope A — Prisma to HTTP DTO projection:** API response types no longer
  expose Prisma model types. `AppUserProfile` is browser-safe; the API selects
  fields, converts dates to ISO strings, and declares a Swagger response class.
- **Scope B — Supabase runtime type safety:** the SDK user response is treated
  as untrusted at the boundary and checked before its ID, email, and
  confirmation state are used.
- **Scope C — unknown error handling:** unknown HTTP/parser errors are handled
  without trusting arbitrary object properties. Regression tests were restored
  in the separate follow-up `8545375` (#12).
- **Scope D — authenticated principal typing:** pre-authentication requests
  model identity as optional; the guard assigns a verified `CheckedIdentity`
  before protected controller use.
- **Scope E — logging event type audit:** no production code changed. The
  runtime event allowlist remains in force. Two P2 compile-time constraints
  remain documented technical debt: completion `statusCode` is not correlated
  with `outcome`, and failed-event `statusCode`/`errorCode` types permit
  semantically inconsistent combinations. Runtime projection still validates
  and normalizes records. Do not describe proposed type refinements as
  implemented.

### Prisma generation ordering — `6459688`, merged as `b87990f` (#14)

Both `@knowledge-assistant/database#build` and
`@knowledge-assistant/database#typecheck` run Prisma Client generation into the
same package output directory. `turbo.json` makes database `typecheck` depend
on its same-package `build`, in addition to upstream dependencies, so the two
generation steps do not run concurrently within one Turbo invocation. This
does not serialize independent Turbo/pnpm processes sharing a checkout.
The fix is present in `main`; this documentation does not assert that a
post-fix GitHub Actions run passed. The configured workflow is
`.github/workflows/check.yml`.

## Operational configuration

`compose.yaml` runs the application containers (`client`, `api`, `worker`).
The Supabase CLI starts its local services separately. Containers reach
host-exposed Supabase/PostgreSQL ports using `host.docker.internal`; host
processes use loopback URLs. Public `NEXT_PUBLIC_*` values are supplied to the
Next build and become part of the client bundle; changing only container
runtime values does not rebuild that bundle.

The root Supabase start script excludes optional CLI services, including the
CLI's `vector` log shipper; this is distinct from the PostgreSQL `pgvector`
extension migration. The worker's first pg-boss startup can create or upgrade
its own `pgboss` schema. Start only one worker for initial provisioning and use
an intended local database with the required DDL permissions. See
[Development](development.md) for commands, environment categories, checks,
and local database safeguards.

## Related documentation

- [Frontend architecture](../apps/web/ARCHITECTURE.md) and
  [Authentication flow](../apps/web/AUTHENTICATION.md)
- [API architecture](../apps/api/ARCHITECTURE.md) and
  [Authentication API](../apps/api/AUTHENTICATION.md)
- [Development workflow](development.md)
- [Direct dependencies](dependencies.md)
- [AI-agent instructions](../AGENTS.md) and [agent roles](ai/agents/README.md)
