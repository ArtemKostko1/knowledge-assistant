# Authentication

This document describes the current authentication implementation and local
verification scenarios. Directory ownership, import boundaries, styling,
testing conventions and access-policy rules are defined in
[ARCHITECTURE.md](./ARCHITECTURE.md).

**Accepted status:** Authentication Stage C passed; Next.js 16.4.6 is accepted;
AUTH-001 and AUTH-002 are Verified. The local Docker Compose smoke test passed
7/7. This is local acceptance evidence, not production deployment verification.

## Routes and modules

| URL                                    | App Router entrypoint                    | Responsibility                                |
| -------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| `/signup`, `/login`                    | `src/app/(auth)/{signup,login}/page.tsx` | Browser Supabase signup/login forms           |
| `/forgot-password`, `/update-password` | `src/app/(auth)/.../page.tsx`            | Recovery request and invalid/direct-access UI |
| `/auth/confirm`                        | `src/app/auth/confirm/route.ts`          | PKCE confirmation callback                    |
| `/auth/recovery`                       | `src/app/auth/recovery/page.tsx`         | Token-bearing recovery form                   |
| `/`                                    | `src/app/page.tsx`                       | Server-verified root redirect                 |
| `/app`                                 | `src/app/(protected)/app/page.tsx`       | Protected profile page                        |

Auth UI and actions live in `src/features/auth/`; application profile
orchestration, logout UI and action live in `src/features/application/`.
Shared responsive presentation is in `src/components/auth-layout/`.
Supabase/NestJS adapters remain in `src/lib/`, and route constants and access
policy are separate modules in `src/config/`.

## Signup, login and confirmation

The client-side auth form calls Supabase Auth directly using the public browser
client. Passwords are never sent to NestJS. Signup asks Supabase to return to
`/auth/confirm`; the GET callback exchanges the PKCE code through the SSR client
and returns a fixed, token-free login URL. The PKCE verifier requires opening
the link in the browser that initiated signup.

The browser and SSR clients use the same cookie name derived from the public
Supabase hostname. The SSR client bridges Next.js cookies; the Proxy refreshes
the session and forwards cookie changes. Only a publishable key or legacy anon
key is accepted in browser configuration.

## Password recovery

`/forgot-password` returns the same message for all Auth outcomes to avoid
revealing whether an account exists. The recovery email links directly to
`/auth/recovery?token_hash=...`.

Rendering `/auth/recovery` validates the token's shape but does not consume it.
The feature Server Action calls the recovery adapter, which creates an isolated,
nonpersistent client without login cookies, verifies the one-time token using
`verifyOtp(type: 'recovery')`, then calls `updateUser`. It signs out only that
temporary recovery session. Success redirects to a fixed token-free login URL.
Direct `/update-password` access does not grant recovery authority.

Confirmation and recovery token routes use private/no-store and no-referrer
headers. Their CSP restricts connections to self and the public Supabase origin;
development additionally allows the local HMR websocket. Do not put third-party
scripts or analytics on token-bearing pages, and ensure infrastructure logs omit
callback query strings and action bodies.

The recovery URL contains `token_hash`; it may remain in browser history. This is
a known limitation and is not resolved by the response headers or development
request-log fix.

## SSR sessions, access policy and root routing

`src/features/auth/server/session.ts` uses request-scoped `React.cache`, reads
the SSR session, and verifies its exact access token with Supabase `getUser()`.
It does not trust cookie data alone or globally cache user credentials.
`(protected)/layout.tsx` uses this verification before rendering protected
children. The root route redirects verified users to `/app` and others to
`/login`; an Auth outage renders a safe error.

`src/config/access-policy.ts` is the single exact public-auth allowlist.
`src/proxy.ts` matches all routes and denies anonymous requests not explicitly
allowed, including unknown product routes and paths outside `(protected)`.
Nested auth paths are not implicitly public. Only the listed Next static/image/
HMR assets and favicon bypass the auth check. Token-flow routes avoid importing
or refreshing an unrelated login session. Denied POSTs use 303; ordinary auth
routes remain usable for signed-in users.

Route groups organize the UI; they do not replace Proxy or server checks.
Server Actions and backend endpoints must enforce their own authorization when
they perform protected operations.

## Application profile and logout

