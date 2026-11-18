import { requestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { authNoStore } from '../src/modules/auth/auth-http.js';
import { httpCompletion } from '../src/common/logging/http-completion.js';
import { safeLogger } from '../src/common/logging/safe-logger.js';

const jestApi = (
  import.meta as ImportMeta & {
    jest: typeof jest & {
      unstable_mockModule(name: string, factory: () => unknown): void;
    };
  }
).jest;

it('installs request middleware, Swagger and the parser application before init', async () => {
  const enableShutdownHooks = jestApi.fn();
  const use = jestApi.fn();
  const init = jestApi.fn().mockResolvedValue(undefined);
  const listen = jestApi.fn().mockResolvedValue(undefined);
  const configureSwagger = jestApi.fn();
  const create = jestApi.fn();
  const parserInstance = jestApi.fn();
  const createParserApplication = jestApi.fn(() => ({
    getInstance: () => parserInstance,
  }));
  class SafeExpressAdapter {}
  class AppModule {}
  const application = { enableShutdownHooks, use, init, listen };
  create.mockResolvedValue(application);
  jestApi.unstable_mockModule('@nestjs/core', () => ({
    NestFactory: {
      create,
    },
  }));
  jestApi.unstable_mockModule('../src/app.module.js', () => ({
    AppModule,
  }));
  jestApi.unstable_mockModule('../src/config/swagger.config.js', () => ({
    configureSwagger,
  }));
  jestApi.unstable_mockModule(
    '../src/common/http/safe-express.adapter.js',
    () => ({
      SafeExpressAdapter,
    }),
  );
  jestApi.unstable_mockModule(
    '../src/common/http/parser-application.js',
    () => ({
      createParserApplication,
    }),
  );
  await import('../src/main.js');
  expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(
    AppModule,
    expect.any(SafeExpressAdapter),
    { bodyParser: false, logger: safeLogger },
  );
  expect(use).toHaveBeenCalledTimes(4);
  expect(use).toHaveBeenNthCalledWith(1, requestIdMiddleware);
  expect(use).toHaveBeenNthCalledWith(2, httpCompletion);
  expect(use).toHaveBeenNthCalledWith(3, authNoStore);
  expect(use).toHaveBeenNthCalledWith(4, parserInstance);
  expect(createParserApplication).toHaveBeenCalledTimes(1);
  expect(configureSwagger).toHaveBeenCalledWith(application);
  expect(init).toHaveBeenCalledTimes(1);
  expect(listen).toHaveBeenCalledTimes(1);
  expect(enableShutdownHooks.mock.invocationCallOrder[0]).toBeLessThan(
    use.mock.invocationCallOrder[0]!,
  );
  expect(use.mock.invocationCallOrder[0]!).toBeLessThan(
    configureSwagger.mock.invocationCallOrder[0]!,
  );
  expect(configureSwagger.mock.invocationCallOrder[0]!).toBeLessThan(
    init.mock.invocationCallOrder[0]!,
  );
  expect(use.mock.invocationCallOrder[2]!).toBeLessThan(
    configureSwagger.mock.invocationCallOrder[0]!,
  );
  expect(configureSwagger.mock.invocationCallOrder[0]!).toBeLessThan(
    use.mock.invocationCallOrder[3]!,
  );
  expect(use.mock.invocationCallOrder[3]!).toBeLessThan(
    init.mock.invocationCallOrder[0]!,
  );
  expect(configureSwagger.mock.invocationCallOrder[0]!).toBeLessThan(
    listen.mock.invocationCallOrder[0]!,
  );
  expect(init.mock.invocationCallOrder[0]!).toBeLessThan(
    listen.mock.invocationCallOrder[0]!,
  );
});
