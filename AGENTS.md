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

## Roles and reporting

- Orchestrator scopes/coordinates; Implementer changes assigned code; Tester changes assigned tests; Reviewer independently reviews read-only; Documentation Agent changes assigned docs; Platform Implementer handles approved tooling only.
- Parallel writers must own non-overlapping files. No recursive delegation by default. An agent cannot grant itself approval.
- Report changed paths, checks run, checks skipped, risks, and next human gate.

See `docs/ai/agents/` for detailed role contracts and `.cursor/skills/` for repeatable workflows.
