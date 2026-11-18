import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SafeLogger } from '../src/common/logging/safe-logger.js';
import { SafeExpressAdapter } from '../src/common/http/safe-express.adapter.js';

@Module({
  providers: [
    {
      provide: 'FAILING_CONFIG',
      useFactory: (): never => {
        throw new Error('Missing required configuration: DATABASE_URL');
      },
    },
  ],
})
class FailingModule {}

@Module({})
class EmptyModule {}

it('captures early configuration failure safely before DI completes', async () => {
  const records: Array<Readonly<Record<string, unknown>>> = [];
  const logger = new SafeLogger({
    write: (_level, fields) => {
      records.push(fields);
    },
  });
  await expect(
    NestFactory.create(FailingModule, new SafeExpressAdapter(), {
      logger,
      abortOnError: false,
      bodyParser: false,
    }),
  ).rejects.toThrow();
  expect(records.some((record) => record.code === 'CONFIGURATION_FAILED')).toBe(
    true,
  );
  expect(JSON.stringify(records)).not.toContain('DATABASE_URL');
  expect(JSON.stringify(records)).not.toContain('stack');
});

it('supports init and shutdown with the same safe system logger', async () => {
  const records: Array<Readonly<Record<string, unknown>>> = [];
  const logger = new SafeLogger({
    write: (_level, fields) => {
      records.push(fields);
    },
  });
  const app = await NestFactory.create(EmptyModule, new SafeExpressAdapter(), {
    logger,
    bodyParser: false,
  });
  app.enableShutdownHooks();
  await app.init();
  await app.close();
  expect(records.length).toBeGreaterThan(0);
  expect(records.every((record) => record.event === 'nest.system')).toBe(true);
});
