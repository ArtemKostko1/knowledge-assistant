# Agent instructions

## Authority

- The human is chief engineer; approved plan does not authorize unscheduled features or future architecture changes.
- Ask before changing dependencies, architecture, security-sensitive behavior, Git workflow, CI/CD, or deployment.
- Ask separately before commit, push, PR publication, merge, release, paid AI calls, or remote migrations.
- Do not delete/revert unrelated user work. Stop and present options when blocked.

## Language and boundaries

- Speak with the human in Russian. Code, UI, documentation, commits, and PRs are in English. Use Conventional Commits.
- For all agents and future tasks, use English for agent-to-agent handoffs,
  prompts, acceptance criteria, technical instructions, and reports, regardless
  of the owner's language. The Orchestrator communicates with the project
  owner in Russian and accurately translates or adapts internal reports.
  Preserve existing language conventions for code, documentation, filenames,
  and contracts; do not automatically translate them. The Documentation Agent's
  approved Russian incident documentation under `docs/problems/` is an artifact
  exception, not an exception for agent-to-agent reports.
- Web owns UI/API interaction, not product database CRUD or final authorization decisions.
- API owns business rules and authorization. Worker owns async jobs. Supabase provides Auth, PostgreSQL, Storage and pgvector.
- Browser-safe contracts belong in `packages/contracts`; never import server-only packages or Prisma into web.
- Verify membership and role for every protected operation, scope all resources to organization, and do not trust client-provided organization IDs.
- Public widget identifiers are not credentials. Never expose Storage or document listing to visitors.

## Quality and safety

- Use strict TypeScript, runtime validation of HTTP input, ESLint flat config and Prettier. Do not hide build errors.
- Product schema uses Prisma Migrate; vector SQL must be parameterized. Supabase-owned schemas are excluded.
- Make queue handlers idempotent. Live AI tests require approval; normal tests use deterministic fakes.
- Do not store chat content in the DB or ordinary logs. Do not log tokens or API keys. Commit `.env.example` only, never `.env`.
- Add focused tests for the changed scope; run applicable format, lint, typecheck, tests and build checks.

## Backend / NestJS Engineering Standards

- Apply SOLID, DRY, KISS, YAGNI, separation of concerns, and low coupling / high cohesion. Prefer the smallest design that solves a current requirement.
- Organize `apps/api` by feature under `src/modules/<feature>/`. Keep `AppModule` as the composition root; each feature module owns its controllers and providers.
- Use NestJS dependency injection and explicit module boundaries. Export only providers required by another module. Avoid cyclic imports and do not introduce base classes, generic abstractions, or shared folders without a real consumer.
- Keep strict TypeScript. Avoid `any`, unsafe assertions, and implicit public contracts; declare return types for exported functions and public service/repository methods.
- Validate external HTTP input at runtime with explicit DTOs and validation at the transport boundary. Do not add placeholder DTOs to endpoints that intentionally accept no input. Any new validation dependency requires approval.
- Keep controllers focused on HTTP concerns, services on business orchestration, and repositories on persistence. Keep external SDKs and persistence details behind their owning feature/package boundaries.
- Add focused tests for new and changed behavior. Keep feature unit tests beside the feature; place application-level, integration, and bootstrap tests under `apps/api/test/`. Prefer deterministic fakes over live external services.
- Preserve existing HTTP routes, status codes, headers, payloads, and security behavior unless a separately approved change explicitly requires otherwise.
- Every new or modified NestJS HTTP endpoint must include accurate Swagger/OpenAPI documentation, typed request/response contracts, applicable security metadata, documented response status codes, and appropriate tests.
- API HTTP errors use the global `APP_FILTER` and shared typed error contract. Preserve intended HTTP statuses; use stable error codes and safe allowlisted messages. Never serialize arbitrary exception response objects or expose internal errors, causes, stack traces, SQL, credentials, tokens, authorization headers, cookies, request bodies, or chat/document content.
- The API generates a fresh server UUID request ID per request, ignores incoming `X-Request-ID`, returns `X-Request-ID`, and includes the same ID in error responses and safe diagnostics. Keep query strings and user-controlled URL values out of error paths and logs.
- Express parser errors must use the shared error formatter and be covered through the actual HTTP pipeline. Preserve middleware/parser ordering and Authentication `Cache-Control: no-store`.
- API logging uses the shared SafeLogger and typed allowlisted events. Never pass raw requests, responses, Error objects, arbitrary messages, credentials, cookies, tokens, body/query data, SQL, email, or chat/document content to application logs. Nest system calls are normalized by the safe adapter.
- Keep request completion logging before Authentication/parser middleware. Emit at most one completion per request; successful GET /health 200 is excluded. Exception boundaries own one 5xx diagnostic; completion is a separate event. Preserve request ID correlation and test real HTTP lifecycle events.
- Production logging is JSON Lines on stdout/stderr; LOG_LEVEL accepts only info/debug and cannot disable error/fatal. Do not introduce transports, ALS, tracing or external monitoring without separate approval.
- Keep `packages/database` responsible for Prisma client/schema/migrations and `packages/contracts` browser-safe. Do not move product CRUD or server-only dependencies into web.

## Frontend / Next.js Standards

- Keep App Router entrypoints thin under `apps/web/src/app/`; place feature
  behavior in `src/features/<feature>/`, reusable feature-independent UI in
  `src/components/`, and external transport adapters in `src/lib/`.
- Server Components are the default. Use Client Components only for interactive
  leaves; keep tokens, session objects and internal configuration server-side.
- Route groups organize pages but do not grant access. Preserve the explicit
  default-deny access policy, verify users server-side, and enforce authorization
  inside each protected Server Action and API operation.
