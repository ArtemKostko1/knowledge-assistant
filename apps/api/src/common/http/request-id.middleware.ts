import { randomUUID } from 'node:crypto';
import type {
  ApiRequestContext,
  ApiResponseContext,
  ExpressNext,
} from './request-context.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureRequestId(
  request: ApiRequestContext,
  response: ApiResponseContext,
): string {
  const requestId =
    request.requestId && UUID_PATTERN.test(request.requestId)
      ? request.requestId
      : randomUUID();

  request.requestId = requestId;
  if (!response.headersSent) {
    response.setHeader('X-Request-ID', requestId);
  }
  return requestId;
}

export function requestIdMiddleware(
  request: ApiRequestContext,
  response: ApiResponseContext,
  next: ExpressNext,
): void {
  request.requestId = randomUUID();
  response.setHeader('X-Request-ID', request.requestId);
  next();
}
