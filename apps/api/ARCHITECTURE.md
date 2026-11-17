# API Architecture

## Scope

The API is a NestJS 12 ESM application. This document describes the checked-in
source structure and boundaries; it does not claim production deployment or
database migration state. The accepted Authentication behavior and HTTP
contracts are documented in [AUTHENTICATION.md](./AUTHENTICATION.md).

## Source tree

```text
apps/api/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ common/
│  │  └─ http/
│  │     ├─ api-error.ts
│  │     ├─ api-error.spec.ts
│  │     ├─ api-error.response.ts
│  │     ├─ express-error.middleware.ts
│  │     ├─ http-exception.filter.ts
│  │     ├─ parser-application.ts
│  │     ├─ request-context.ts
│  │     ├─ request-id.middleware.ts
│  │     └─ safe-express.adapter.ts
│  ├─ config/
│  │  ├─ swagger.config.ts
│  │  └─ swagger.config.spec.ts
│  └─ modules/
│     ├─ health/
│     │  ├─ health.controller.ts
│     │  └─ health.module.ts
│     └─ auth/
│        ├─ app-user.repository.ts
│        ├─ app-user.repository.spec.ts
│        ├─ app-user-profile.response.ts
│        ├─ auth-http.ts
│        ├─ auth.controller.ts
│        ├─ auth.controller.spec.ts
│        ├─ auth.guard.ts
│        ├─ auth.module.ts
│        ├─ auth-user.service.ts
│        ├─ auth-user.service.spec.ts
│        ├─ jwt-verifier.ts
│        ├─ jwt-verifier.spec.ts
│        └─ config/
│           ├─ auth.config.ts
│           └─ auth.config.spec.ts
├─ test/
│  ├─ app.spec.ts
│  ├─ http-errors.spec.ts
│  ├─ main.spec.ts
│  ├─ openapi.spec.ts
│  ├─ dev-environment.spec.ts
│  ├─ dev-metadata.spec.ts
│  └─ docker-context.spec.ts
├─ scripts/
│  └─ dev.mjs
├─ jest.config.cjs
├─ tsconfig.json
├─ tsconfig.build.json
├─ package.json
├─ AUTHENTICATION.md
└─ ARCHITECTURE.md
```

## Responsibilities

- `src/main.ts` creates the Nest application, enables shutdown hooks, installs
  request-ID and Authentication middleware before the body parser, configures
  Swagger, mounts the isolated parser application, initializes Nest, and
  listens. Automatic Nest parser registration is disabled; the isolated
  application registers the Nest Express parsers once with their default
  settings and handles their errors immediately after those parsers.
- `src/app.module.ts` is the composition root and imports `HealthModule` and
  `AuthModule` and registers the global HTTP exception filter through
  `APP_FILTER`; it does not implement endpoints.
- `src/common/http` owns the cross-cutting error contract, safe formatter,
  request-ID context, Nest exception filter, Express parser-error boundary,
  and reusable Swagger response schema. Auth-specific authorization and
  business behavior remain in `modules/auth`.
- `modules/health` owns `GET /health`, which returns `{ "status": "ok" }`.
  Health is process-level and does not assert database or Supabase readiness.
- `modules/auth` owns Authentication HTTP behavior, guards, JWT verification,
  Supabase Auth integration, AppUser persistence orchestration, and its
  feature-specific config. `AuthModule` exports no providers because no other
  current module consumes them.
- `modules/auth/config` contains Authentication-only configuration. Put
  genuinely application-wide configuration in `src/config/` only when it
  exists; do not create a generic configuration layer for one feature.
- Feature unit tests stay beside their implementation. `apps/api/test/` holds
  application composition/HTTP, bootstrap, environment, and tooling tests.
  Repository-level Playwright tests remain in the root `tests/e2e/`.
- `scripts/dev.mjs` keeps the API-specific development compiler and restart
  behavior. Preserve emitted Nest decorator metadata.

## Dependency boundaries

```text
main.ts -> AppModule -> HealthModule
                     -> AuthModule -> AuthConfig
                                   -> Supabase Auth / jose
                                   -> AppUserRepository
                                      -> @knowledge-assistant/database
```

- `HealthModule` has no Authentication dependency.
- `AuthModule` owns and wires its private providers. Do not export a provider
  unless another concrete module needs it.
- The API owns feature behavior and its repository. `packages/database` owns
  Prisma client construction, schema, and migrations. API code must not move
  Prisma schema or generated-client ownership into `apps/api`.
- `packages/contracts` is browser-safe. Keep Prisma and server-only SDKs out of
  `apps/web`; the API currently does not import the contracts package.
- `packages/backend` is a placeholder and is not a required dependency
  abstraction for the current Nest modules.
- Avoid feature-to-feature imports and cyclic module dependencies. The
  `common/http` boundary is justified by shared use in the global filter,
  bootstrap middleware, Auth early response, and Swagger; do not add unrelated
  generic abstractions.

## Adding a feature or endpoint

1. Add a feature directory under `src/modules/` with a Nest module and only
   the controller/providers the feature needs.
2. Keep the controller focused on transport and HTTP mapping, the service on
   business orchestration, and the repository on persistence. Keep direct
   external SDK use at the owning feature boundary.
3. Register the feature module in `AppModule`; export only providers consumed
   by another module. Do not add abstraction layers solely for uniformity.
4. Define an explicit typed DTO and runtime validation for external input.
   Endpoints that accept no input must continue to reject body/query input;
   they do not need placeholder DTOs.
5. Add accurate Swagger/OpenAPI decorators for every endpoint: tags,
   operation descriptions, success and known error status codes, explicit
   response schemas, and applicable security metadata. Do not document
   parameters or request bodies that the endpoint does not accept.
