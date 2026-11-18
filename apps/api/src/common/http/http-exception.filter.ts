import { Catch, Injectable } from '@nestjs/common';
import { SafeLogger } from '../logging/safe-logger.js';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  classifyDiagnosticError,
  classifyHttpException,
  formatHttpErrorResponse,
  resolveSafeErrorPath,
} from './api-error.js';
import type {
  ApiRequestContext,
  ApiResponseContext,
} from './request-context.js';
import { ensureRequestId } from './request-id.middleware.js';
import type { ApiErrorContext } from './api-error.js';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly logger: SafeLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ApiRequestContext>();
    const response = http.getResponse<ApiResponseContext>();
    const adapter = this.adapterHost.httpAdapter;
    const requestId = ensureRequestId(request, response);
    const path = resolveSafeErrorPath(request);
    const context: ApiErrorContext = { requestId, path };
    const classification = classifyHttpException(exception);

    if (classification.statusCode >= 500) {
      try {
        this.logger.application({
          event: 'http.request.failed',
          boundary: 'nest',
          statusCode: classification.statusCode,
          errorCode: classification.code,
          requestId,
          method: request.method,
          route: path,
          diagnosticType: classifyDiagnosticError(exception),
        });
      } catch {
        // Preserve the HTTP error response even if logging fails.
      }
    }

    if (adapter.isHeadersSent(response)) {
      if (!response.writableEnded) adapter.end(response);
      return;
    }

    adapter.setHeader(response, 'X-Request-ID', requestId);
    adapter.reply(
      response,
      formatHttpErrorResponse(classification, context),
      classification.statusCode,
    );
  }
}
