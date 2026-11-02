# Knowledge Assistant

Customer support knowledge base project at **stage 1: bootstrap only**. The current web page is a placeholder, the API exposes only `GET /health`, and the worker starts a queue without product jobs. Authentication integration, knowledge-base CRUD, document processing, chatbot, billing, and product authorization are **not implemented yet**.

**Bootstrap verification status:** the [2026-10-30 original review](docs/reviews/bootstrap-review.md#original-independent-review--historical-snapshot-2026-10-30) remains a historical **FAIL** (0 BLOCKER, 1 HIGH, 4 MEDIUM); the [2026-10-31 independent re-review](docs/reviews/bootstrap-review.md#second-independent-review-2026-10-31) was **PASS for bootstrap-only scope**, resolving the five findings on configuration/tests. Subsequent focused [Tester verification](docs/reviews/bootstrap-review.md#focused-runtime-verification) passed the reported runtime checks and global checks. Bootstrap infrastructure verification is complete for the current local scope; this is not product readiness or commit authorization, and does not certify product features. Human acceptance and separate commit/push authorization remain required.

## Prerequisites

- Node.js 24.22.2 (`.node-version`) and pnpm 12.16.1 (the current container image pins these versions).
- Docker Desktop with the Linux engine and sufficient RAM for the local Supabase stack.
- No hosted Supabase project, Redis, or local LLM is required.

## Local startup

1. `pnpm install --frozen-lockfile`
2. `pnpm supabase:start` (the Supabase CLI starts the configured local stack, excluding optional services via the root script; the excluded `vector` service is a log shipper, not the PostgreSQL pgvector extension).
3. `pnpm exec supabase status` to obtain the **local** anon and service role keys. Never commit these keys.
4. Copy `.env.example` to `.env` and replace placeholder keys. Its `DATABASE_URL` and `DIRECT_URL` use `127.0.0.1` for host commands; Compose independently defaults to `host.docker.internal` (override with `COMPOSE_DATABASE_URL` if needed). See [local setup](docs/development.md). Placeholder keys must not be used as real credentials.
5. For the bootstrap pgvector extension migration, set `DIRECT_URL` to your local PostgreSQL connection (host debugging uses `127.0.0.1:54322`) and run `pnpm db:migrate`. This is a database-changing operation; do not run it against a remote database by accident.
6. `docker compose up --build` to start the web, API and worker; alternatively run `pnpm dev` or start individual apps with `pnpm --filter @knowledge-assistant/api dev` (similarly `web` or `worker`) from the host. The API development process compiles with `tsc --watch` to preserve Nest metadata, and API/worker load the root `.env` on the host. The worker may create/upgrade the library-owned `pgboss` schema at startup; use only an intended local database with appropriate DDL permissions and start one worker for initial provisioning.

Web: <http://localhost:3000>. API process health: <http://localhost:3001/health> (not a database or Supabase health probe). The worker starts pg-boss and registers no product jobs yet. Local email preview: <http://localhost:54324>.

To stop the application: `docker compose down`; to stop Supabase without deleting its volumes: `pnpm supabase:stop`. Do not use volume deletion unless you intend to lose local data.

## Checks

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

With the local API running, `pnpm test:e2e` performs a bootstrap Playwright HTTP smoke check. It is not part of the default offline unit-test command.

`DIRECT_URL` must be set when running `pnpm db:check`. The bootstrap has only the pgvector extension migration and no product models. See [development and tests](docs/development.md).

## Structure and process

`apps/web` (Next.js + Mantine), `apps/api` (NestJS HTTP), `apps/worker` (pg-boss process), `packages/contracts` (browser-safe placeholder), `packages/backend` (server-only placeholder), `packages/database` (Prisma skeleton), `supabase` (local CLI stack), `infra/docker` (application images). See [architecture and current boundaries](docs/architecture.md), [local development](docs/development.md), and [direct dependency inventory](docs/dependencies.md). Agent role guidance lives in `AGENTS.md` and `docs/ai/agents/`.

## Known limitations

The bootstrap verifies wiring and tooling, not product behavior. Compose supplies `NEXT_PUBLIC_*` values as container runtime environment rather than Docker build arguments; changing them at runtime does not necessarily change the client bundle. Any live AI smoke-test is planned for a later stage and needs explicit approval.
