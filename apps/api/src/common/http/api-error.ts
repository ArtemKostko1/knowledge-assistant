import { HttpException } from '@nestjs/common';
import { constants as zlibConstants } from 'node:zlib';

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'AUTH_UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'PAYLOAD_TOO_LARGE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_SERVER_ERROR',
  'HTTP_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const API_ERROR_TYPES = [
  'BadRequestError',
  'AuthenticationError',
  'ForbiddenError',
  'NotFoundError',
  'ConflictError',
  'UnprocessableEntityError',
  'TooManyRequestsError',
  'PayloadTooLargeError',
  'ServiceUnavailableError',
  'InternalServerError',
  'HttpError',
] as const;

export type ApiErrorType = (typeof API_ERROR_TYPES)[number];

export const VALIDATION_DETAIL_CODES = [
  'REQUIRED',
  'INVALID_FORMAT',
  'INVALID_VALUE',
] as const;

export type ValidationDetailCode = (typeof VALIDATION_DETAIL_CODES)[number];

export interface ApiValidationDetail {
  field: string;
  code: ValidationDetailCode;
}

export interface ApiErrorBody {
  type: ApiErrorType;
  code: ApiErrorCode;
  message: string;
  details?: ApiValidationDetail[];
}

export interface ApiErrorResponse {
  statusCode: number;
  error: ApiErrorBody;
  requestId: string;
  timestamp: string;
  path?: string;
}

export interface HttpErrorClassification {
  statusCode: number;
  type: ApiErrorType;
  code: ApiErrorCode;
  message: string;
  details?: readonly ApiValidationDetail[];
}

export interface ApiErrorContext {
  requestId: string;
  path?: string;
  timestamp?: Date;
}

export interface RequestPathContext {
  baseUrl?: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: unknown };
}

export type DiagnosticErrorType =
  'TypeError' | 'ReferenceError' | 'RangeError' | 'UnknownError';

export function classifyDiagnosticError(error: unknown): DiagnosticErrorType {
  try {
    if (error instanceof TypeError) return 'TypeError';
    if (error instanceof ReferenceError) return 'ReferenceError';
    if (error instanceof RangeError) return 'RangeError';
  } catch {
    return 'UnknownError';
  }
  return 'UnknownError';
}

interface ErrorDefinition {
  type: ApiErrorType;
  code: ApiErrorCode;
  message: string;
}

const ERROR_DEFINITIONS: Readonly<Record<number, ErrorDefinition>> = {
  400: {
    type: 'BadRequestError',
    code: 'BAD_REQUEST',
    message: 'The request is invalid',
  },
  401: {
    type: 'AuthenticationError',
    code: 'AUTH_UNAUTHORIZED',
    message: 'Authentication is required',
  },
  403: {
    type: 'ForbiddenError',
    code: 'FORBIDDEN',
    message: 'Access is forbidden',
  },
  404: {
    type: 'NotFoundError',
    code: 'NOT_FOUND',
    message: 'The requested resource was not found',
  },
  409: {
    type: 'ConflictError',
    code: 'CONFLICT',
    message: 'The request conflicts with the current resource state',
  },
  413: {
    type: 'PayloadTooLargeError',
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request body is too large',
  },
  422: {
    type: 'UnprocessableEntityError',
    code: 'UNPROCESSABLE_ENTITY',
    message: 'The request could not be processed',
  },
  429: {
    type: 'TooManyRequestsError',
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests',
  },
  500: {
    type: 'InternalServerError',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  },
  503: {
    type: 'ServiceUnavailableError',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable',
  },
};

const SAFE_PUBLIC_MESSAGES: Readonly<Record<number, readonly string[]>> = {
  400: ['This endpoint accepts no input'],
  401: ['Bearer token required', 'Invalid access token'],
  403: ['Confirmed email required'],
  404: ['User not bootstrapped'],
  503: ['Authentication service unavailable', 'User store unavailable'],
};

const KNOWN_ROUTE_PATHS = ['/health', '/auth/bootstrap', '/auth/me'] as const;

