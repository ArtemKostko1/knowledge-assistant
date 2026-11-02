# Stage 1 local development and checks

These commands describe the bootstrap configuration. Database-changing commands require a deliberate local target; static checks do not prove that a database migration ran.

## Prerequisites and local stack

- `.node-version` specifies Node 24.22.2; the root pins pnpm 12.16.1, requires Node `>=24.0.0 <27`, and `.npmrc` enables package-manager version management and strict peer dependencies. The Dockerfile pins Node 24.22.2 and installs pnpm 12.16.1. Docker Desktop with a Linux engine is needed for Compose and the Supabase CLI stack.
- `pnpm install --frozen-lockfile` uses the checked-in lockfile. `pnpm supabase:start` invokes `supabase start --exclude realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`. PostgreSQL (54322), API gateway (54321), Auth, Storage and local email preview (54324) are the intended CLI components. The excluded `vector` is not PostgreSQL's pgvector extension; `[storage.vector]` in the TOML is a separate storage feature. Supabase CLI starts its own containers, not the three Compose app containers.
- Obtain **local** key values with `pnpm exec supabase status`; do not paste output into documentation, logs or commits. Copy `.env.example` to `.env` and replace key placeholders. `.gitignore` and `.dockerignore` exclude `.env` and `.env.*` except `.env.example`, including nested Docker-context files. No AI credentials are declared; no live AI calls belong to this stage.
- To apply the only Prisma migration, point `DIRECT_URL` at local PostgreSQL (for example the host-local `127.0.0.1:54322` endpoint with your local credentials) and run `pnpm db:migrate`. This changes a database and must be used only on the intended local instance. `pnpm db:check` also needs `DIRECT_URL`, because `packages/database/prisma.config.ts` reads it during Prisma validation. The SQL creates `vector` in the `extensions` schema; neither the migration file nor the datasource declaration proves that it has run. Supabase-owned schemas are not modeled by Prisma here.
- `docker compose up --build` builds and starts web, API and worker. `docker compose down` stops these app containers without requesting volume deletion; `pnpm supabase:stop` stops the separate CLI stack. Do not delete volumes unless local data loss is intended.

### Host debugging versus Compose

Compose uses `host.docker.internal` (mapped with `extra_hosts: host-gateway`) for its database default and `SUPABASE_URL` to reach host-exposed Supabase CLI ports. Compose uses `COMPOSE_DATABASE_URL` if set, **not** the host `DATABASE_URL` in `.env`; its default is `postgresql://postgres:postgres@host.docker.internal:54322/postgres`. On the host, `.env` should set `DATABASE_URL` and `DIRECT_URL` to local `127.0.0.1:54322` endpoints; `DIRECT_URL` is used only by Prisma commands, not passed to Compose apps. `SUPABASE_URL` can be changed to `http://127.0.0.1:54321` for host tooling, but neither the API nor worker source currently reads it. Web's placeholder currently reads no environment variables. `PORT` is read by the API (default 3001).

From PowerShell in the repository root (after installing dependencies and starting the intended **local** Supabase stack):

```powershell
Copy-Item .env.example .env
# Edit .env: enter local keys and confirm DATABASE_URL/DIRECT_URL target 127.0.0.1:54322.
npm exec --offline --package=pnpm@12.16.1 -- pnpm db:migrate
npm exec --offline --package=pnpm@12.16.1 -- pnpm dev
```

If `pnpm` is on PATH, use `pnpm` instead of the offline `npm exec` wrapper. `pnpm --filter @knowledge-assistant/worker dev` also loads the root `.env` when run from the root; Turbo forwards only `DATABASE_URL` and `PORT` to dev tasks, while Node's `--env-file-if-exists` loads `.env` in API/worker app directories. A missing `.env` is tolerated by the loader, but worker then fails safely if `DATABASE_URL` is absent. Existing exported variables override the file; check the target before starting a worker. These scripts require Node 24+ and do not read `.env` in Docker production (`start` uses injected Compose environment).

