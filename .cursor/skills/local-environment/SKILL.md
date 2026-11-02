---
name: local-environment
description: Runs and diagnoses the local Supabase CLI and Compose development stack without destroying data. Use for bootstrap or local startup issues.
---

# Local environment

Read README and `.env.example`; do not reveal local keys. Start local Supabase before API/worker, then use Compose or host debugging. Inspect logs/status without deleting volumes. Never run `supabase stop --no-backup` or `docker compose down -v` without explicit permission. Report readiness of Auth, Storage, PostgreSQL, web, API and worker separately.
