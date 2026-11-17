const jestApi = (
  import.meta as ImportMeta & {
    jest: typeof jest & {
      unstable_mockModule(name: string, factory: () => unknown): void;
    };
  }
).jest;

it('installs the auth middleware and Swagger before listening', async () => {
  const enableShutdownHooks = jestApi.fn();
  const use = jestApi.fn();
  const listen = jestApi.fn().mockResolvedValue(undefined);
  const configureSwagger = jestApi.fn();
  const application = { enableShutdownHooks, use, listen };
  jestApi.unstable_mockModule('@nestjs/core', () => ({
    NestFactory: {
      create: jestApi.fn().mockResolvedValue(application),
    },
  }));
  jestApi.unstable_mockModule('../src/app.module.js', () => ({
    AppModule: class {},
  }));
  jestApi.unstable_mockModule('../src/config/swagger.config.js', () => ({
    configureSwagger,
  }));
  await import('../src/main.js');
  expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  expect(use).toHaveBeenCalledTimes(1);
  expect(configureSwagger).toHaveBeenCalledWith(application);
  expect(listen).toHaveBeenCalledTimes(1);
  expect(enableShutdownHooks.mock.invocationCallOrder[0]).toBeLessThan(
    use.mock.invocationCallOrder[0]!,
  );
  expect(use.mock.invocationCallOrder[0]!).toBeLessThan(
    configureSwagger.mock.invocationCallOrder[0]!,
  );
  expect(configureSwagger.mock.invocationCallOrder[0]!).toBeLessThan(
    listen.mock.invocationCallOrder[0]!,
  );
});
