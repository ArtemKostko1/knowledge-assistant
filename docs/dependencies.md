# Direct dependency inventory (stage 1 manifests)

Exact versions below are **direct declarations** in `package.json` files, not installed/transitive versions. `workspace:*` is a local workspace link, not an external package version. `D` = `dependencies`, `Dev` = `devDependencies`; declaration does not imply a runtime import. For actual imports, see [architecture](architecture.md). The only other explicit dependency type is the `eslint: ^9.0.0` peer of `packages/config-eslint` (not a direct dependency/devDependency entry).

| Location                 | Kind | Exact name                               | Declared version | Stage 1 purpose / status                                 |
| ------------------------ | ---- | ---------------------------------------- | ---------------- | -------------------------------------------------------- |
| root                     | Dev  | `@playwright/test`                       | `1.64.1`         | HTTP e2e smoke fixture.                                  |
| root                     | Dev  | `eslint`                                 | `9.39.5`         | Lint CLI.                                                |
| root                     | Dev  | `prettier`                               | `3.9.10`         | Root formatter/check.                                    |
| root                     | Dev  | `supabase`                               | `2.122.0`        | Local Supabase CLI.                                      |
| root                     | Dev  | `turbo`                                  | `2.11.10`        | Workspace task orchestration.                            |
| root                     | Dev  | `typescript`                             | `5.9.3`          | TypeScript tooling.                                      |
| `apps/web`               | D    | `@knowledge-assistant/contracts`         | `workspace:*`    | Browser-safe placeholder; not imported by current page.  |
| `apps/web`               | D    | `@mantine/core`                          | `9.7.4`          | Layout/provider and home-page UI.                        |
| `apps/web`               | D    | `@mantine/hooks`                         | `9.7.4`          | Mantine hooks available; no current source import.       |
| `apps/web`               | D    | `next`                                   | `16.4.3`         | App Router, dev/build/serve.                             |
| `apps/web`               | D    | `react`                                  | `19.3.1`         | React UI framework.                                      |
| `apps/web`               | D    | `react-dom`                              | `19.3.1`         | React DOM runtime.                                       |
| `apps/web`               | Dev  | `@knowledge-assistant/config-eslint`     | `workspace:*`    | Shared ESLint flat config.                               |
| `apps/web`               | Dev  | `@knowledge-assistant/config-typescript` | `workspace:*`    | Shared strict TS config.                                 |
| `apps/web`               | Dev  | `@testing-library/react`                 | `16.3.3`         | Component test rendering/queries.                        |
| `apps/web`               | Dev  | `@types/node`                            | `24.10.15`       | Node type definitions.                                   |
| `apps/web`               | Dev  | `@types/react`                           | `19.3.0`         | React type definitions.                                  |
| `apps/web`               | Dev  | `@types/react-dom`                       | `19.3.0`         | React DOM type definitions.                              |
| `apps/web`               | Dev  | `eslint-config-next`                     | `16.4.3`         | Next lint rules.                                         |
| `apps/web`               | Dev  | `jsdom`                                  | `27.0.1`         | Vitest DOM environment.                                  |
| `apps/web`               | Dev  | `typescript`                             | `5.9.3`          | TS compilation/typecheck.                                |
| `apps/web`               | Dev  | `vitest`                                 | `5.0.5`          | Component test runner.                                   |
| `apps/api`               | D    | `@knowledge-assistant/backend`           | `workspace:*`    | Server-only placeholder; no API source import.           |
| `apps/api`               | D    | `@knowledge-assistant/contracts`         | `workspace:*`    | Shared-contract placeholder; no API source import.       |
| `apps/api`               | D    | `@nestjs/common`                         | `12.3.2`         | Nest module/controller decorators.                       |
| `apps/api`               | D    | `@nestjs/core`                           | `12.3.2`         | Nest application bootstrap.                              |
| `apps/api`               | D    | `@nestjs/platform-express`               | `12.3.2`         | Express HTTP platform for Nest.                          |
| `apps/api`               | D    | `reflect-metadata`                       | `0.2.2`          | Imported for Nest decorator metadata.                    |
| `apps/api`               | D    | `rxjs`                                   | `7.8.2`          | Nest ecosystem dependency; no direct API source import.  |
| `apps/api`               | Dev  | `@knowledge-assistant/config-eslint`     | `workspace:*`    | Shared lint config.                                      |
| `apps/api`               | Dev  | `@knowledge-assistant/config-typescript` | `workspace:*`    | Shared TS config.                                        |
| `apps/api`               | Dev  | `@nestjs/testing`                        | `12.3.2`         | Nest test module.                                        |
| `apps/api`               | Dev  | `@types/jest`                            | `30.0.0`         | Jest types.                                              |
| `apps/api`               | Dev  | `@types/node`                            | `24.10.15`       | Node types.                                              |
| `apps/api`               | Dev  | `@types/supertest`                       | `6.0.3`          | Supertest types.                                         |
| `apps/api`               | Dev  | `eslint`                                 | `9.39.5`         | Lint CLI.                                                |
| `apps/api`               | Dev  | `jest`                                   | `30.5.2`         | API test runner.                                         |
| `apps/api`               | Dev  | `supertest`                              | `7.3.1`          | HTTP test assertions.                                    |
| `apps/api`               | Dev  | `ts-jest`                                | `29.4.15`        | ESM TS transform in Jest.                                |
| `apps/api`               | Dev  | `tsx`                                    | `4.23.15`        | TS watch/dev runner.                                     |
| `apps/api`               | Dev  | `typescript`                             | `5.9.3`          | TS build/typecheck.                                      |
| `apps/worker`            | D    | `@knowledge-assistant/backend`           | `workspace:*`    | Server-only placeholder; no worker source import.        |
| `apps/worker`            | D    | `pg-boss`                                | `12.38.0`        | PostgreSQL-backed queue startup.                         |
| `apps/worker`            | Dev  | `@knowledge-assistant/config-eslint`     | `workspace:*`    | Shared lint config.                                      |
| `apps/worker`            | Dev  | `@knowledge-assistant/config-typescript` | `workspace:*`    | Shared TS config.                                        |
| `apps/worker`            | Dev  | `@types/jest`                            | `30.0.0`         | Jest types.                                              |
| `apps/worker`            | Dev  | `@types/node`                            | `24.10.15`       | Node types.                                              |
| `apps/worker`            | Dev  | `eslint`                                 | `9.39.5`         | Lint CLI.                                                |
| `apps/worker`            | Dev  | `jest`                                   | `30.5.2`         | Worker test runner.                                      |
| `apps/worker`            | Dev  | `ts-jest`                                | `29.4.15`        | ESM TS transform in Jest.                                |
| `apps/worker`            | Dev  | `tsx`                                    | `4.23.15`        | TS watch/dev runner.                                     |
| `apps/worker`            | Dev  | `typescript`                             | `5.9.3`          | TS build/typecheck.                                      |
| `packages/backend`       | D    | `@knowledge-assistant/database`          | `workspace:*`    | Declared server-only DB link; no source import yet.      |
| `packages/backend`       | Dev  | `@knowledge-assistant/config-eslint`     | `workspace:*`    | Shared lint config.                                      |
| `packages/backend`       | Dev  | `@knowledge-assistant/config-typescript` | `workspace:*`    | Shared TS config.                                        |
| `packages/backend`       | Dev  | `eslint`                                 | `9.39.5`         | Lint CLI.                                                |
| `packages/backend`       | Dev  | `typescript`                             | `5.9.3`          | Typecheck.                                               |
| `packages/database`      | D    | `@prisma/client`                         | `7.10.1`         | Declared Prisma runtime; not imported by app source.     |
| `packages/database`      | D    | `@prisma/adapter-pg`                     | `7.10.1`         | Declared PostgreSQL adapter; not imported by app source. |
| `packages/database`      | D    | `pg`                                     | `8.23.1`         | Declared PostgreSQL driver; not imported by app source.  |
| `packages/database`      | Dev  | `@knowledge-assistant/config-eslint`     | `workspace:*`    | Shared lint config.                                      |
| `packages/database`      | Dev  | `@knowledge-assistant/config-typescript` | `workspace:*`    | Shared TS config.                                        |
| `packages/database`      | Dev  | `@types/node`                            | `24.10.15`       | Node types.                                              |
| `packages/database`      | Dev  | `@types/pg`                              | `8.15.5`         | PostgreSQL driver types.                                 |
| `packages/database`      | Dev  | `eslint`                                 | `9.39.5`         | Lint CLI.                                                |
| `packages/database`      | Dev  | `prisma`                                 | `7.10.1`         | Schema validation/migrations CLI and `prisma/config`.    |
| `packages/database`      | Dev  | `typescript`                             | `5.9.3`          | Typecheck.                                               |
| `packages/config-eslint` | D    | `typescript-eslint`                      | `8.72.1`         | Shared recommended TS lint rules.                        |

`packages/contracts`, `packages/config-typescript`, and `packages/config-prettier` declare **no** `dependencies` or `devDependencies`. The config-eslint package also declares the `eslint` peer described above. No transitive lockfile packages are listed here.
