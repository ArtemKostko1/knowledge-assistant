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
  the Authentication HTTP middleware before the body parser, configures
  Swagger, and listens on the configured port. Preserve this middleware
  ordering.
- `src/app.module.ts` is the composition root and imports `HealthModule` and
  `AuthModule`; it does not implement endpoints.
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
- Avoid feature-to-feature imports, cyclic module dependencies, and new
  `common/`, `infrastructure/`, `dto/`, or `utils/` directories until a
  concrete shared or cross-cutting requirement exists.

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
- Document the existing Nest exception response forms and endpoint-specific
  headers. Do not define a shared error DTO or claim a global exception filter
  unless one is separately implemented and approved.
- OpenAPI contract tests belong in `apps/api/test/`. Verify paths/methods,
  security, schemas, status codes, headers, and environment policy without
  snapshotting the entire generated document. Run the API Jest suite, including
  the OpenAPI contract tests, with:

  ```sh
  pnpm --filter @knowledge-assistant/api test
  ```

## Error handling and logging

Continue using the existing Nest exceptions and safe messages. A global
ExceptionFilter or structured logger is a future, separately approved change;
neither is installed by this architecture. When structured logging is
introduced, never record tokens, keys, authorization headers, request bodies,
or chat/document content.

## TypeScript and verification

The API uses strict TypeScript, NodeNext ESM, `.js` local import specifiers, and
emitted decorator metadata. Keep Jest's ESM mapping and
`testMatch: **/*.spec.ts`. `tsconfig.json` includes `src/` and `test/`;
`tsconfig.build.json` compiles production source only. For API changes, run
format, lint, typecheck, tests, and build checks applicable to the changed
scope. The repository CI additionally runs the full workspace checks.
