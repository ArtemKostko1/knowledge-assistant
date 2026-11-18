import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Body,
  Res,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request as httpRequest } from 'node:http';
import type { IncomingMessage } from 'node:http';
import {
  brotliCompressSync,
  deflateSync,
  gzipSync,
  zstdCompressSync,
} from 'node:zlib';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { safeLogger } from '../src/common/logging/safe-logger.js';
import { expressErrorMiddleware } from '../src/common/http/express-error.middleware.js';
import { createParserApplication } from '../src/common/http/parser-application.js';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { SafeExpressAdapter } from '../src/common/http/safe-express.adapter.js';
import type {
  ApiRequestContext,
  ApiResponseContext,
  ExpressNext,
} from '../src/common/http/request-context.js';
import { AppUserRepository } from '../src/modules/auth/app-user.repository.js';
import { authNoStore } from '../src/modules/auth/auth-http.js';
import { AuthConfig } from '../src/modules/auth/config/auth.config.js';
import { AuthUserService } from '../src/modules/auth/auth-user.service.js';
import { JwtVerifier } from '../src/modules/auth/jwt-verifier.js';

const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

interface TestResponse {
  send(body: string): void;
  status(statusCode: number): TestResponse;
}

@Controller('_test/errors')
class TestHttpErrorsController {
  @Get('sent')
  alreadySent(@Res() response: TestResponse): never {
    response.status(200).send('already-sent');
    throw new Error('secret-marker after response');
  }

  @Get(':kind')
  fail(@Param('kind') kind: string): never {
    switch (kind) {
      case '400':
        throw new BadRequestException('private bad request text');
      case '401':
        throw new UnauthorizedException('private unauthorized text');
      case '403':
        throw new ForbiddenException('private forbidden text');
      case '404':
        throw new NotFoundException('private not found text');
      case '409':
        throw new ConflictException('private conflict text');
      case '418':
        throw new HttpException('private fallback text', 418);
      case '422':
        throw new UnprocessableEntityException('private validation text');
      case '429':
        throw new HttpException('private rate text', 429);
      case '503':
        throw new ServiceUnavailableException('private unavailable text');
      case 'invalid-status':
        throw new HttpException('private invalid status text', 99);
      case 'unknown':
        throw new Error('secret-marker unknown exception');
      case 'explicit-500':
        throw new InternalServerErrorException('secret-marker explicit 500');
      case 'type-error':
        throw new TypeError('secret-type-error');
      default:
        throw new NotFoundException();
    }
  }

  @Post('echo')
  echo(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }
}

async function createHttpTestApp(
  parserHandler: typeof expressErrorMiddleware = expressErrorMiddleware,
  captureBody?: (body: Buffer, contentLength: string | undefined) => void,
) {
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestHttpErrorsController],
  })
    .overrideProvider(AuthConfig)
    .useValue({})
    .overrideProvider(AppUserRepository)
    .useValue({})
    .overrideProvider(AuthUserService)
    .useValue({})
    .overrideProvider(JwtVerifier)
    .useValue({})
    .compile();
  const adapter = new SafeExpressAdapter();
  const app = module.createNestApplication(adapter, { bodyParser: false });
  app.use(requestIdMiddleware);
  app.use(authNoStore);
  if (captureBody) {
    app.use((req: IncomingMessage, _res: unknown, next: ExpressNext) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () =>
        captureBody(Buffer.concat(chunks), req.headers['content-length']),
      );
      next();
    });
  }
  const spoof = (
    req: ApiRequestContext,
    _res: ApiResponseContext,
    next: ExpressNext,
  ): void => {
    if (req.url?.startsWith('/_test/spoof')) {
      next(
        Object.assign(new Error('secret-spoof'), {
          status: 401,
          statusCode: 401,
          expose: true,
          code: req.url.split('/').at(-1),
        }),
      );
      return;
    }
    if (req.url?.startsWith('/_test/range')) {
      next(new RangeError('secret-range-error'));
      return;
    }
    next();
  };
  app.use(
    (req: ApiRequestContext, res: ApiResponseContext, next: ExpressNext) => {
      if (
        req.url?.startsWith('/_test/spoof-before') ||
        req.url?.startsWith('/_test/range-before')
      )
        return spoof(req, res, next);
      next();
    },
  );
  app.use(createParserApplication(parserHandler).getInstance());
  app.use(
    (req: ApiRequestContext, res: ApiResponseContext, next: ExpressNext) => {
      if (
        req.url?.startsWith('/_test/spoof-after') ||
        req.url?.startsWith('/_test/range-after')
      )
        return spoof(req, res, next);
      next();
    },
  );
  adapter.get(
    '/review-param/:id',
    (_req: unknown, res: { json(body: object): void }) =>
      res.json({ ok: true }),
  );
  await app.init();
  return app;
}