`.env.example` categories: server-side `DATABASE_URL` (host worker), optional `COMPOSE_DATABASE_URL` (container worker/API override), `DIRECT_URL` (Prisma CLI), `SUPABASE_URL` (declared but unused by app source), `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (declared, not used by app source), and `PORT` (API); `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL` are explicitly **public build-facing** Next.js variables, declared but not read by current web source. Never put service-role credentials in `NEXT_PUBLIC_*`. Compose passes only `PORT`, `DATABASE_URL`, `SUPABASE_URL` to API; `DATABASE_URL`, `SUPABASE_URL` to worker; and the three public variables to web. Compose does not pass server keys to apps. Beware that public Next.js variables supplied only as Compose runtime environment do not necessarily change a client bundle built earlier by the Dockerfile.

The first `boss.start()` can **create or upgrade** pg-boss's own `pgboss` schema (default `migrate: true`); this is library DDL, separate from the Prisma-managed product/pgvector migration. The database role used by `DATABASE_URL`/`COMPOSE_DATABASE_URL` needs schema creation/alter permissions. Provision only against the intended local DB and start **one worker for initial installation/upgrade** before starting additional workers; the API does not start pg-boss or run queue migrations. Later workers use the installed version. On a failed migration, inspect permissions/version before retrying; do not point a worker at a remote DB without separate approval. pg-boss pool/background errors are fatal: worker logs generic messages without connection credentials, attempts to stop once and exits unsuccessfully; SIGINT/SIGTERM drain the queue, and stop failures also fail the process. Separately provisioning with `migrate: false` would be a different operating model and is **not** enabled here.

## Scripts and verification

Run root commands from the repository root:

| Command                                      | Configured action                                                                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Turbo persistent development tasks for apps with `dev` scripts; alternatively select one app, e.g. `pnpm --filter @knowledge-assistant/worker dev` (or `web` / `api`). |
| `pnpm build`                                 | Turbo dependency-ordered app builds (`next build` for web; `tsc -p tsconfig.build.json` for API/worker); backend/database `build` scripts run `tsc --noEmit`.          |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Turbo workspace tasks, with dependency-order configuration in `turbo.json`. No database or live AI test is part of the unit-test suite.                                |
| `pnpm format` / `pnpm format:check`          | Root Prettier write/check respectively; check is read-only.                                                                                                            |
| `pnpm db:check` / `pnpm db:migrate`          | Prisma validate / migrate deploy in the database package; `DIRECT_URL` required. Migrate changes the target database.                                                  |
| `pnpm test:e2e`                              | Playwright HTTP test against an already running API at `http://127.0.0.1:3001`; not a Turbo/default `test` task.                                                       |
| `pnpm supabase:start` / `pnpm supabase:stop` | Start CLI stack with specified excludes / stop it; these are not Compose commands.                                                                                     |

App-local scripts: web `dev` = `next dev --hostname 0.0.0.0`; API `dev` = a no-dependency `tsc --watch` launcher which starts/restarts emitted JS after successful compilation (thus preserves decorator metadata); worker `dev` = Node watch with `tsx` and root env-file loading. API/worker `build` = `tsc -p tsconfig.build.json`, `start` = `node dist/main.js`, `test` = ESM `ts-jest`/Jest with `--runInBand`. Each app has `eslint .` and `tsc --noEmit` scripts. `packages/backend` and `packages/database` have lint/typecheck/build (their build currently does not emit JS). The three config packages and contracts package have no task scripts.

Tests actually present:

- `apps/web/src/app/page.test.tsx`: Vitest in jsdom + React Testing Library renders the bootstrap page with Mantine and checks its title. No browser or navigation test.
- `apps/api/src/app.spec.ts`: Jest/ts-jest + Nest testing module + Supertest verifies `GET /health` returns 200 and `{ status: 'ok' }` in-process. `dev-metadata.spec.ts`, `dev-environment.spec.ts` and `docker-context.spec.ts` check bootstrap configuration/fixture patterns without starting a database or Docker daemon.
- `apps/worker/src/bootstrap.spec.ts` checks the local `requireDatabaseUrl` helper; `lifecycle.spec.ts` uses a deterministic fake queue to cover start, background error and stop paths. Neither connects to PostgreSQL.
- `tests/e2e/bootstrap.spec.ts`: Playwright **HTTP request fixture** against a running API's `/health`, no browser binary download or end-to-end product flow. See `tests/e2e/README.md` and `playwright.config.ts`.

`.github/workflows/check.yml` is configured for pushes to `main` and pull requests: install pinned Node/pnpm and locked dependencies, then `format:check`, `lint`, `typecheck`, `test`, `build`. It does not run the Playwright e2e test or Prisma migration. Presence of this workflow does not prove a run succeeded.

## TypeScript, lint and formatting

`packages/config-typescript/base.json` sets `strict: true`, `noUncheckedIndexedAccess: true`, ES2022, default Bundler resolution and no emit. Web adds Next's JSX/DOM config; API and worker override module/resolution to NodeNext for ESM, and API enables decorator metadata. Build-specific configs enable emit for API/worker. The shared ESLint flat config (`packages/config-eslint/index.js`) uses `typescript-eslint` recommended rules and forbids explicit `any`; web adds Next core-web-vitals/TypeScript configs and `no-restricted-imports` against server-only packages and database/queue imports. Root `.prettierrc.json` uses single quotes and trailing commas; `.prettierignore` excludes generated output, the lockfile and local Supabase state. `packages/config-prettier/index.json` has matching settings but is not referenced by the root configuration.

## Documentation findings / inconsistencies

- The Docker build occurs before Compose injects the web `NEXT_PUBLIC_*` runtime environment. For any future browser code relying on those values, a build-time deployment strategy needs review; no current web code reads them.
- Environment examples and Compose contain Supabase URLs/keys, while current app source has no Supabase SDK or API calls. The API health response is process-only; worker readiness requires a PostgreSQL connection but its unit test checks only configuration.
- The CLI TOML includes `enabled = true` entries for services excluded by the root startup script; use the actual invocation when diagnosing local components.
- The root check workflow does not exercise Playwright e2e or migrations. No database service status, migration state or CI outcome was verified as part of writing these docs.
