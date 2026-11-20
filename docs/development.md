# Development Guide

Commands and configuration below are taken from the current root and workspace
manifests, Compose file, Supabase CLI configuration, and CI workflow. They
describe local development, not production deployment. Never run database
commands against a remote or otherwise unintended target.

## Prerequisites and installation

- Node.js `24.22.2` (`.node-version`) and pnpm `12.16.1` (root
  `packageManager`).
- Docker Desktop with the Linux engine for the local Supabase stack and
  Compose.

From the repository root:

```sh
pnpm install --frozen-lockfile
```

The pnpm workspace selects `apps/*` and `packages/*`. The Supabase CLI project
is configured separately in `supabase/config.toml`.

## Local Supabase, environment and database

Start the configured local Supabase services and inspect their local settings:

```sh
pnpm supabase:start
pnpm exec supabase status
```

The root script excludes optional services from the CLI invocation. PostgreSQL
uses port `54322`, the Supabase API/Auth endpoint uses `54321`, and the local
email preview is available at `54324`. The CLI service named `vector` is a log
shipper; it is not the PostgreSQL `pgvector` extension.

Copy `.env.example` to `.env` and configure local values. Do not copy real keys
into documentation, terminal transcripts, or commits. Relevant variable names:

- Host API/worker database and Prisma CLI: `DATABASE_URL`, `DIRECT_URL`.
- Compose API/worker database: `COMPOSE_DATABASE_URL` is required and passed
  to both services as `DATABASE_URL`.
- Host API Auth settings: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`,
  `SUPABASE_JWT_ALGORITHM`, and optional `PORT`/`LOG_LEVEL`.
- Compose Supabase routing: `COMPOSE_SUPABASE_URL`; Compose passes it as
  `SUPABASE_URL` to the API and `SUPABASE_INTERNAL_URL` to the web server.
- Next public build inputs: `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The example also declares `SUPABASE_SERVICE_ROLE_KEY`; current application
  source does not use it. Never expose a service-role/secret key to browser
  code or put one in a `NEXT_PUBLIC_*` variable.

On the host, use loopback URLs for local Supabase. Containers use
`host.docker.internal` to reach the host-published services; Compose's
`COMPOSE_DATABASE_URL` is separate from host `DATABASE_URL`. Verify all targets
before starting apps or applying migrations.

The root `db:check` and `db:migrate` scripts delegate to the database
workspace's `prisma validate` and `prisma migrate deploy` commands. The Prisma
config reads `process.env.DIRECT_URL`, falling back to an empty string when it
is unset. Its comment describes generate/validate as offline and migration as
requiring `DIRECT_URL`. The manifests do not explicitly load the root `.env`
for these database commands. Whether the installed pnpm/Prisma combination
loads an env file implicitly, and whether validation succeeds with an empty
URL, has not been verified here; do not assume either behavior.

For migrations, explicitly provide the intended local `DIRECT_URL` in the
environment inherited by pnpm and privately verify the effective host, port
and database before running the command. Do not print the URL or credentials.
An already exported value can differ from the value in `.env`; verify the
effective process environment rather than only the file. In the Node
`--env-file` and `--env-file-if-exists` development launchers described below,
an existing process environment value takes precedence over the file. Those
launchers are separate from the database scripts and do not establish their
environment loading behavior.

`pnpm db:check` runs Prisma schema validation; the config does not unconditionally
require a nonempty `DIRECT_URL`. To generate the Prisma client without applying
a migration:

```sh
pnpm --filter @knowledge-assistant/database db:generate
```

To apply the checked-in Prisma migrations to the configured database:

```sh
pnpm db:migrate
```

This changes the target database. Confirm the effective `DIRECT_URL` points to
the intended local PostgreSQL instance first. The migrations include the
AppUser table and the pgvector extension; neither a schema file nor a migration
file proves it has been applied. Supabase-owned schemas are not managed by
Prisma here.

## Run the applications

For the Compose application stack, with required values configured in `.env`:

```sh
docker compose up --build
```

Compose starts `client` (port 3000), `api` (port 3001), and `worker` (no
published port). It does not start Supabase; start that separately as above.
`NEXT_PUBLIC_*` values are build arguments and are embedded by Next.js during
the image build. Runtime environment changes alone do not update the built
browser bundle.

For host development, `pnpm dev` delegates the workspace development tasks to
Turbo. `pnpm dev:local` runs only web and API. To select one app:

```sh
pnpm --filter @knowledge-assistant/web dev
pnpm --filter @knowledge-assistant/api dev
pnpm --filter @knowledge-assistant/worker dev
```

