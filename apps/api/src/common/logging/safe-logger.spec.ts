import { EventEmitter } from 'node:events';
import {
  SafeLogger,
  configureLogging,
  createConsoleSink,
} from './safe-logger.js';
import { createHttpCompletion } from './http-completion.js';
import type { ApiRequestContext } from '../http/request-context.js';

const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;
const id = 'd4b519cf-7284-4ae9-a882-3c337a25ef22';

describe('safe logging policy', () => {
  it('rejects unsafe runtime values and contains hostile getters and proxies', () => {
    const write = jestApi.fn();
    const logger = new SafeLogger({ write });
    const send = (value: unknown): void =>
      logger.application(value as Parameters<SafeLogger['application']>[0]);
    const valid = {
      event: 'http.request.completed',
      requestId: id,
      outcome: 'finished',
      durationMs: 1,
    };
    const secretId = { secret: 'secret-nested', toString: () => id };
    const throwing = {
      toString: () => {
        throw new Error('secret-coercion');
      },
    };
    const hostile = new Proxy(
      {},
      {
        get: () => {
          throw new Error('secret-proxy');
        },
      },
    );
    const getter = Object.defineProperty({}, 'event', {
      get: () => {
        throw new Error('secret-getter');
      },
    });
    const error = new Error();
    Object.defineProperty(error, 'message', {
      get: () => {
        throw new Error('secret-message-getter');
      },
    });
    for (const value of [
      { ...valid, requestId: secretId },
      { ...valid, requestId: throwing },
      { ...valid, requestId: Symbol('secret') },
      { ...valid, event: 'secret-event' },
      [],
      Symbol('secret'),
      hostile,
      getter,
    ])
      expect(() => send(value)).not.toThrow();
    expect(() => logger.error(error, 'secret-param')).not.toThrow();
    expect(() => logger.log(hostile)).not.toThrow();
    expect(JSON.stringify(write.mock.calls)).not.toContain('secret');
    write.mockClear();
    logger.startupFailure('secret-code' as 'BOOTSTRAP_FAILED');
    send({
      ...valid,
      method: 'SECRET',
      route: throwing,
      durationMs: Infinity,
      statusCode: NaN,
      outcome: 'secret-outcome',
      extra: { secret: 'secret-extra' },
    });
    send({
      event: 'http.request.failed',
      requestId: id,
      statusCode: Infinity,
      errorCode: { secret: 'secret-code' },
      diagnosticType: Symbol('secret'),
      boundary: 'secret-boundary',
    });
    expect(JSON.stringify(write.mock.calls)).not.toContain('secret');
    expect(write.mock.calls).toHaveLength(3);
    expect(write.mock.calls[0]?.[1]).toMatchObject({
      code: 'BOOTSTRAP_FAILED',
    });
    expect(write.mock.calls[1]?.[1]).toMatchObject({
      outcome: 'aborted',
      durationMs: 0,
      method: 'UNKNOWN',
    });
    expect(write.mock.calls[2]?.[1]).toMatchObject({
      statusCode: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      diagnosticType: 'UnknownError',
      boundary: 'nest',
    });
  });

  it.each(['production', 'development'])(
    'never writes hostile event content to %s output',
    (environment) => {
      const output: string[] = [];
      const stdout = jestApi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => {
          output.push(chunk.toString());
          return true;
        });
      const stderr = jestApi
        .spyOn(process.stderr, 'write')
        .mockImplementation((chunk) => {
          output.push(chunk.toString());
          return true;
        });
      try {
        const logger = new SafeLogger(createConsoleSink(environment));
        logger.application({
          event: 'http.request.completed',
          requestId: { secret: 'secret-marker', toString: () => id },
          outcome: 'finished',
          durationMs: 1,
        } as unknown as Parameters<SafeLogger['application']>[0]);
        logger.startupFailure('secret-marker' as 'BOOTSTRAP_FAILED');
        expect(output).toHaveLength(1);
        expect(output.join('')).not.toContain('secret-marker');
        if (environment === 'production')
          expect(JSON.parse(output[0] ?? '')).toMatchObject({
            code: 'BOOTSTRAP_FAILED',
          });
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    },
  );

  it('contains completion preparation and logger failures on finish and close', () => {
    const logger = new SafeLogger({ write: jestApi.fn() });
    const spy = jestApi.spyOn(logger, 'application').mockImplementation(() => {
      throw new Error('secret');
    });
    for (const event of ['finish', 'close'] as const) {
      const response = Object.assign(new EventEmitter(), { statusCode: 200 });
      createHttpCompletion(logger)(
        { requestId: id, method: 'GET', url: '/auth/me' },
        response,
        () => undefined,
      );
      expect(() => response.emit(event)).not.toThrow();
      expect(() => response.emit('close')).not.toThrow();
    }
    expect(spy).toHaveBeenCalledTimes(2);
    const response = Object.assign(new EventEmitter(), { statusCode: 200 });
    const req = Object.defineProperty({ requestId: id }, 'route', {
      get: () => {
        throw new Error('secret');
      },
    });
    createHttpCompletion(logger)(req, response, () => undefined);
    expect(() => response.emit('finish')).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('writes error JSON to stderr without exception content', () => {
    const output: string[] = [];
    const spy = jestApi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk) => {
        output.push(chunk.toString());
        return true;
      });
    try {
      new SafeLogger(createConsoleSink('production')).error(
        new Error('secret-stack-message'),
      );
      expect(output).toHaveLength(1);
      expect(JSON.parse(output[0] ?? '')).toMatchObject({
        level: 'error',
        event: 'nest.system',
        code: 'NEST_SYSTEM_ERROR',
      });
      expect(output[0]).not.toContain('secret');
    } finally {
      spy.mockRestore();
    }
  });
  it('drops arbitrary Nest messages, errors and optional params', () => {
    const write = jestApi.fn();
    const logger = new SafeLogger({ write });
    const error = new Error('secret-message', { cause: 'secret-cause' });
    error.stack = 'secret-stack';
    logger.error(error, 'secret-stack', { authorization: 'secret-token' });
    logger.log('secret-system-text');
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(write.mock.calls)).not.toContain('secret');
    expect(write.mock.calls[0]?.[1]).toMatchObject({
      event: 'nest.system',
      code: 'NEST_SYSTEM_ERROR',
    });
  });

  it.each(['production', 'development'])(
    'serializes safe %s output through ConsoleLogger',
    (environment) => {
      const output: string[] = [];
      const spy = jestApi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => {
          output.push(typeof chunk === 'string' ? chunk : chunk.toString());
          return true;
        });
      try {
        const logger = new SafeLogger(createConsoleSink(environment));
        logger.log(new Error('secret-message'), 'secret-context');
        expect(output).toHaveLength(1);
        expect(output[0]).not.toContain('secret');
        expect(output[0]).not.toContain('\u001b');
        if (environment === 'production') {
          const record: unknown = JSON.parse(output[0] ?? '');
          expect(record).toMatchObject({
            service: 'knowledge-assistant-api',
            event: 'nest.system',
            level: 'log',
          });
        } else {
          expect(output[0]).toContain('API event');
        }
      } finally {
        spy.mockRestore();
      }
    },
  );

  it('validates level without revealing its value', () => {
    expect(() =>
      configureLogging({ LOG_LEVEL: 'secret-level', NODE_ENV: 'test' }),
    ).toThrow('Invalid logging configuration');
    expect(() =>
      configureLogging({ LOG_LEVEL: 'debug', NODE_ENV: 'test' }),
    ).not.toThrow();
    configureLogging({ NODE_ENV: 'test' });
  });

  it('keeps configuration failure diagnosis without exposing values', () => {
    const write = jestApi.fn();
    new SafeLogger({ write }).error(
      new Error('Missing required configuration: DATABASE_URL'),
    );
    expect(write.mock.calls[0]?.[1]).toMatchObject({
      code: 'CONFIGURATION_FAILED',
      context: 'AuthConfig',
    });
  });

  it('honors explicit debug levels and ignores NEST_LOG_LEVEL', () => {
    const previous = process.env.NEST_LOG_LEVEL;
    process.env.NEST_LOG_LEVEL = 'fatal';
    const output: string[] = [];
    const spy = jestApi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        output.push(chunk.toString());
        return true;
      });
    try {
      new SafeLogger(createConsoleSink('production', false)).debug('secret');
      expect(output).toHaveLength(0);
      new SafeLogger(createConsoleSink('production', true)).debug('secret');
      expect(output).toHaveLength(1);
      expect(output[0]).not.toContain('secret');
    } finally {
      spy.mockRestore();
      if (previous === undefined) delete process.env.NEST_LOG_LEVEL;
      else process.env.NEST_LOG_LEVEL = previous;
    }
  });

  it('writes one completion and omits unconfirmed status on close', () => {
    const write = jestApi.fn();
    let time = 10;
    const middleware = createHttpCompletion(
      new SafeLogger({ write }),
      () => time,
    );
    const req: ApiRequestContext = {
      requestId: id,
      method: 'POST',
      url: '/auth/bootstrap?token=secret',
    };
    for (const first of ['finish', 'close']) {
      const response = Object.assign(new EventEmitter(), { statusCode: 400 });
      middleware(req, response, () => undefined);
      time += 5;
      response.emit(first);
      response.emit('close');
    }
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]?.[1]).toMatchObject({
      durationMs: 5,
      outcome: 'finished',
      statusCode: 400,
    });
    expect(write.mock.calls[1]?.[1]).toMatchObject({ outcome: 'aborted' });
    expect(write.mock.calls[1]?.[1]).not.toHaveProperty('statusCode');
    expect(JSON.stringify(write.mock.calls)).not.toContain('secret');
  });

  it('only suppresses successful GET health and contains sink failures', () => {
    const write = jestApi.fn();
    const middleware = createHttpCompletion(new SafeLogger({ write }));
    for (const [method, status, event] of [
      ['GET', 200, 'finish'],
      ['POST', 200, 'finish'],
      ['GET', 500, 'finish'],
      ['GET', 200, 'close'],
    ] as const) {
      const res = Object.assign(new EventEmitter(), { statusCode: status });
      middleware(
        { requestId: id, method, url: '/health' },
        res,
        () => undefined,
      );
      res.emit(event);
    }
    expect(write).toHaveBeenCalledTimes(3);
    expect(() =>
      new SafeLogger({
        write: () => {
          throw new Error('secret');
        },
      }).error('ignored'),
    ).not.toThrow();
  });
});