const BODY_PARSER_ERROR_STATUSES: Readonly<Record<string, number>> = {
  'entity.parse.failed': 400,
  'entity.too.large': 413,
  'entity.verify.failed': 403,
  'encoding.unsupported': 415,
  'charset.unsupported': 415,
  'request.aborted': 400,
  'request.size.invalid': 400,
  'parameters.too.many': 413,
  'querystring.parse.rangeError': 400,
};

// Only format failures are client input errors; allocation/internal decoder
// errors must remain 500. The parser boundary establishes provenance.
const BROTLI_FORMAT_ERRORS = new Map(
  Object.entries(zlibConstants)
    .filter(([name]) => name.startsWith('BROTLI_DECODER_ERROR_FORMAT_'))
    .map(([name, value]) => [
      `ERR__ERROR_${name.slice('BROTLI_DECODER_ERROR_'.length)}`,
      value,
    ]),
);

const VALIDATION_FIELD_PATTERN =
  /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeStatusDefinition(statusCode: number): ErrorDefinition & {
  statusCode: number;
} {
  const validStatus =
    Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599;
  const normalizedStatus = validStatus ? statusCode : 500;
  const knownDefinition = ERROR_DEFINITIONS[normalizedStatus];

  return {
    statusCode: normalizedStatus,
    ...(knownDefinition ?? {
      type: 'HttpError' as const,
      code: 'HTTP_ERROR' as const,
      message: 'The request could not be completed',
    }),
  };
}

function safeHttpExceptionMessage(
  statusCode: number,
  response: unknown,
): string | undefined {
  const responseMessage =
    typeof response === 'string'
      ? response
      : isRecord(response) && typeof response.message === 'string'
        ? response.message
        : undefined;

  return responseMessage &&
    SAFE_PUBLIC_MESSAGES[statusCode]?.includes(responseMessage)
    ? responseMessage
    : undefined;
}

export function classifyHttpStatus(
  statusCode: number,
  knownMessage?: string,
): HttpErrorClassification {
  const definition = safeStatusDefinition(statusCode);
  const safeMessage =
    knownMessage &&
    SAFE_PUBLIC_MESSAGES[definition.statusCode]?.includes(knownMessage)
      ? knownMessage
      : definition.message;

  return {
    statusCode: definition.statusCode,
    type: definition.type,
    code: definition.code,
    message: safeMessage,
  };
}

export function classifyHttpException(
  exception: unknown,
): HttpErrorClassification {
  try {
    if (!(exception instanceof HttpException)) {
      return classifyHttpStatus(500);
    }
    const statusCode = exception.getStatus();
    const classification = classifyHttpStatus(statusCode);
    const safeMessage = safeHttpExceptionMessage(
      classification.statusCode,
      exception.getResponse(),
    );

    return safeMessage
      ? { ...classification, message: safeMessage }
      : classification;
  } catch {
    return classifyHttpStatus(500);
  }
}

export function classifyBodyParserError(
  exception: unknown,
  contentEncoding?: string,
): HttpErrorClassification | undefined {
  try {
    if (!(exception instanceof Error) || !isRecord(exception)) return undefined;
    if (
      contentEncoding?.toLowerCase() === 'zstd' &&
      exception.type === undefined &&
      ((exception.code === 'ZSTD_error_prefix_unknown' &&
        exception.errno === zlibConstants.ZSTD_error_prefix_unknown) ||
        (exception.code === 'Z_BUF_ERROR' &&
          exception.errno === zlibConstants.Z_BUF_ERROR))
    ) {
      return classifyHttpStatus(400);
    }
    if (
      (contentEncoding?.toLowerCase() === 'gzip' ||
        contentEncoding?.toLowerCase() === 'deflate') &&
      (exception.code === 'Z_DATA_ERROR' || exception.code === 'Z_BUF_ERROR') &&
      exception.type === undefined
    ) {
      return classifyHttpStatus(400);
    }
    if (
      contentEncoding?.toLowerCase() === 'br' &&
      exception.type === undefined &&
      (exception.code === 'Z_BUF_ERROR' ||
        (typeof exception.code === 'string' &&
          typeof exception.errno === 'number' &&
          BROTLI_FORMAT_ERRORS.get(exception.code) === exception.errno))
    ) {
      return classifyHttpStatus(400);
    }
    const type = exception.type;
    if (typeof type !== 'string') return undefined;

    const statusCode = BODY_PARSER_ERROR_STATUSES[type];
    return statusCode === undefined
      ? undefined
      : classifyHttpStatus(statusCode);
  } catch {
    return undefined;
  }
}

