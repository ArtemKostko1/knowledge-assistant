import { Logger } from '@nestjs/common';
import {
  classifyDiagnosticError,
  classifyBodyParserError,
  classifyHttpStatus,
  formatHttpErrorLog,
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

const logger = new Logger('ExpressErrorBoundary');

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
    logger.error(
      formatHttpErrorLog(classification, {
        requestId,
        method: request.method,
        path,
        diagnosticType: classifyDiagnosticError(exception),
      }),
    );
  }

  response
    .status(classification.statusCode)
    .json(formatHttpErrorResponse(classification, context));
}
