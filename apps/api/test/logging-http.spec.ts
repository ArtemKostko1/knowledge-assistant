import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { request as httpRequest } from 'node:http';
import { AppModule } from '../src/app.module.js';
import { SafeExpressAdapter } from '../src/common/http/safe-express.adapter.js';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { createParserApplication } from '../src/common/http/parser-application.js';
import { authNoStore } from '../src/modules/auth/auth-http.js';
import { AuthConfig } from '../src/modules/auth/config/auth.config.js';
import { AppUserRepository } from '../src/modules/auth/app-user.repository.js';
import { AuthUserService } from '../src/modules/auth/auth-user.service.js';
import { JwtVerifier } from '../src/modules/auth/jwt-verifier.js';
import { SafeLogger, safeLogger } from '../src/common/logging/safe-logger.js';
import { createHttpCompletion } from '../src/common/logging/http-completion.js';

const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

it('records real lifecycle completions and one safe server diagnostic with the same ID', async () => {
  const records: Array<Readonly<Record<string, unknown>>> = [];
  let sinkFails = false;
  let onAborted: (() => void) | undefined;
  const abortedRecorded = new Promise<void>((resolve) => {
    onAborted = resolve;
  });
  const logger = new SafeLogger({
    write: (_level, fields) => {
      if (sinkFails) throw new Error('secret-sink-failure');
      records.push(fields);
      if (fields.outcome === 'aborted') onAborted?.();
    },
  });
  const parserSpy = jestApi
    .spyOn(safeLogger, 'application')
    .mockImplementation((event) => logger.application(event));
  const profile = {
    id: 'test-user',
    email: 'synthetic@example.test',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-03T04:05:06.000Z'),
  };
  const expectedProfile = {
    id: profile.id,
    email: profile.email,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SafeLogger)
    .useValue(logger)
    .overrideProvider(AuthConfig)
    .useValue({})
    .overrideProvider(AppUserRepository)
    .useValue({ find: async () => profile })
    .overrideProvider(AuthUserService)
    .useValue({})
    .overrideProvider(JwtVerifier)
    .useValue({ verify: async () => ({ id: profile.id }) })
    .compile();
  const adapter = new SafeExpressAdapter();
  const app = module.createNestApplication(adapter, { bodyParser: false });
  app.use(requestIdMiddleware);
  app.use(createHttpCompletion(logger));
  app.use(authNoStore);
  app.use(createParserApplication().getInstance());
  adapter.get('/test-failure', () => {
    throw new TypeError('secret-error');
  });
  adapter.get('/test-unavailable', () => {
    throw new ServiceUnavailableException('secret-service');
  });
  adapter.get(
    '/test-aborted',
    (_req: unknown, res: { write(chunk: string): void }) => {
      res.write('partial');
    },
  );
  await app.init();
  try {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
    expect(records).toHaveLength(0);
    const success = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer synthetic')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(success.body).toEqual(expectedProfile);
    const early = await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ secret: 'secret-body' })
      .expect(400)
      .expect('Cache-Control', 'no-store');
    const malformed = await request(app.getHttpServer())
      .get('/health')
      .set('Content-Type', 'application/json')
      .send('{"secret":')
      .expect(400);
    const failed = await request(app.getHttpServer())
      .get('/test-failure?token=secret-query')
      .expect(500);
    const unavailable = await request(app.getHttpServer())
      .get('/test-unavailable')
      .expect(503);
    for (const response of [early, malformed, failed, unavailable]) {
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
      const correlated = records.filter(
        (record) => record.requestId === response.body.requestId,
      );
      expect(
        correlated.filter(
          (record) => record.event === 'http.request.completed',
        ),
      ).toHaveLength(1);
      expect(
        correlated.filter((record) => record.event === 'http.request.failed'),
      ).toHaveLength(response.status >= 500 ? 1 : 0);
    }
    expect(JSON.stringify(records)).not.toContain('secret');
    expect(records).toHaveLength(7);
    sinkFails = true;
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer synthetic')
      .expect(200)
      .expect(expectedProfile);
    sinkFails = false;
    const loggingFailure = jestApi
      .spyOn(logger, 'application')
      .mockImplementation(() => {
        throw new Error('secret-record-preparation');
      });
    const isolated = await request(app.getHttpServer())
      .get('/test-failure')
      .expect(500);
    expect(isolated.body).toMatchObject({
      statusCode: 500,
      error: { code: 'INTERNAL_SERVER_ERROR' },
      requestId: isolated.headers['x-request-id'],
    });
    expect(JSON.stringify(isolated.body)).not.toContain('secret');
    expect(loggingFailure).toHaveBeenCalledTimes(2);
    loggingFailure.mockRestore();
    await app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      const req = httpRequest(
        new URL('/test-aborted', awaitableUrl()),
        (res) => {
          res.once('data', () => {
            res.destroy();
            req.destroy();
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
    await abortedRecorded;
    const aborted = records.filter((record) => record.outcome === 'aborted');
    expect(aborted).toHaveLength(1);
    expect(aborted[0]).not.toHaveProperty('statusCode');

    function awaitableUrl(): string {
      const server: { address(): { port: number } } = app.getHttpServer();
      return `http://127.0.0.1:${server.address().port}`;
    }
  } finally {
    parserSpy.mockRestore();
    await app.close();
  }
});