async function sendRawBody(
  baseUrl: string,
  encoding: string,
  payload: Buffer,
): Promise<{
  status: number | undefined;
  requestId: string | undefined;
  body: unknown;
}> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      new URL('/health', baseUrl),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': encoding,
          'Content-Length': payload.length,
          'X-Request-ID': 'untrusted',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body: unknown = JSON.parse(
              Buffer.concat(chunks).toString('utf8'),
            );
            const requestId = res.headers['x-request-id'];
            resolve({
              status: res.statusCode,
              requestId: typeof requestId === 'string' ? requestId : undefined,
              body,
            });
          } catch (error) {
            reject(
              error instanceof Error
                ? error
                : new Error('Invalid JSON response'),
            );
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function expectErrorContract(
  body: Record<string, unknown>,
  statusCode: number,
  code: string,
): void {
  expect(body).toMatchObject({
    statusCode,
    error: {
      code,
      type: expect.any(String),
      message: expect.any(String),
    },
    requestId: expect.any(String),
    timestamp: expect.any(String),
  });
  expect(new Date(String(body.timestamp)).toISOString()).toBe(body.timestamp);
}

describe('global HTTP error handling and Express parser boundary', () => {
  it.each([
    ['400', 400, 'BAD_REQUEST'],
    ['401', 401, 'AUTH_UNAUTHORIZED'],
    ['403', 403, 'FORBIDDEN'],
    ['404', 404, 'NOT_FOUND'],
    ['409', 409, 'CONFLICT'],
    ['422', 422, 'UNPROCESSABLE_ENTITY'],
    ['429', 429, 'TOO_MANY_REQUESTS'],
    ['503', 503, 'SERVICE_UNAVAILABLE'],
    ['418', 418, 'HTTP_ERROR'],
  ] as const)(
    'normalizes %s without exposing exception messages',
    async (kind, status, code) => {
      const app = await createHttpTestApp();
      const loggerSpy = jestApi
        .spyOn(safeLogger, 'application')
        .mockImplementation(() => undefined);
      try {
        const response = await request(app.getHttpServer())
          .get(`/_test/errors/${kind}`)
          .expect(status);

        expectErrorContract(
          response.body as Record<string, unknown>,
          status,
          code,
        );
        expect(response.body.error.message).not.toContain('private');
        expect(response.body.path).toBeUndefined();
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
        expect(response.body).not.toHaveProperty('stack');
        expect(loggerSpy).toHaveBeenCalledTimes(status >= 500 ? 1 : 0);
      } finally {
        loggerSpy.mockRestore();
        await app.close();
      }
    },
  );

  it('maps invalid and unknown exceptions to a safe 500 and logs one correlated record', async () => {
    const loggerSpy = jestApi
      .spyOn(safeLogger, 'application')
      .mockImplementation(() => undefined);
    const app = await createHttpTestApp();
    try {
      for (const kind of ['unknown', 'invalid-status', 'explicit-500']) {
        const response = await request(app.getHttpServer())
          .get(`/_test/errors/${kind}`)
          .expect(500);
        expectErrorContract(
          response.body as Record<string, unknown>,
          500,
          'INTERNAL_SERVER_ERROR',
        );
        expect(JSON.stringify(response.body)).not.toContain('secret-marker');
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
        expect(response.body.path).toBeUndefined();
      }

      expect(loggerSpy).toHaveBeenCalledTimes(3);
      for (const [message] of loggerSpy.mock.calls) {
        expect(message.requestId).toBeDefined();
        expect(JSON.stringify(message)).not.toContain('secret-marker');
        expect(JSON.stringify(message)).not.toContain('private');
        expect(JSON.stringify(message)).not.toContain('authorization');
      }
    } finally {
      loggerSpy.mockRestore();
      await app.close();
    }
  });

  it('logs only a fixed diagnostic type without exception content', async () => {
    const loggerSpy = jestApi
      .spyOn(safeLogger, 'application')
      .mockImplementation(() => undefined);
    const app = await createHttpTestApp();
    try {
      const response = await request(app.getHttpServer())
        .get('/_test/errors/type-error?token=secret-query')
        .expect(500);
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy.mock.calls[0]?.[0]).toMatchObject({
        diagnosticType: 'TypeError',
        requestId: response.body.requestId,
      });
      expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain('secret-');
      expect(JSON.stringify(response.body)).not.toContain('secret-');
    } finally {
      loggerSpy.mockRestore();
      await app.close();
    }
  });

  it('applies the parser limit to the health route', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const app = await createHttpTestApp(parserSpy);
    try {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Content-Type', 'application/json')
        .send(' '.repeat(110 * 1024))
        .expect(413);
      expectErrorContract(
        response.body as Record<string, unknown>,
        413,
        'PAYLOAD_TOO_LARGE',
      );
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
      expect(parserSpy).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('rejects deeply nested urlencoded input at the parser boundary', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const app = await createHttpTestApp(parserSpy);
    try {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`x${'[a]'.repeat(34)}=secret-marker`)
        .expect(400);
      expectErrorContract(
        response.body as Record<string, unknown>,
        400,
        'BAD_REQUEST',
      );
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
      expect(JSON.stringify(response.body)).not.toContain('secret-marker');
      expect(parserSpy).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('preserves the urlencoded parameter limit as 413', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const app = await createHttpTestApp(parserSpy);
    try {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(Array.from({ length: 1001 }, () => 'x=1').join('&'))
        .expect(413);
      expectErrorContract(
        response.body as Record<string, unknown>,
        413,
        'PAYLOAD_TOO_LARGE',
      );
      expect(parserSpy).toHaveBeenCalledTimes(1);
      expect(parserSpy.mock.calls[0]?.[0]).toHaveProperty(
        'type',
        'parameters.too.many',
      );
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
    } finally {
      await app.close();
    }
  });

  it.each([
    ['gzip', gzipSync],
    ['deflate', deflateSync],
    ['br', brotliCompressSync],
    ['zstd', zstdCompressSync],
  ] as const)(
    'rejects corrupted and truncated %s bodies without leaking contents',
    async (encoding, compress) => {
      const parserSpy = jestApi.fn(expressErrorMiddleware);
      const loggerSpy = jestApi
        .spyOn(safeLogger, 'application')
        .mockImplementation(() => undefined);
      const received: Array<{
        body: Buffer;
        contentLength: string | undefined;
      }> = [];
      const app = await createHttpTestApp(parserSpy, (body, contentLength) => {
        received.push({ body, contentLength });
      });
      try {
        await app.listen(0, '127.0.0.1');
        const baseUrl = await app.getUrl();
        const compressed = compress(Buffer.from('{"value":"secret-marker"}'));
        const payloads = [
          Buffer.from('secret-marker-not-compressed'),
          compressed.subarray(0, compressed.length - 3),
        ];
        for (const [index, payload] of payloads.entries()) {
          const response = await sendRawBody(baseUrl, encoding, payload);
          expect(response.status).toBe(400);
          expectErrorContract(
            response.body as Record<string, unknown>,
            400,
            'BAD_REQUEST',
          );
          expect(response.requestId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          expect(response.requestId).not.toBe('untrusted');
          expect(response.body).toMatchObject({
            requestId: response.requestId,
          });
          expect(received[index]).toEqual({
            body: payload,
            contentLength: String(payload.length),
          });
          const parserError: unknown = parserSpy.mock.calls[index]?.[0];
          expect(parserError).toBeInstanceOf(Error);
          expect(parserError).toHaveProperty(
            'code',
            index === 1
              ? 'Z_BUF_ERROR'
              : encoding === 'br'
                ? expect.stringMatching(/^ERR__ERROR_FORMAT_/)
                : encoding === 'zstd'
                  ? 'ZSTD_error_prefix_unknown'
                  : 'Z_DATA_ERROR',
          );
          expect(JSON.stringify(response.body)).not.toContain('secret-marker');
          expect(JSON.stringify(response.body)).not.toContain('stack');
          expect(JSON.stringify(response.body)).not.toContain(
            'incorrect header',
          );
        }
        expect(parserSpy).toHaveBeenCalledTimes(2);
        expect(loggerSpy).not.toHaveBeenCalled();
        if (encoding === 'zstd') {
          const valid = await sendRawBody(baseUrl, encoding, compressed);
          expect(valid.status).toBe(200);
          expect(valid.body).toEqual({ status: 'ok' });
          expect(received[2]).toEqual({
            body: compressed,
            contentLength: String(compressed.length),
          });
          expect(parserSpy).toHaveBeenCalledTimes(2);
        }
      } finally {
        loggerSpy.mockRestore();
        await app.close();
      }
    },
  );

  it('keeps ambiguous zstd output-buffer failures at 500', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const loggerSpy = jestApi
      .spyOn(safeLogger, 'application')
      .mockImplementation(() => undefined);
    const app = await createHttpTestApp(parserSpy);
    try {
      await app.listen(0, '127.0.0.1');
      // A malformed frame declares 136 output bytes but its RLE block needs 3490.
      const body = Buffer.from(
        '28b52ffd2088126d00002868656c6c6f01008083be6801',
        'hex',
      );
      const response = await sendRawBody(await app.getUrl(), 'zstd', body);
      expect(response.status).toBe(500);
      expectErrorContract(
        response.body as Record<string, unknown>,
        500,
        'INTERNAL_SERVER_ERROR',
      );
      expect(response.body).toMatchObject({ requestId: response.requestId });
      expect(parserSpy).toHaveBeenCalledTimes(1);
      expect(parserSpy.mock.calls[0]?.[0]).toHaveProperty(
        'code',
        'ZSTD_error_dstSize_tooSmall',
      );
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(response.body)).not.toContain('Destination buffer');
      expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain(
        'Destination buffer',
      );
    } finally {
      loggerSpy.mockRestore();
      await app.close();
    }
  });

  it('does not attempt a second response after headers have been sent', async () => {
    const loggerSpy = jestApi
      .spyOn(safeLogger, 'application')
      .mockImplementation(() => undefined);
    const app = await createHttpTestApp();
    try {
      const response = await request(app.getHttpServer())
        .get('/_test/errors/sent')
        .expect(200)
        .expect('already-sent');

      expect(response.text).toBe('already-sent');
      expect(response.headers['content-type']).not.toMatch(/application\/json/);
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy.mock.calls[0]?.[0]?.requestId).toBeDefined();
    } finally {
      loggerSpy.mockRestore();
      await app.close();
    }
  });

  it('generates a fresh server UUID and ignores the caller-provided request ID', async () => {
    const app = await createHttpTestApp();
    try {
      const first = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-ID', 'client-controlled-value')
        .expect(200);
      const second = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(first.headers['x-request-id']).toMatch(uuidPattern);
      expect(first.headers['x-request-id']).not.toBe('client-controlled-value');
      expect(second.headers['x-request-id']).toMatch(uuidPattern);
      expect(second.headers['x-request-id']).not.toBe(
        first.headers['x-request-id'],
      );
      expect(first.body).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });

  it('returns a JSON contract for malformed and oversized JSON parser failures', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const app = await createHttpTestApp(parserSpy);
    try {
      const malformed = await request(app.getHttpServer())
        .post('/_test/errors/echo')
        .set('Content-Type', 'application/json')
        .set('X-Request-ID', 'untrusted')
        .send('{"access_token":"parser-secret-marker"')
        .expect(400)
        .expect('Content-Type', /application\/json/);
      expectErrorContract(
        malformed.body as Record<string, unknown>,
        400,
        'BAD_REQUEST',
      );
      expect(malformed.headers['x-request-id']).toBe(malformed.body.requestId);
      expect(malformed.body.path).toBeUndefined();
      expect(JSON.stringify(malformed.body)).not.toContain(
        'parser-secret-marker',
      );
      expect(parserSpy).toHaveBeenCalledTimes(1);

      const oversized = await request(app.getHttpServer())
        .post('/_test/errors/echo')
        .set('Content-Type', 'application/json')
        .send(' '.repeat(110 * 1024))
        .expect(413)
        .expect('Content-Type', /application\/json/);
      expectErrorContract(
        oversized.body as Record<string, unknown>,
        413,
        'PAYLOAD_TOO_LARGE',
      );
      expect(oversized.headers['x-request-id']).toBe(oversized.body.requestId);
      expect(parserSpy).toHaveBeenCalledTimes(2);

      for (const [contentType, encoding] of [
        ['application/json; charset=iso-8859-1', 'identity'],
        ['application/json', 'unknown-encoding'],
      ] as const) {
        const response = await request(app.getHttpServer())
          .post('/_test/errors/echo')
          .set('Content-Type', contentType)
          .set('Content-Encoding', encoding)
          .send('{}')
          .expect(415);
        expectErrorContract(
          response.body as Record<string, unknown>,
          415,
          'HTTP_ERROR',
        );
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
      }
      expect(parserSpy).toHaveBeenCalledTimes(4);

      const valid = await request(app.getHttpServer())
        .post('/_test/errors/echo')
        .send({ ok: true })
        .expect(201);
      expect(valid.body).toEqual({ received: { ok: true } });
      expect(parserSpy).toHaveBeenCalledTimes(4);
      expect(valid.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      await app.close();
    }
  });

  it('does not trust spoofed middleware errors before or after the isolated parser', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const loggerSpy = jestApi
      .spyOn(safeLogger, 'application')
      .mockImplementation(() => undefined);
    const app = await createHttpTestApp(parserSpy);
    try {
      for (const path of [
        '/_test/spoof-before/Z_BUF_ERROR',
        '/_test/spoof-after/Z_DATA_ERROR',
        '/_test/spoof-before/ERR__ERROR_FORMAT_PADDING_2',
        '/_test/spoof-after/ERR__ERROR_FORMAT_PADDING_2',
        '/_test/spoof-before/ZSTD_error_prefix_unknown',
        '/_test/spoof-after/ZSTD_error_prefix_unknown',
        '/_test/spoof-before/ZSTD_error_dstSize_tooSmall',
        '/_test/spoof-after/Z_BUF_ERROR',
        '/_test/range-before',
        '/_test/range-after',
      ]) {
        const response = await request(app.getHttpServer())
          .get(path)
          .set('Content-Encoding', 'br')
          .expect(500);
        expectErrorContract(
          response.body as Record<string, unknown>,
          500,
          'INTERNAL_SERVER_ERROR',
        );
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
        expect(JSON.stringify(response.body)).not.toContain('secret-spoof');
      }
      expect(parserSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain(
        'secret-spoof',
      );
    } finally {
      loggerSpy.mockRestore();
      await app.close();
    }
  });

  it('preserves the approved URI decoding limitation', async () => {
    const parserSpy = jestApi.fn(expressErrorMiddleware);
    const loggerSpy = jestApi
      .spyOn(safeLogger, 'application')
      .mockImplementation(() => undefined);
    const app = await createHttpTestApp(parserSpy);
    try {
      await request(app.getHttpServer()).get('/health/%FF').expect(404);
      const response = await request(app.getHttpServer())
        .get('/review-param/%FF')
        .expect(500);
      expectErrorContract(
        response.body as Record<string, unknown>,
        500,
        'INTERNAL_SERVER_ERROR',
      );
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
      expect(parserSpy).not.toHaveBeenCalled();
    } finally {
      loggerSpy.mockRestore();
      await app.close();
    }
  });

  it('keeps the early Auth body rejection on the shared contract with no-store', async () => {
    const app = await createHttpTestApp();
    try {
      const response = await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Content-Type', 'application/json')
        .send('{')
        .expect(400)
        .expect('Cache-Control', 'no-store');

      expectErrorContract(
        response.body as Record<string, unknown>,
        400,
        'BAD_REQUEST',
      );
      expect(response.body.error.message).toBe(
        'This endpoint accepts no input',
      );
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
      expect(response.body.path).toBe('/auth/bootstrap');
    } finally {
      await app.close();
    }
  });
});
