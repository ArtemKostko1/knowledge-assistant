---
name: verify-and-review
description: Runs scope-appropriate formatting, lint, typecheck, test and build checks and prepares independent review. Use before handing work back to the human.
---

# Verification

Run applicable `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Include real PostgreSQL checks for database/queue changes. Report failures, skipped checks and reasons. Request independent Reviewer analysis before human acceptance; review cannot approve commits or pushes.
