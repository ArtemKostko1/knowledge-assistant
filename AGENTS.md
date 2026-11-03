# Agent instructions

## Authority

- The human is chief engineer; approved plan does not authorize unscheduled features or future architecture changes.
- Ask before changing dependencies, architecture, security-sensitive behavior, Git workflow, CI/CD, or deployment.
- Ask separately before commit, push, PR publication, merge, release, paid AI calls, or remote migrations.
- Do not delete/revert unrelated user work. Stop and present options when blocked.

## Language and boundaries

- Speak with the human in Russian. Code, UI, documentation, commits, and PRs are in English. Use Conventional Commits.
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

## Git and Pull Request workflow

### Branching

- `main` is the protected, stable branch.
- Never implement features, fixes, or tooling changes directly on `main`.
- Create a dedicated branch from the latest `origin/main` for each scoped task.
- Use descriptive branch names: `feat/`, `fix/`, `chore/`, `ci/`, or `docs/`.
- Never force-push, rewrite shared history, or bypass GitHub branch protection rules.

### Implementation and review

- Orchestrator defines task scope, allowed paths, and acceptance criteria before implementation.
- Implementer works only within the approved scope.
- Run targeted tests and relevant quality checks before requesting review.
- Reviewer independently reviews the final changes and remains read-only.
- Resolve BLOCKER and HIGH findings before requesting commit approval.
- Do not launch unnecessary review or documentation agents for trivial changes.

### Commit and push

- Never commit or push without separate, explicit human approvals.
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

See `docs/ai/agents/` for detailed role contracts and `.cursor/skills/` for repeatable workflows.

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
