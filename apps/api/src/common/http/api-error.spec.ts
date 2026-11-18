import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  classifyBodyParserError,
  classifyDiagnosticError,
  classifyHttpException,
  classifyHttpStatus,
  formatHttpErrorResponse,
  resolveSafeErrorPath,
} from './api-error.js';

describe('HTTP error contract formatter', () => {
  const context = {
    requestId: 'd4b519cf-7284-4ae9-a882-3c337a25ef22',
    path: '/auth/me',
    timestamp: new Date('2026-11-17T12:00:00.000Z'),
  };

  it.each([
    [new TypeError('secret'), 'TypeError'],
    [new ReferenceError('secret'), 'ReferenceError'],
    [new RangeError('secret'), 'RangeError'],
    [new Error('secret'), 'UnknownError'],
    [{ name: 'TypeError' }, 'UnknownError'],
  ] as const)('uses only fixed diagnostic categories', (error, expected) => {
    expect(classifyDiagnosticError(error)).toBe(expected);
  });

  it('falls back safely for hostile exception prototypes and HttpException accessors', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('secret-prototype');
        },
      },
    );
    const exception = new BadRequestException('secret-message');
    Object.defineProperty(exception, 'getStatus', {
      get() {
        throw new Error('secret-accessor');
      },
    });
    for (const value of [
      revoked.proxy,
      hostile,
      exception,
      { status: 400, statusCode: 401 },
    ]) {
      expect(classifyHttpException(value)).toEqual(classifyHttpStatus(500));
    }
    expect(classifyDiagnosticError(revoked.proxy)).toBe('UnknownError');
    expect(classifyDiagnosticError(hostile)).toBe('UnknownError');
    expect(classifyDiagnosticError(new TypeError('secret'))).toBe('TypeError');
    expect(classifyHttpException(new BadRequestException())).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    });
  });

  it('leaves parser errors unclassified when runtime inspection throws', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(classifyBodyParserError(revoked.proxy)).toBeUndefined();
    for (const [field, encoding] of [
      ['type', 'identity'],
      ['code', 'gzip'],
      ['errno', 'zstd'],
    ] as const) {
      const error = Object.assign(new Error('secret-parser'), {
        code: 'ZSTD_error_prefix_unknown',
      });
      Object.defineProperty(error, field, {
        get() {
          throw new Error('secret-accessor');
        },
      });
      expect(classifyBodyParserError(error, encoding)).toBeUndefined();
    }
    expect(
      classifyBodyParserError({
        type: 'entity.parse.failed',
        status: 400,
        statusCode: 400,
      }),
    ).toBeUndefined();
  });

  it('normalizes a known safe HttpException message and timestamp', () => {
    const response = formatHttpErrorResponse(
      classifyHttpException(
        new BadRequestException('This endpoint accepts no input'),
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 400,
      error: {
        type: 'BadRequestError',
        code: 'BAD_REQUEST',
        message: 'This endpoint accepts no input',
      },
      requestId: context.requestId,
      timestamp: '2026-11-17T12:00:00.000Z',
      path: '/auth/me',
    });
  });

  it('uses a safe status message rather than arbitrary 4xx or 5xx text', () => {
    const privateMessage = 'secret-marker authorization=private';

    const badRequest = formatHttpErrorResponse(
      classifyHttpException(new BadRequestException(privateMessage)),
      context,
    );
    const unavailable = formatHttpErrorResponse(
      classifyHttpException(new ServiceUnavailableException(privateMessage)),
      context,
    );

    expect(badRequest.error.message).toBe('The request is invalid');
    expect(unavailable).toMatchObject({
      statusCode: 503,
      error: {
        type: 'ServiceUnavailableError',
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable',
      },
    });
    expect(JSON.stringify([badRequest, unavailable])).not.toContain(
      privateMessage,
    );
  });

  it('maps unknown exceptions to a minimal safe 500 response', () => {
    const exception = new Error('secret-message');
    exception.stack = 'secret-stack';
    exception.cause = new Error('secret-cause');

    const response = formatHttpErrorResponse(classifyHttpException(exception), {
      requestId: context.requestId,
    });

    expect(response).toEqual({
      statusCode: 500,
      error: {
        type: 'InternalServerError',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      requestId: context.requestId,
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(response)).not.toContain('secret-');
    expect(response.path).toBeUndefined();
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });

  it('supports only typed validation details and drops unsafe fields', () => {
    const response = formatHttpErrorResponse(
      {
        ...classifyHttpStatus(422),
        details: [
          { field: 'email', code: 'INVALID_FORMAT' },
          { field: 'email;token=secret', code: 'INVALID_FORMAT' },
        ],
      },
      context,
    );

    expect(response.error.details).toEqual([
      { field: 'email', code: 'INVALID_FORMAT' },
    ]);
    expect(JSON.stringify(response)).not.toContain('secret');
  });

  it('preserves other valid HTTP error statuses using the safe fallback', () => {
    const response = formatHttpErrorResponse(
      classifyHttpException(new HttpException('secret', 418)),
      context,
    );

    expect(response).toMatchObject({
      statusCode: 418,
      error: {
        type: 'HttpError',
        code: 'HTTP_ERROR',
        message: 'The request could not be completed',
      },
    });
    expect(JSON.stringify(response)).not.toContain('secret');
  });

  it('classifies parser errors by allowlisted type, not their status property', () => {
    const parserError = Object.assign(new Error('secret parser body'), {
      type: 'entity.too.large',
      status: 500,
    });

    expect(classifyBodyParserError(parserError)).toMatchObject({
      statusCode: 413,
      type: 'PayloadTooLargeError',
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(
      classifyBodyParserError({ type: 'entity.parse.failed', status: 400 }),
    ).toBeUndefined();
  });

  it('does not classify arbitrary RangeErrors or unrelated zlib errors as bad requests', () => {
    expect(classifyBodyParserError(new RangeError('secret'))).toBeUndefined();
    const invalid = Object.assign(new Error('secret'), {
      code: 'Z_DATA_ERROR',
    });
    expect(classifyBodyParserError(invalid, 'identity')).toBeUndefined();
    expect(
      classifyBodyParserError(
        Object.assign(new Error('secret'), {
          code: 'Z_STREAM_ERROR',
          status: 400,
        }),
        'gzip',
      ),
    ).toBeUndefined();
  });

  it('classifies known Brotli format errors but not internal decoder errors', () => {
    const inputFailure = Object.assign(new Error('secret'), {
      code: 'ERR__ERROR_FORMAT_PADDING_2',
      errno: -15,
    });
    expect(classifyBodyParserError(inputFailure, 'br')?.statusCode).toBe(400);
    expect(classifyBodyParserError(inputFailure, 'gzip')).toBeUndefined();
    expect(
      classifyBodyParserError(
        Object.assign(new Error('secret'), {
          code: 'ERR__ERROR_FORMAT_PADDING_2',
          errno: -21,
        }),
        'br',
      ),
    ).toBeUndefined();
    expect(
      classifyBodyParserError(
        Object.assign(new Error('secret'), {
          code: 'ERR__ERROR_ALLOC_CONTEXT_MODES',
          errno: -21,
        }),
        'br',
      ),
    ).toBeUndefined();
  });

  it('limits zstd classification to confirmed prefix and truncation codes', () => {
    for (const [code, errno] of [
      ['ZSTD_error_prefix_unknown', 10],
      ['Z_BUF_ERROR', -5],
    ] as const) {
      const error = Object.assign(new Error('secret'), { code, errno });
      expect(classifyBodyParserError(error, 'zstd')?.statusCode).toBe(400);
      expect(classifyBodyParserError(error, 'identity')).toBeUndefined();
    }
    for (const code of [
      'ZSTD_error_dstSize_tooSmall',
      'ZSTD_error_memory_allocation',
      'unknown',
    ]) {
      expect(
        classifyBodyParserError(
          Object.assign(new Error('secret'), {
            code,
            errno: 70,
            status: 400,
            statusCode: 400,
            expose: true,
          }),
          'zstd',
        ),
      ).toBeUndefined();
    }
  });

  it('includes only known route templates and excludes query/dynamic paths', () => {
    expect(
      resolveSafeErrorPath({
        route: { path: '/me' },
        baseUrl: '/auth',
        originalUrl: '/auth/me?access_token=secret',
      }),
    ).toBe('/auth/me');
    expect(
      resolveSafeErrorPath({
        originalUrl: '/users/private-user-id?token=secret',
      }),
    ).toBeUndefined();
  });
});
