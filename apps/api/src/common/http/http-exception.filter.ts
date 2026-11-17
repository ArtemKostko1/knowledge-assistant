import { Catch, Injectable, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  classifyDiagnosticError,
  classifyHttpException,
  formatHttpErrorLog,
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
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

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
      this.logger.error(
        formatHttpErrorLog(classification, {
          requestId,
          method: request.method,
          path,
          diagnosticType: classifyDiagnosticError(exception),
        }),
      );
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
