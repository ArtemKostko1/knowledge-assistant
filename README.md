# Knowledge Assistant

Knowledge Assistant is a pnpm/Turborepo monorepo for a customer-support
knowledge-assistant product. The current implementation provides a Supabase
Authentication flow, a protected Next.js application shell, and NestJS
authenticated-user bootstrap/profile endpoints.

Knowledge-base CRUD, organization membership and role authorization, document
processing, retrieval, chat/widget behavior, billing, and product worker jobs
are not implemented. Local infrastructure configuration is not evidence of
production deployment or readiness.

## Quick start

Prerequisites are Node.js `24.22.2` (see `.node-version`), pnpm `12.16.1`, and
Docker Desktop with the Linux engine. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm supabase:start
pnpm exec supabase status
```

Copy `.env.example` to `.env`, fill in the local Supabase values, and verify
`DATABASE_URL` and the effective `DIRECT_URL` point to the intended local
database. Supply `DIRECT_URL` in the environment of the process running pnpm;
do not assume the database scripts load the root `.env`. Check the target
privately without printing the credential URL. Never commit `.env` or use these
instructions to target a remote database. See
[Development](docs/development.md#local-supabase-environment-and-database) for
environment precedence and verification limits. Apply local Prisma migrations
only after checking the effective target:

```sh
pnpm db:migrate
```

Before starting Compose, privately verify that the effective
`COMPOSE_DATABASE_URL` targets exclusively the intended local database.
Shell or environment values can override the value in `.env`; verify the
effective value, not just the file. Do not run Compose if the target is unknown
or unconfirmed. Never print the full connection string or credentials to a
terminal, report, or log. Compose passes this value to the API and worker as
`DATABASE_URL`; the pg-boss worker may create or upgrade its database schema.

```sh
docker compose up --build
```

The web client is at <http://localhost:3000>, the API at
<http://localhost:3001>, and Supabase's local email preview at
<http://localhost:54324>. `GET /health` is a process-level API check; it does
not verify PostgreSQL or Supabase availability. For host development, environment
setup, individual app commands, and the full verification list, see
[Development](docs/development.md).

## Documentation

- [System architecture, boundaries, decision history, and current limitations](docs/architecture.md)
- [Local development, environment, scripts, and tests](docs/development.md)
- [Frontend architecture and implementation patterns](apps/web/ARCHITECTURE.md)
- [Frontend Authentication flow](apps/web/AUTHENTICATION.md)
- [NestJS API architecture, HTTP contracts, errors, and logging](apps/api/ARCHITECTURE.md)
- [API Authentication contract](apps/api/AUTHENTICATION.md)
- [Current direct dependency inventory](docs/dependencies.md)
- [AI-agent rules](AGENTS.md) and [agent role boundaries](docs/ai/agents/README.md)

Authentication and the local Compose smoke test have been accepted for the
current local scope; this does not establish production readiness. Production
ingress/TLS, access-log review, environment configuration, recovery-token TTL
verification, and target-database migration approval remain separate gates.