6. Add focused deterministic tests beside the feature. Put application-level
   and integration tests in `apps/api/test/`; no normal unit test should need
   live Supabase, a database, Docker, or AI credentials.
7. Preserve existing API routes, status codes, headers, payloads, and security
   behavior by default. A Swagger schema describes the existing HTTP response;
   it must not introduce a mapper, interceptor, or behavior change solely for
   documentation.

## Swagger / OpenAPI

- Cross-cutting setup and environment policy live in
  `src/config/swagger.config.ts`; do not create a Swagger-only Nest module.
- In non-production, Swagger is enabled by default and can be disabled with
  `SWAGGER_ENABLED=false`. In production it is always disabled, even when
  `SWAGGER_ENABLED=true`. Disabled Swagger does not register routes.
- Start the API locally with `pnpm --filter @knowledge-assistant/api dev`
  after configuring the required local environment described in
  [AUTHENTICATION.md](./AUTHENTICATION.md). With a non-production API running,
  open `http://localhost:3001/docs` for Swagger UI and retrieve the OpenAPI
  JSON from `http://localhost:3001/docs-json` (for example,
  `curl http://localhost:3001/docs-json`). No global API prefix is used or
  changed.
- Use `@ApiTags` and `@ApiOperation` for each controller/operation. Describe
  the actual successful and known error status codes with the corresponding
  response decorators. Keep response schemas aligned with runtime JSON; use
  explicit `@ApiProperty` metadata on response classes where TypeScript types
  are erased at runtime. Do not expose Prisma models in the OpenAPI contract.
- Define typed request DTOs only for real request input. Do not add placeholder
  DTOs to inputless operations. Document no-input behavior without inventing
  body or query parameters.
- Apply `@ApiBearerAuth('bearer')` only to endpoints protected by the existing
  Bearer JWT guard. This metadata documents the Authorization header; it does
  not implement authentication or frontend SSR session handling.
- Document the shared `ApiErrorResponseDto` for HTTP errors and the
  `X-Request-ID` response header. Auth responses also retain
  `Cache-Control: no-store`. Swagger response schemas must match the global
  formatter and actual endpoint statuses.
- OpenAPI contract tests belong in `apps/api/test/`. Verify paths/methods,
  security, schemas, status codes, headers, and environment policy without
  snapshotting the entire generated document. Run the API Jest suite, including
  the OpenAPI contract tests, with:

  ```sh
  pnpm --filter @knowledge-assistant/api test
  ```

## Error handling and logging

The global Nest exception filter is registered with `APP_FILTER`; parser
errors are handled within the isolated parser application. Both use the pure
formatter in `common/http/api-error.ts`. The runtime order is request ID,
Authentication middleware, Swagger setup, isolated parsers and their error
boundary, then Nest routes and the Nest error handler.
The main `SafeExpressAdapter` passes unknown errors through without trusting
their `status`, `statusCode`, or `expose`; the global filter returns 500.
Only the isolated parser boundary classifies allowlisted parser error types.
For zstd, only confirmed prefix and truncated-stream errors are classified as 400. `ZSTD_error_dstSize_tooSmall` is ambiguous: malformed frame data and decoder
output-buffer problems can produce the same code. It and unknown decoder
failures remain safe 500 responses. Consequently, some malformed zstd bodies
can still return 500; this is an accepted fail-safe limitation. No second
decompression or independent frame validator is performed.
The pre-parser `authNoStore` middleware keeps its early body/query rejection
and uses that same formatter so its 400 response does not bypass the contract.

Every request receives a server-generated UUID v4. Incoming `X-Request-ID` is
ignored and replaced; the generated ID is returned in the response header and
in error bodies. Error responses contain `statusCode`, normalized
`error.type`/`error.code`/safe `error.message`, `requestId`, and a UTC ISO
`timestamp`. A path is included only for a known safe route template; query
strings and user-controlled dynamic segments are omitted. Validation details
are optional and limited to safe field/code pairs.

Preserve valid HTTP error statuses. Known statuses map to stable codes;
unrecognized valid error statuses use `HTTP_ERROR`. Unknown exceptions become
500 with a fixed public message. Only explicitly allowlisted existing Auth
messages are retained. Never serialize exception objects, causes, raw parser
messages, stack traces, SQL, credentials, tokens, cookies, authorization
headers, request bodies, or chat/document content.

The filter and Express boundary emit one safe Nest `Logger` error record for
5xx responses with request ID, method, normalized type/code/status, and a safe
route path. Diagnostic types are limited to `TypeError`, `ReferenceError`,
`RangeError`, and `UnknownError`. Expected 4xx responses are not error-logged.
This is not structured logging; a future logging integration requires separate
approval.

Malformed percent-encoding of a dynamic route parameter currently results in
a safe 500 rather than the former 400. This is a temporary limitation, not the
correct final semantics. Before adding the first NestJS dynamic route
(`@Param`), implement a provenance-safe malformed percent-encoding response
with HTTP 400 without trusting arbitrary error properties.

Test both formatter behavior and the real HTTP pipeline. Parser tests must use
Supertest after the production ordering (`request ID` → `authNoStore` →
Swagger setup → isolated parsers → `app.init()`/Nest routes). Preserve
Authentication statuses, success payloads, and `Cache-Control: no-store`.

## TypeScript and verification

The API uses strict TypeScript, NodeNext ESM, `.js` local import specifiers, and
emitted decorator metadata. Keep Jest's ESM mapping and
`testMatch: **/*.spec.ts`. `tsconfig.json` includes `src/` and `test/`;
`tsconfig.build.json` compiles production source only. For API changes, run
format, lint, typecheck, tests, and build checks applicable to the changed
scope. The repository CI additionally runs the full workspace checks.