- Use `src/lib/api/server.ts` for server-to-server API transport and
  `packages/contracts` for browser-safe shared types. Web does not own product
  database CRUD or final authorization and must not import Prisma/database/queue
  packages.
- Validate untrusted action/form input on the server, return safe typed UI
  states, and do not expose raw SDK/network errors. Preserve authentication,
  recovery, cookie, redirect, CSP and cache invariants.
- Prefer Mantine components/tokens; add CSS Modules or shared abstractions only
  for a real repeated responsibility. Keep deterministic Vitest/Testing
  Library tests with the owning route or feature.
- Follow [Frontend Architecture](apps/web/ARCHITECTURE.md) and
  [Frontend Authentication](apps/web/AUTHENTICATION.md) for concrete examples.

## Git and Pull Request workflow

### Branching

- `main` is the protected, stable branch.
- Never implement features, fixes, or tooling changes directly on `main`.
- Create a dedicated branch from the latest `origin/main` for each scoped task.
- Use descriptive branch names: `feat/`, `fix/`, `chore/`, `ci/`, or `docs/`.
- Never force-push, rewrite shared history, or bypass GitHub branch protection rules.

### Implementation and review

- Orchestrator defines task scope, allowed paths, and acceptance criteria before implementation.
- The Orchestrator audits and proposes; the human approves architecture and
  scope before code implementation starts.
- Implementer works only within the approved scope.
- Tester verifies the approved behavior with focused tests and reports results.
- Reviewer independently reviews the final changes in a separate context and
  remains read-only. A self-check is not independent review.
- Resolve BLOCKER and HIGH findings before requesting commit approval.
- Do not launch unnecessary review or documentation agents for trivial changes.

### Commit and push

- Never commit or push without separate, explicit human approvals.
- By default, the human performs `git add`, commit, push, PR publication, merge,
  and other Git/PR state changes. An agent may do a specific operation only if
  the owner explicitly changes this rule for that task; required separate
  approvals still apply.
- Before commit, report changed files, relevant checks, review result, and remaining risks.
- Stage only explicitly approved files.
- Run `git diff --cached --check` and inspect staged changes.
- Use Conventional Commits.
- Never commit credentials, secrets, generated artifacts, or unrelated changes.
- Push only the approved feature branch after separate human approval.
- Never push directly to `main`.

### Pull Requests and CI

- Create Pull Requests targeting `main` only after explicit human approval.
- Every PR must describe its purpose, changes, verification results, and known risks.
- GitHub Actions `Check / verify` must pass before merge.
- Do not bypass required status checks or modify repository protection settings without approval.
- Local Reviewer is the primary AI code reviewer.
- GitHub Copilot Code Review is optional and requested manually when appropriate.
- Do not enable automatic AI reviews without human approval.

### Merge and cleanup

- Never merge a PR without explicit human approval.
- Prefer Squash and Merge to keep `main` history concise.
- Do not merge with failing or pending required CI checks.
- After merge, synchronize local `main` using `git pull --ff-only origin main`.
- Delete completed feature branches only after verifying a successful merge.
- Report the merge commit, final CI status, and remaining risks.

### Efficiency

- Prefer targeted verification during implementation.
- Run full CI automatically through GitHub Actions on Pull Requests.
- Avoid repeating successful checks when the affected scope has not changed.
- Update documentation at meaningful feature or milestone boundaries.
- Keep agent handoffs and reports concise to minimize AI usage.

## Roles and reporting

- Orchestrator scopes/coordinates; Implementer changes assigned code; Tester changes assigned tests; Reviewer independently reviews read-only; Documentation Agent changes assigned docs; Platform Implementer handles approved tooling only.
- Parallel writers must own non-overlapping files. No recursive delegation by default. An agent cannot grant itself approval.
- Report changed paths, checks run, checks skipped, risks, and next human gate.

See [system architecture](docs/architecture.md), [development workflow](docs/development.md),
[API architecture](apps/api/ARCHITECTURE.md), [frontend architecture](apps/web/ARCHITECTURE.md),
and `docs/ai/agents/` for detailed role boundaries. `.cursor/skills/` contains
repeatable repository workflows.

## AI Execution Budget and Efficiency

### Task scope

- One Implementer run must handle one narrowly scoped task.
- Do not autonomously implement an entire feature or milestone.
- Define allowed paths and acceptance criteria before implementation.
- Do not expand the scope without human approval.
- Prefer the cheapest capable model and low reasoning by default.
- Use higher reasoning only for specific complex problems.

### Agent execution

- Do not launch additional subagents without explicit approval.
- Do not repeatedly read unrelated repository files.
- Reuse verified findings instead of repeating investigations.
- Limit autonomous fix-and-retest attempts to two per defect.
- If still blocked, stop and report the problem.
- Stop immediately after completing the approved acceptance criteria.

### Testing and review

- Run targeted tests during implementation.
- Run full regression checks at milestone or PR gates.
- Do not repeat successful expensive checks unless relevant code changed.
- Use one independent Reviewer for a completed logical change.
- Use Security Reviewer for security-sensitive changes.
- Update documentation at feature or milestone completion.

### Usage control

- Preserve AI allowance for testing, review, and unexpected issues.
- Follow tool-enforced token, cost, or iteration budgets when available.
- If no hard budget is supported, use small tasks and human checkpoints.
- Report progress and blockers concisely.
- Never start the next task automatically.

### Completion report

Report:

- Completed work and changed paths.
- Tests passed, failed, or skipped.
- Remaining risks and blockers.
- Next recommended small task.
- Required human approval.

Do not continue implementation after the report.
