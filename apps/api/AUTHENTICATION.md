# Authentication API

The API implements ES256 JWT verification and the AppUser bootstrap/profile endpoints used by the accepted Authentication Stage C. Signup, login, email confirmation, password recovery, and SSR session handling are implemented by Supabase Auth and the web application; passwords are not sent to this API.

- Configure `DATABASE_URL`, `SUPABASE_URL` (trusted internal Auth/JWKS routing),
  `SUPABASE_ANON_KEY` (publishable or legacy anon key),
  `SUPABASE_JWT_ISSUER` (external token issuer), `SUPABASE_JWT_AUDIENCE`, and
  `SUPABASE_JWT_ALGORITHM=ES256`. No service-role key is used. Non-loopback
  production issuers require HTTPS. Local CLI issuer remains
  `http://127.0.0.1:54321/auth/v1`, even with internal Compose routing.
- JWKS comes exclusively from `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
  The guard requires an ES256 signature, configured issuer/audience, expiry,
  UUID subject, and `authenticated` role. HS256 is not enabled.
- `POST /auth/bootstrap` accepts a Bearer token and **no body/query**. Every call
  uses Auth `getUser(token)` with the public key, checks matching UUID and
  confirmed current email, then upserts by UUID. Email is not an identity key.
- `GET /auth/me` accepts the same Bearer token and no body/query; it only reads
  the existing AppUser (404 if absent), without a bootstrap or fresh Auth call.
  Both endpoints use `Cache-Control: no-store`. No CORS policy is opened.
- Database exports compiled ESM. Build/generate are offline and do not apply
  migrations. API dev retains TypeScript decorator metadata and builds its
  database dependency first. Tests build this dependency and substitute all
  database operations. The accepted local Docker Compose smoke test passed 7/7;
  this is local verification and does not establish production integration or
  deployment readiness.

## Deployment and migration gates

`packages/database/prisma/migrations/20261104000000_app_user/migration.sql` is
included in the repository. Its application state depends on the target
database and is not asserted here. Applying this migration to a production
database requires separate confirmation. The existing pgvector migration is
unchanged. No `auth.users` objects are modeled or modified. RLS has no browser
policies, and PUBLIC/anon/authenticated table privileges are revoked. Runtime
database credentials must be trusted server-only credentials able to access
the table; browser roles must not be used for API database access.

Recovery Token TTL, production ingress/TLS, production access logging, and
production environment configuration remain pending verification. The local
Compose smoke test is not production deployment evidence. Never print
tokens/keys or edit Auth tables to prepare a test user.
