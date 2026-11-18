import { safeLogger } from '../logging/safe-logger.js';
import {
  classifyDiagnosticError,
  classifyBodyParserError,
  classifyHttpStatus,
  formatHttpErrorResponse,
  resolveSafeErrorPath,
} from './api-error.js';
import type { ApiErrorContext } from './api-error.js';
import type {
  ApiRequestContext,
  ExpressErrorResponse,
  ExpressNext,
} from './request-context.js';
import { ensureRequestId } from './request-id.middleware.js';

export function expressErrorMiddleware(
  exception: unknown,
  request: ApiRequestContext & {
    headers?: { 'content-encoding'?: string };
  },
  response: ExpressErrorResponse,
  next: ExpressNext,
): void {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) {
    next(exception);
    return;
  }

  const requestId = ensureRequestId(request, response);
  const path = resolveSafeErrorPath(request);
  const context: ApiErrorContext = { requestId, path };
  const classification =
    classifyBodyParserError(exception, request.headers?.['content-encoding']) ??
    classifyHttpStatus(500);

  if (classification.statusCode >= 500) {
    try {
      safeLogger.application({
        event: 'http.request.failed',
        boundary: 'parser',
        statusCode: classification.statusCode,
        errorCode: classification.code,
        requestId,
        method: request.method,
        route: path,
        diagnosticType: classifyDiagnosticError(exception),
      });
    } catch {
      // Preserve the parser error response even if logging fails.
    }
  }

  response
    .status(classification.statusCode)
    .json(formatHttpErrorResponse(classification, context));
}
