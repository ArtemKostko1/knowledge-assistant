const jestApi = (
  import.meta as ImportMeta & {
    jest: typeof jest & {
      unstable_mockModule(name: string, factory: () => unknown): void;
    };
  }
).jest;

it('enables shutdown hooks before listening', async () => {
  const enableShutdownHooks = jestApi.fn();
  const listen = jestApi.fn().mockResolvedValue(undefined);
  jestApi.unstable_mockModule('@nestjs/core', () => ({
    NestFactory: {
      create: jestApi.fn().mockResolvedValue({
        enableShutdownHooks,
        use: jestApi.fn(),
        listen,
      }),
    },
  }));
  jestApi.unstable_mockModule('../src/app.module.js', () => ({
    AppModule: class {},
  }));
  await import('../src/main.js');
  expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  expect(listen).toHaveBeenCalledTimes(1);
  expect(enableShutdownHooks.mock.invocationCallOrder[0]).toBeLessThan(
    listen.mock.invocationCallOrder[0]!,
  );
});