The protected `/app` feature calls `loadApplicationProfile()` on the server.
It verifies the Supabase user, sends `POST /auth/bootstrap` without a body or
query, then `GET /auth/me` with the same Bearer token. NestJS owns the
idempotent AppUser creation and authorization. The profile is validated against
the verified user ID and explicitly projected before rendering; credentials
and unexpected API fields are not passed to UI props.

`src/lib/api/server.ts` is the server-only HTTP transport. It adds the Bearer
header, disables caching, uses a bounded timeout and rejects redirects.
Application orchestration converts failures into safe UI messages.

The logout Server Action calls Supabase `signOut({ scope: 'local' })`, clears
the current browser session and redirects to a fixed login URL. Other devices
and AppUser records are not deleted. On failure the UI reports a safe error
without claiming success.

Supabase SSR cookies are shared across tabs. To preserve the App Router Server
Action response when a stale tab submits logout after another tab changed the
session, Proxy forwards only `POST /app` requests carrying Next.js's
`Next-Action` marker to the framework handler. This marker is not authorization:
the logout action checks the current session with `getUser()` before local
sign-out, while all other protected requests retain Proxy's `getUser()` check.
This cross-tab fix is tracked as AUTH-001 and Verified. Every product Server
Action must enforce its own authorization.

## Local API configuration

- Local Windows development normally sets `NEXT_PUBLIC_API_URL` to
  `http://127.0.0.1:3001`. `API_INTERNAL_URL` is optional; when set it takes
  precedence and an invalid explicit value does not fall back.
- Docker web runtime sets server-only `API_INTERNAL_URL=http://api:3001`.
- Browser code never calls or receives `API_INTERNAL_URL`. Supabase browser
  configuration uses its public URL; server/proxy configuration may use the
  internal Supabase URL while retaining the same cookie identity.

## Local verification

The deterministic web tests use SDK/API fakes and do not create users or call
live Supabase. Run focused tests from the repository root, for example:

```sh
pnpm --filter @knowledge-assistant/web exec vitest run \
  src/features/auth/ui/AuthForm/AuthForm.test.tsx \
  src/features/auth/ui/ForgotPasswordForm/ForgotPasswordForm.test.tsx \
  src/features/auth/server/session.test.ts \
  src/lib/supabase/recovery.test.ts \
  src/config/access-policy.test.ts \
  src/proxy.test.ts \
  'src/app/(protected)/app/page.test.tsx'
```

For manual acceptance, use an already approved local test account and existing
project workflow:

1. Sign up, follow the confirmation email in the same browser, then sign in.
   Verify first login reaches `/app` and displays the matching profile.
2. Reload `/app`; bootstrap should be safe to repeat and the profile should
   remain the same. Confirm API requests are server-to-server.
3. Request a recovery email. Opening/reloading its link must not consume the
   token; successful update must allow first login with the new password.
   Check expired/replayed links and recovery while another account is signed in.
4. Test logout, direct `/app` access after logout, anonymous unknown/nested
   routes, public auth routes and asset/HMR loading.
5. Check recovery CSP/connect-src and responsive auth layout on a narrow or
   short viewport, including with the on-screen keyboard.

The user-confirmed final Authentication Stage C browser acceptance passed all
five groups: cross-tab account switching (no Runtime Error), post-logout
protection, recovery links, RecoveryForm validation/toggle, and CSP/protected
routes/first login after recovery. Recovery for User A with User B signed in
was separately confirmed to update only User A's password. These are manual
acceptance results, not E2E test output.

These manual checks require the existing local Supabase/API setup; they are not
performed by the deterministic test command.

## Remaining verification and pre-deployment gates

- **Recovery Token TTL:** Pending Verification; acceptance of invalid/replayed
  links does not establish the exact configured expiry boundary.
- **Production access logging:** AUTH-002 verified the Next.js development
  request-logging fix. Production ingress, access logs and telemetry still need
  verification; do not infer production log safety from the local fix.
- **Production ingress/TLS:** Pending.
- **Production environment configuration:** Pending, including deployment
  redirects and build-time public variables.
- **Browser history:** recovery URLs may remain in browser history; this is a
  known limitation.
- **Prisma migration:** applying the AppUser migration to a target production
  database requires separate confirmation.
- **Docker Compose:** the local smoke test passed 7/7; it is not a production
  deployment or ingress/TLS check.
