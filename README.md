# Knowledge Assistant

Customer support knowledge base project with Authentication implemented as a product feature. Supabase-backed signup, login, email confirmation and password recovery, protected web routes, and NestJS JWT-authenticated AppUser bootstrap/profile endpoints are implemented. Knowledge-base CRUD, document processing, chatbot, billing, and organization-level product authorization remain **unimplemented**.

**Bootstrap verification status:** the [2026-10-30 original review](docs/reviews/bootstrap-review.md#original-independent-review--historical-snapshot-2026-10-30) remains a historical **FAIL** (0 BLOCKER, 1 HIGH, 4 MEDIUM); the [2026-10-31 independent re-review](docs/reviews/bootstrap-review.md#second-independent-review-2026-10-31) was **PASS for bootstrap-only scope**, resolving the five findings on configuration/tests. Subsequent focused [Tester verification](docs/reviews/bootstrap-review.md#focused-runtime-verification) passed the reported runtime checks and global checks. Bootstrap infrastructure verification is complete for the current local scope; this is not product readiness or commit authorization, and does not certify product features. Human acceptance and separate commit/push authorization remain required.

**Authentication status:** Stage C is accepted; Next.js 16.4.6 and the recovery logging fix are accepted; AUTH-001 and AUTH-002 are Verified. The local Docker Compose smoke test passed 7/7. These results are local acceptance evidence, not production deployment verification; see the Authentication documents for remaining gates.

## Prerequisites

- Node.js 24.22.2 (`.node-version`) and pnpm 12.16.1 (the current container image pins these versions).
- Docker Desktop with the Linux engine and sufficient RAM for the local Supabase stack.
- No hosted Supabase project, Redis, or local LLM is required.

## Local startup

1. `pnpm install --frozen-lockfile`
2. `pnpm supabase:start` (the Supabase CLI starts the configured local stack, excluding optional services via the root script; the excluded `vector` service is a log shipper, not the PostgreSQL pgvector extension).
3. `pnpm exec supabase status` to obtain the **local** anon and service role keys. Never commit these keys.
4. Copy `.env.example` to `.env` and replace placeholder keys. Its `DATABASE_URL` and `DIRECT_URL` use `127.0.0.1` for host commands; Compose independently defaults to `host.docker.internal` (override with `COMPOSE_DATABASE_URL` if needed). See [local setup](docs/development.md). Placeholder keys must not be used as real credentials.
5. Prisma migrations include the pgvector extension and the AppUser table. Before running `pnpm db:migrate`, verify that `DIRECT_URL` identifies the intended database (host debugging uses `127.0.0.1:54322`). Applying the AppUser migration to a production database requires separate confirmation; do not run migrations against a remote database by accident.
6. `docker compose up --build` to start the web, API and worker; alternatively run `pnpm dev` or start individual apps with `pnpm --filter @knowledge-assistant/api dev` (similarly `web` or `worker`) from the host. The API development process compiles with `tsc --watch` to preserve Nest metadata, and API/worker load the root `.env` on the host. The worker may create/upgrade the library-owned `pgboss` schema at startup; use only an intended local database with appropriate DDL permissions and start one worker for initial provisioning.

Web: <http://localhost:3000>. API process health: <http://localhost:3001/health> (not a database or Supabase health probe). The worker starts pg-boss and registers no product jobs yet. Local email preview: <http://localhost:54324>.

To stop the application: `docker compose down`; to stop Supabase without deleting its volumes: `pnpm supabase:stop`. Do not use volume deletion unless you intend to lose local data.

## Checks

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

With the local API running, `pnpm test:e2e` performs a bootstrap Playwright HTTP smoke check. It is not part of the default offline unit-test command.

`DIRECT_URL` must be set when running `pnpm db:check`. The Prisma schema includes the AppUser identity model; it does not model or modify Supabase Auth tables. See [development and tests](docs/development.md).

## Structure and process

`apps/web` (Next.js + Mantine Authentication UI), `apps/api` (NestJS HTTP and JWT-authenticated profile endpoints), `apps/worker` (pg-boss process), `packages/contracts` (browser-safe profile contract), `packages/backend` (server-only placeholder), `packages/database` (Prisma AppUser model and access), `supabase` (local CLI stack), and `infra/docker` (application images). See [architecture and current boundaries](docs/architecture.md), [local development](docs/development.md), and [direct dependency inventory](docs/dependencies.md). Agent role guidance lives in `AGENTS.md` and `docs/ai/agents/`.

## Known limitations

Authentication Stage C and the local Compose smoke test are accepted, but do not establish production readiness. Recovery Token TTL, production ingress/TLS, production access logging, and production environment configuration remain pending. Recovery URLs may remain in browser history. Applying the AppUser Prisma migration to a production database requires separate confirmation. Compose supplies `NEXT_PUBLIC_*` values as Docker build arguments and runtime environment; these public values are embedded in the client bundle at build time, so changing runtime values alone does not update the bundle. Any live AI smoke-test is planned for a later stage and needs explicit approval.
