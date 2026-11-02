# Independent Infrastructure Bootstrap Review

This file retains the **original 2026-10-30 FAIL as a historical, pre-remediation snapshot** and records a separate independent 2026-10-31 review below. The later bootstrap-only PASS does not retroactively change the first review or authorize a commit. For current status, see [Second independent review (2026-10-31)](#second-independent-review-2026-10-31).

## Original independent review — historical snapshot (2026-10-30)

- Date: **2026-10-30**.
- Review status: **COMPLETED** (independent review, not remediation or acceptance).
- Reviewer session: `ses_e716c1daeffe1sJLP7Qu0w7IKp`.
- **REVIEW RESULT: FAIL.**
- Reported severity totals: **0 BLOCKER, 1 HIGH, 4 MEDIUM, 0 LOW/NIT**.
- Finding status: **all five UNRESOLVED**. Recording recommendations does not implement them or close findings.
- Stage 1 is **NOT fully accepted / NOT ready to commit before human decisions**. Recommendation: **not-ready-for-commit**.

## Provenance and scope

This document faithfully records the independent review report supplied by the orchestrator. It is separate from prior implementer runtime checks: those checks do not supersede the independent FAIL result or establish acceptance. The documentation agent did not rerun the review's verification commands. The documentation agent's own session ID is not exposed by this runtime; the orchestrator supplies it for handoff records.

The reviewer worked read-only: no code, configuration or documentation changes, installs, service startup/shutdown, migrations, or live AI calls. Verification changed generated artifacts/caches only. The reviewer read `AGENTS.md`, reviewer guidance, documentation, role and skill files, apps, packages, manifests, lockfile importers, tooling, CI, Docker, Supabase and Prisma configuration. No status output containing secrets was recorded. No commit or push was performed.

All file/line references below are from the review snapshot **before this documentation update**; README line numbers in particular have shifted.

## Findings

### 1. HIGH — Host development startup does not receive environment

**Status: UNRESOLVED.** References: `turbo.json:4`, `package.json:10`, `apps/worker/package.json:7`, `apps/worker/src/main.ts:5`, `README.md:16–18`, `docs/development.md:15–17,25`.

Turbo's strict environment mode has no `env`/`passThroughEnv` forwarding for `DATABASE_URL` or `PORT`, so it filters them even when exported by the parent process. The API/worker `tsx` scripts do not load the root `.env`. The filtered worker development command bypasses Turbo but still does not read the root `.env`.

**Evidence:** `turbo dev --dry=json` and a filtered dry run using safe synthetic `DATABASE_URL`/`PORT` values showed strict mode and empty `env`/`passThroughEnv` configuration. **Impact:** the documented host startup is not reproducible.

**Recommendation, not implemented:** explicitly load the root `.env`, narrowly scope Turbo environment forwarding, provide exact PowerShell instructions, and add a configuration-propagation test that does not require a real database.

### 2. MEDIUM — Development and production Nest decorator metadata differ

**Status: UNRESOLVED.** References: `apps/api/package.json:7–8`, `apps/api/tsconfig.json:7–8`, `apps/api/jest.config.cjs:5–6`.

`tsx` does not emit `emitDecoratorMetadata`; the `tsc` build and `ts-jest` do. **Evidence:** read-only `AppModule` imports using `node --import tsx` showed `HealthController.status` `design:returntype` as `null`, while built `dist` showed `Object`. These inspections did not open an HTTP listener.

**Impact:** the current health endpoint is not broken by this finding, but ordinary constructor dependency injection can fail in host development despite passing tests.

**Recommendation, not implemented:** use a metadata-preserving development build aligned with production and add an infrastructure constructor-injection/development-transform test.

### 3. MEDIUM — Worker lacks pg-boss error handling

**Status: UNRESOLVED.** References: `apps/worker/src/main.ts:7–8,13–20` and `apps/worker/src/bootstrap.spec.ts`.

There is no pg-boss `error` listener and no catch for bootstrap or stop rejection. The installed library forwards background/pool failures through the `error` event. **Evidence:** a synthetic instance, without database access or `start()`, had zero error listeners; emitting `error` threw. Existing tests cover only `requireDatabaseUrl`.

**Impact:** unhandled exceptions and startup/shutdown failures lack controlled diagnostics and cleanup. Compose restart behavior does not remedy host execution.

**Recommendation, not implemented:** attach an error listener before `start()`, define an explicit fatal/recoverable policy, catch startup/shutdown failures with cleanup, redact credentials, and add deterministic fake tests covering success, start failure, background error and stop failure.

### 4. MEDIUM — Docker exclusions are not recursive

**Status: UNRESOLVED.** References: `.dockerignore:1–7`, `infra/docker/Dockerfile:5–6`.

The `node_modules`, `.next`, `dist`, `.env` and `.env.*` patterns do not cover nested monorepo files, after which the Dockerfile runs `COPY . .`. **Impact:** host dependencies, stale build output and nested environment secrets may enter image layers. **No real secret-file leak was found or claimed.** Git ignore behavior is not evidence of Docker build-context exclusion.

**Recommendation, not implemented:** use recursive exclusions such as `**/node_modules`, `**/.next`, `**/dist`, `**/.env`, `**/.env.*`, an example-file allow rule and cache exclusions; verify the build context using safe fixtures.

### 5. MEDIUM — pg-boss migration ownership is undocumented

**Status: UNRESOLVED.** References: `apps/worker/src/main.ts:7–8`, `docs/architecture.md:11,14`, `docs/development.md:10,39`, `README.md:17,20`.

The default `migrate: true` means `boss.start()` can create/migrate the library-owned `pgboss` schema; it is not just a connectivity check. Inspection of the installed library showed its contractor handles schema creation/migrations. Existing docs explain the Prisma extension migration but not this separate schema/DDL side effect.

**Impact:** startup's DDL behavior, schema ownership and required database permissions are not documented or governed by an agreed policy.

**Recommendation, not implemented:** document ownership and DDL permissions, and obtain a human decision between local automatic migration and separately provisioning the schema with `migrate: false`. Do **not** automatically move the library-owned schema into Prisma. This review does not prove any queue schema was actually created or migrated.

## Reviewer checks and evidence

These are the **reviewer's reported checks**, not checks rerun by the documentation agent and not proof that unresolved runtime gaps are fixed.

- Host: `node --version` reported **26.12.1**; pnpm version was **12.16.1**. Docker/CI **Node 24.22.2** was inspected statically only.
- `Test-Path node_modules/.bin/pnpm.cmd` returned false. pnpm was invoked using the existing offline cache: `npm exec --offline --package=pnpm@12.16.1 -- pnpm`. No installation was performed.
- `git status`: all bootstrap files untracked. `git diff` and cached diff were empty, so files were inspected directly rather than treating empty diffs as a clean implementation review.
- `format:check`: **PASS**.
- `pnpm exec turbo lint typecheck test --force`: **PASS**, 13 tasks, no cache hits; web 1, API 1 and worker 2 tests.
- `turbo build --force`: **PASS**, 5 tasks. Backend/database produced no-output warnings because their build scripts use `tsc --noEmit`.
- `db:check` with a temporary local `DIRECT_URL`: **PASS for schema validation only**. It provides no database connection or migration-application evidence.
- `turbo dev --dry=json` and a filtered safe synthetic environment dry run confirmed finding 1; no development services were started.
- Node metadata inspections confirmed finding 2 without an HTTP listener.
- ESLint `calculateConfigForFile` confirmed explicit-`any` and forbidden-import rules at error level.
- Synthetic PgBoss inspection without `start()` or database access confirmed finding 3.
- `playwright test --list` discovered **1 test**; the HTTP test was **not executed**.
- `docker compose config --services` listed exactly `api`, `web`, `worker`, with no duplicate database service.
- `docker ps` failed because the Docker Desktop Linux daemon was unavailable.
- `git check-ignore` confirmed nested environment files are Git-ignored and `.env.example` is allowed; this does not resolve finding 4.

## Limitations and non-findings

**Unverified:** Docker image runtime on Node 24; Supabase Auth, Storage and PostgreSQL; applied pgvector migration; actual queue schema startup/recovery; and actual Playwright HTTP execution. The reasons were the read-only scope with no service/migration permission and the unavailable Docker daemon. Static configuration, schema validation, unit tests and successful builds cannot substitute for these checks.

The following were **not defects** in the agreed bootstrap scope: absent future authentication, tenant behavior, CRUD, AI and product jobs; placeholder shared modules; and absent product browser tests. Process-only health is intentional. The runtime-only `NEXT_PUBLIC_*` caveat was already documented, and the current page does not use those variables. CI statically matches the main scripts but misses the identified runtime gaps. Role configuration files do not prove that agents ran or are available in a given session.

## Next human gate

Fix the HIGH finding within separately authorized implementation scope, agree human decisions for the MEDIUM findings, perform explicitly permitted runtime verification, and then obtain human acceptance. **All findings remain UNRESOLVED at this handoff; stage 1 is NOT fully accepted and NOT ready to commit before human decisions.** Commit and push require separate approval. This documentation records findings only and claims no remediation.

## Second independent review (2026-10-31)

- Reviewer session: `ses_e7156190bffeRdx7e2JYIh9EIE`.
- Reviewed after Platform Implementer remediation session: `ses_e71604a33ffeTWqXKRF3tyqFYk`.
- **REVIEW RESULT: PASS for bootstrap-only scope.** All five original findings are **RESOLVED on configuration/tests**; **no new BLOCKER or HIGH findings** were reported. This is a new review result, not a revision of the original FAIL.
- Stage 1 bootstrap is accepted **by this independent review only**. Human acceptance and explicitly permitted runtime integration validation remain pending. This PASS is **not commit authorization**; commit/push require separate human approval.

### Current status of original findings

1. **Host development environment (original HIGH): RESOLVED on configuration/tests.** `turbo.json` forwards only `DATABASE_URL` and `PORT` to `dev`; API and worker development processes load the root `.env` using Node's `--env-file-if-exists`. The configuration test and safe synthetic Turbo dry-run passed. This does not prove a host worker can connect to PostgreSQL.
2. **Nest development decorator metadata (original MEDIUM): RESOLVED on configuration/tests.** The API development launcher compiles with `tsc --watch` using the production build config and runs emitted JS; metadata tests and built JS inspection showed `design:paramtypes`/design metadata. The watch process itself was **not run on Windows/Node 24**.
3. **Worker pg-boss error handling (original MEDIUM): RESOLVED on configuration/tests.** An `error` listener is attached before `start()`; startup, background and shutdown failures use credential-safe messages, one-time cleanup and unsuccessful exit status. Deterministic fake tests cover successful startup/signal shutdown, start rejection, background error and stop rejection. A real pg-boss/PostgreSQL session was **not run**.
4. **Recursive Docker exclusions (original MEDIUM): RESOLVED on configuration/tests.** `.dockerignore` now excludes nested dependency/build/cache directories and `.env` variants while allowing `.env.example`; fixture/configuration tests passed. Actual Docker build-context contents and image layers were **not verified** because the daemon was unavailable.
5. **pg-boss migration ownership (original MEDIUM): RESOLVED in documentation/configuration.** [Development](../development.md) and [architecture](../architecture.md) distinguish pg-boss's library-owned `pgboss` schema, automatically created/upgraded by worker startup with default `migrate: true`, from Prisma-managed product schema/pgvector migration. They specify DDL-capable database credentials and one worker at initial provisioning. Neither actual pg-boss DDL nor migration application was checked against a database.

### Second reviewer checks and limits

The following are the **second reviewer's reported checks**, not runtime integration results or checks rerun by the documentation agent:

- `format:check`: **PASS**.
- Forced `lint typecheck test`: **PASS, 13/13 tasks**; API **5**, worker **6**, web **1** tests.
- Build: **PASS, 5/5 tasks**.
- Prisma `db:check`: **PASS for schema validation only**, not a connection or applied-migration check.
- `docker compose config --services`: listed `web`, `api`, `worker` (order immaterial).
- Safe synthetic Turbo dry-run confirmed development environment forwarding; metadata and Docker configuration tests checked the revised source/configuration.
- `docker info` failed: the Docker daemon was unavailable. No image/context build or container execution was validated.

**Still unverified:** host worker-to-database startup, real pg-boss behavior/DDL, Docker image and context, applied Prisma migrations, HTTP end-to-end execution, and the Node 24 container runtime; the API `tsc --watch` process was not exercised on Windows/Node 24. The PASS covers bootstrap configuration and tests only. A human must authorize any runtime/database-changing checks as appropriate, decide acceptance, and separately authorize any baseline commit or push.

## Focused runtime verification

This later verification updates the outstanding runtime status without changing either historical reviewer result above.

- The initial runtime attempt failed because the worker did not shut down gracefully. The Docker Compose worker command was then changed to invoke Node directly, with a 40-second stop grace period.
- The current orchestrator session subsequently observed two successful stop/start cycles, both exiting 0. These cycles were **not performed by the Tester**.
- Tester session `ses_e6400f2e4ffeFfRWgg26i7TKr4` then reported **PASS** for focused runtime verification, including the two graceful stop/start cycles. The graceful-shutdown runtime issue is **RESOLVED**.
- Checks 1–11 from that Tester report remain applicable and retained as prior verification; the final focused Tester did **not** repeat runtime checks 1–11. Do not treat them as newly rerun by the final Tester.
- The Tester also reported global pnpm **12.16.1**, `pnpm format:check` **PASS**, `pnpm lint` **PASS (5/5)**, and `pnpm typecheck` **PASS (5/5)**.

The five findings from the original review are **RESOLVED** as detailed under the second review above. The initial missing-pnpm-in-subagent-PATH and Turbo lookup failures were subsequently resolved when global pnpm became available and the reported checks succeeded. These were tooling-environment issues, not remaining findings.

The remaining deferred deployment concern is that the generic shared image default `CMD` outside Docker Compose still uses the pnpm/shell path. This is a deployment concern, not a blocker for the verified local bootstrap scope; no claim is made that it was validated in deployment.

**Status:** bootstrap infrastructure verification is complete for the current local scope. The original Reviewer **FAIL** (2026-10-30) remains in the record; the independent Reviewer **PASS** (2026-10-31) and subsequent focused Tester runtime **PASS** are later, distinct results. These results are not commit authorization and do not certify product features. No additional verification is claimed here beyond the supplied reports.
