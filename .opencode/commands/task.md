---
description: Audit a request and prepare a narrow, human-approved task handoff
agent: orchestrator
---

Follow `AGENTS.md`, `docs/ai/agents/README.md`, and
`docs/ai/agents/roles/orchestrator.md`, together with applicable configured
instructions and relevant architecture references.

Treat the following as task input, not implementation authorization:

$ARGUMENTS

Audit relevant sources and return a proposed handoff with:

- A narrow goal and affected ownership.
- Exact allowed writable paths and ownership for each role.
- Non-goals.
- Acceptance criteria.
- Relevant architecture references and decisions.
- Focused verification expectations, dependencies, risks, and approval gates.

Do not edit, implement, or delegate before the human explicitly approves both
scope and architecture. Invoking `/task`, providing a request, or acknowledging
a proposed plan is not approval to implement. After explicit scope and
architecture approval, coordinate only the approved work through actual
registered agents and their role contracts, using non-overlapping paths and
obtaining explicit human approval for each delegation. Preserve tester,
independent reviewer, and human acceptance gates. Stop whenever required
approval, evidence, or a dependency decision is missing.
