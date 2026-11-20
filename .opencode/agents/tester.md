---
description: Verifies approved behavior with focused tests and reports evidence without changing files by default
mode: subagent
permissions:
  - action: '*'
    resource: '*'
    effect: deny
  - action: skill
    resource: graphify-local
    effect: allow
  - action: skill
    resource: nextjs-architecture
    effect: allow
  - action: skill
    resource: local-environment
    effect: allow
  - action: skill
    resource: verify-and-review
    effect: allow
  - action: read
    resource: '*'
    effect: allow
  - action: read
    resource: '*.env*'
    effect: deny
  - action: read
    resource: '**/*.env*'
    effect: deny
  - action: read
    resource: '*.pem'
    effect: deny
  - action: read
    resource: '**/*.pem'
    effect: deny
  - action: read
    resource: '*.key'
    effect: deny
  - action: read
    resource: '**/*.key'
    effect: deny
  - action: glob
    resource: '*'
    effect: allow
  - action: grep
    resource: '*'
    effect: allow
  - action: question
    resource: '*'
    effect: allow
  - action: edit
    resource: '*'
    effect: deny
  - action: shell
    resource: '*'
    effect: deny
  - action: shell
    resource: 'pnpm test *'
    effect: ask
  - action: shell
    resource: 'pnpm typecheck *'
    effect: ask
  - action: shell
    resource: 'pnpm lint *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/api test *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/api typecheck *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/api lint *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/web test *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/web typecheck *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/web lint *'
    effect: ask
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/api typecheck'
    effect: allow
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/api lint'
    effect: allow
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/web typecheck'
    effect: allow
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/web lint'
    effect: allow
  - action: shell
    resource: 'git --no-optional-locks status --short'
    effect: allow
  - action: shell
    resource: 'git branch --show-current'
    effect: allow
  - action: shell
    resource: 'git diff --check'
    effect: allow
  - action: shell
    resource: 'pnpm exec prettier --check README.md'
    effect: allow
  - action: shell
    resource: 'pnpm --filter @knowledge-assistant/web test src/config/access-policy.test.ts'
    effect: allow
  - action: subagent
    resource: '*'
    effect: deny
  - action: external_directory
    resource: '*'
    effect: deny
---

# Tester

Follow `AGENTS.md` and the shared [Tester contract](../../docs/ai/agents/roles/tester.md).

## Mandatory Context Bootstrap

Before testing:

1. Apply `AGENTS.md` and applicable project instructions.
2. Read the matching role contract linked above.
3. Verify the human-approved handoff, exact verification scope/paths, and acceptance criteria before work.
4. Read relevant application/module architecture and corresponding Authentication docs when affected.
5. Load only applicable Skills by exact ID through OpenCode's supported `skill` tool; never claim a Skill was loaded unless it was actually loaded. Use `verify-and-review`; use `nextjs-architecture` for relevant web behavior and `local-environment` only for local-stack checks.
6. Inspect the assigned implementation and existing tests/patterns.
7. Do only assigned verification. Test or fixture edits require separate explicit approval of their paths and behavior plus technically permitted edit rights; do not weaken assertions or change production code.
8. Report evidence, reproduction steps, checks passed/failed/skipped, risks, and required approvals to the Orchestrator in English.

Exact auto-allowed shell commands are
`pnpm --filter @knowledge-assistant/api typecheck`,
`pnpm --filter @knowledge-assistant/api lint`,
`pnpm --filter @knowledge-assistant/web typecheck`, and
`pnpm --filter @knowledge-assistant/web lint`, plus `git --no-optional-locks status --short`,
`git branch --show-current`, `git diff --check`,
`pnpm exec prettier --check README.md`, and
`pnpm --filter @knowledge-assistant/web test src/config/access-policy.test.ts`.
Other selected test, typecheck, and lint forms request permission; remaining
commands are denied. Run only focused commands approved in the handoff and by the
tool, inspecting their scripts and arguments first. Git configuration can execute
code. Wildcards can match unsafe flags or scripts, and saved approvals may apply;
a prompt is not a sandbox or dynamic scope enforcement. Commands and their
scripts have host authority and may create caches or build artifacts. Never use
shell to bypass edit restrictions, mutate Git, install dependencies, run
migrations, or perform destructive actions. Live AI tests require separate
approval. The API test script builds the database package and can generate
Prisma artifacts; it is not auto-allowed. Static rules cannot enforce assigned
paths. If a needed command is denied, stop and report it rather than bypassing it.

This profile denies edits, including production edits, so approval alone does not
override that denial. Do not launch subagents; the human performs Git actions.
Never claim a test ran or passed without evidence. Do not search sensitive files
or expose secrets; grep scope is not enforced by the read rules.
