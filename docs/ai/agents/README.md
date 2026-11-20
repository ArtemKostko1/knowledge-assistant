# AI Agent Roles and Handoffs

The human owns architecture approval, security-sensitive decisions, scope
approval, and Git/PR operations. An agent cannot approve its own proposed
architecture or changes. These role descriptions supplement the repository
[AGENTS.md](../../../AGENTS.md); the active human-approved task scope and harness
remain authoritative.

## Required workflow

**Orchestrator → human architecture/scope approval → Implementer → Tester →
independent Reviewer → human acceptance and Git/PR.**

- **Orchestrator:** audits the repository, proposes a narrow scope, ownership,
  non-goals, acceptance criteria and verification plan. Implementation does not
  start before human approval.
- **Implementer:** changes only approved paths and behavior. Escalates
  dependencies, architecture, security, CI/CD or deployment changes before
  proceeding.
- **Tester:** verifies focused real scenarios and reports passed, failed and
  skipped checks. Does not weaken assertions or silently change production code.
- **Reviewer:** performs a read-only final review in a separate execution
  context. A check by the implementer is not independent review.
- **Documentation Agent:** updates documentation after comparing claims with
  checked-in behavior; does not describe planned behavior as implemented.
- **Security Reviewer:** performs read-only review of authentication, tenancy,
  invitations, widgets and secrets when that scope warrants it.
- **Platform Implementer:** changes only approved scripts, Docker or CI paths;
  does not create remote resources or perform destructive infrastructure
  actions without approval.

## Handoff requirements

Follow the shared language policy in [AGENTS.md](../../../AGENTS.md). It is
instructional, not enforced by agent tool permissions. Russian incident
documents are separate from English agent-to-agent reports.

Every handoff states the task, allowed paths, non-goals, acceptance criteria,
verification expectations and approval gates. Parallel writers must have
non-overlapping file ownership. Do not launch additional agents without
explicit authorization.

By default, the human performs `git add`, commit, push, PR publication, merge,
and other Git/PR state changes. An agent may perform a specific operation only
if the owner explicitly changes this rule for that task; separate approvals
for commit, push, publication and merge still apply.