export function resolveSafeErrorPath(
  request: RequestPathContext,
): string | undefined {
  const routePath = request.route?.path;
  if (typeof routePath === 'string') {
    const matchedRoute = normalizeKnownPath(
      `${request.baseUrl ?? ''}${routePath}`,
    );
    if (matchedRoute) return matchedRoute;
  }

  for (const candidate of [request.path, request.originalUrl, request.url]) {
    if (typeof candidate !== 'string') continue;
    const matchedPath = normalizeKnownPath(candidate);
    if (matchedPath) return matchedPath;
  }

  return undefined;
}

function normalizeKnownPath(candidate: string): string | undefined {
  const pathname = candidate.split('?')[0]?.replace(/\/+$/, '').toLowerCase();
  return KNOWN_ROUTE_PATHS.find((path) => path === (pathname || '/'));
}

function sanitizeDetails(
  details: readonly ApiValidationDetail[] | undefined,
): ApiValidationDetail[] | undefined {
  if (!Array.isArray(details) || details.length === 0) return undefined;

  const safeDetails: ApiValidationDetail[] = [];
  for (const detail of details) {
    if (!isRecord(detail)) continue;
    const field = detail.field;
    const code = detail.code;
    if (typeof field !== 'string' || !VALIDATION_FIELD_PATTERN.test(field)) {
      continue;
    }
    if (typeof code !== 'string') {
      continue;
    }
    const safeCode = VALIDATION_DETAIL_CODES.find(
      (knownCode) => knownCode === code,
    );
    if (safeCode) safeDetails.push({ field, code: safeCode });
  }
  return safeDetails.length ? safeDetails : undefined;
}

export function formatHttpErrorResponse(
  classification: HttpErrorClassification,
  context: ApiErrorContext,
): ApiErrorResponse {
  const safeClassification = safeStatusDefinition(classification.statusCode);
  const safeMessage =
    classification.message === safeClassification.message ||
    SAFE_PUBLIC_MESSAGES[safeClassification.statusCode]?.includes(
      classification.message,
    )
      ? classification.message
      : safeClassification.message;
  const details =
    safeClassification.statusCode === 422
      ? sanitizeDetails(classification.details)
      : undefined;
  const path = context.path ? normalizeKnownPath(context.path) : undefined;

  return {
    statusCode: safeClassification.statusCode,
    error: {
      type: safeClassification.type,
      code: safeClassification.code,
      message: safeMessage,
      ...(details ? { details } : {}),
    },
    requestId: context.requestId,
    timestamp: (context.timestamp ?? new Date()).toISOString(),
    ...(path ? { path } : {}),
  };
}

export function formatHttpErrorLog(
  classification: HttpErrorClassification,
  context: {
    requestId: string;
    method?: string;
    path?: string;
    diagnosticType?: DiagnosticErrorType;
  },
): string {
  const method =
    context.method && /^[A-Z]{1,10}$/.test(context.method)
      ? context.method
      : 'UNKNOWN';

  return [
    `HTTP ${classification.statusCode}`,
    `code=${classification.code}`,
    `type=${classification.type}`,
    `diagnosticType=${context.diagnosticType ?? 'UnknownError'}`,
    `requestId=${context.requestId}`,
    `method=${method}`,
    `path=${context.path ?? '-'}`,
  ].join(' ');
}