The API's development launcher compiles with `tsc --watch` and starts the
emitted JavaScript so Nest decorator metadata is preserved. The API and worker
load the root `.env` in their development scripts. The worker starts pg-boss;
its first startup can create or upgrade the library-owned `pgboss` schema.
Use an intended local database with schema DDL permissions and start one worker
for initial provisioning. The worker currently registers no product jobs.

The web is at <http://localhost:3000>, API process health is at
<http://localhost:3001/health>, and Supabase email preview is at
<http://localhost:54324>. `/health` does not check PostgreSQL, Supabase Auth,
or worker readiness. Stop the app containers with `docker compose down` and
the CLI stack with `pnpm supabase:stop`; do not remove volumes unless local
data loss is intended.

## Workspace scripts and verification

Run root commands from the repository root:

| Command                                      | Configured action                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Turbo development tasks for packages with a `dev` script.                                                                         |
| `pnpm dev:local`                             | Root launcher for web and API development tasks.                                                                                  |
| `pnpm build`                                 | Turbo build tasks; Next.js builds web, TypeScript builds API/worker, and database build generates Prisma Client before compiling. |
| `pnpm lint`                                  | Turbo lint tasks.                                                                                                                 |
| `pnpm typecheck`                             | Turbo typecheck tasks.                                                                                                            |
| `pnpm test`                                  | Turbo test tasks; normal tests use deterministic fakes and do not require live AI or a database.                                  |
| `pnpm format` / `pnpm format:check`          | Root Prettier write/check commands.                                                                                               |
| `pnpm db:check` / `pnpm db:migrate`          | Prisma schema validation / migration deployment; see the `DIRECT_URL` warning above.                                              |
| `pnpm test:e2e`                              | Playwright HTTP smoke check against an already running API at `http://127.0.0.1:3001`.                                            |
| `pnpm supabase:start` / `pnpm supabase:stop` | Supabase CLI stack lifecycle, separate from Compose.                                                                              |

Targeted tests:

```sh
pnpm --filter @knowledge-assistant/web exec vitest run
pnpm --filter @knowledge-assistant/api test
pnpm --filter @knowledge-assistant/worker test
```

Web tests use Vitest, jsdom and Testing Library. API tests use Jest/ts-jest and
Supertest; feature unit tests are colocated under `src/modules`, while
application/bootstrap/HTTP tests live in `apps/api/test/`. The API test script
builds the database package and its Prisma client but substitutes database and
Auth operations in tests. Worker tests use deterministic queue fakes. The
root Playwright test is an HTTP request fixture, not a browser flow. See
[web Authentication verification](../apps/web/AUTHENTICATION.md) and
[the e2e test note](../tests/e2e/README.md) for scope.

## TypeScript, Turbo and CI

`packages/config-typescript/base.json` enables `strict` and
`noUncheckedIndexedAccess`. Web adds Next/DOM settings; API and worker use
NodeNext ESM, and API enables decorator metadata. API local imports use `.js`
specifiers. ESLint uses flat configuration; the web config also blocks imports
of server-only persistence and queue packages. Root Prettier settings are
authoritative; `packages/config-prettier` is not referenced by root config.

Turborepo runs `build` after upstream builds, and lint/typecheck after their
upstream tasks. In `turbo.json`, database `typecheck` additionally depends on
its own `build`; both package scripts invoke `db:generate`. This orders the two
generations within a single Turbo invocation. It does not coordinate separate
Turbo/pnpm processes that use the same checkout.

`.github/workflows/check.yml` runs `format:check`, `lint`, `typecheck`, `test`,
and `build` on pull requests to `main` and pushes to `main`. It does not run
`test:e2e` or apply Prisma migrations. The Prisma-generation ordering fix is
present in `main`; this guide does not claim a post-fix GitHub Actions run
passed. Check the actual workflow result for the branch/PR being reviewed.

## Troubleshooting notes

- **API Auth configuration fails:** verify the local public Supabase URL/key,
  issuer, audience, algorithm, and database URL. Do not replace the JWT issuer
  with a container-internal hostname; it must match the token issuer.
- **Container cannot reach local PostgreSQL/Supabase:** use the Compose
  variables and `host.docker.internal`; host processes use loopback. Do not
  confuse `DATABASE_URL` and `COMPOSE_DATABASE_URL`.
- **Prisma cannot connect or validate:** check `DIRECT_URL` and its target.
  `db:generate` is local code generation; `db:migrate` changes a database.
- **Web still uses previous public configuration:** Next `NEXT_PUBLIC_*`
  values are build-time inputs; rebuild the client image.
- **Worker cannot start:** check local database reachability and whether the
  database role can create/upgrade pg-boss's schema. A worker is not yet
  processing product jobs.
- **Health check returns 200 while dependencies are unavailable:** expected;
  `/health` is process-only.
