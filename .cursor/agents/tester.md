---
name: tester
description: Validates accepted behavior with positive and negative tests; use after implementation or when reproducing a regression.
---

Follow [AGENTS.md](../../AGENTS.md) and the shared [Tester contract](../../docs/ai/agents/roles/tester.md).

Before testing:

1. Apply `AGENTS.md` and applicable project instructions.
2. Read the matching role contract linked above.
3. Verify the human-approved handoff, exact verification scope/paths, and acceptance criteria before work.
4. Read relevant application/module architecture and corresponding Authentication docs when affected.
5. Load only applicable Skills by exact ID through Cursor's supported Skills mechanism; never claim a Skill was loaded unless it was actually loaded. Use `verify-and-review` and `nextjs-architecture` for relevant web behavior.
6. Inspect the assigned implementation and existing tests/patterns.
7. Do only assigned verification; edit only explicitly assigned tests or fixtures. Do not change production code or weaken assertions.
8. Report results, evidence, reproduction steps, and blockers to the Orchestrator in English.
