import {
  classifyHttpStatus,
  formatHttpErrorResponse,
  resolveSafeErrorPath,
} from '../../common/http/api-error.js';
import type { ApiRequestContext } from '../../common/http/request-context.js';
import type {
  ApiResponseContext,
  ExpressNext,
} from '../../common/http/request-context.js';
import { ensureRequestId } from '../../common/http/request-id.middleware.js';

// Install before Nest's body parser to reject non-empty input without parsing it.
export function authNoStore(
  req: ApiRequestContext & {
    headers: { 'content-length'?: string; 'transfer-encoding'?: string };
  },
  res: ApiResponseContext & {
    status(code: number): { json(body: object): void };
  },
  next: ExpressNext,
): void {
  const path = req.url?.split('?')[0]?.replace(/\/+$/, '').toLowerCase();
  const requestId = ensureRequestId(req, res);
  if (path === '/auth/bootstrap' || path === '/auth/me') {
    res.setHeader('Cache-Control', 'no-store');
    // Reject payloads before JSON parsing: parser errors must not echo their contents.
    if (
      Number(req.headers['content-length'] ?? 0) > 0 ||
      req.headers['transfer-encoding']
    ) {
      res.status(400).json(
        formatHttpErrorResponse(
          classifyHttpStatus(400, 'This endpoint accepts no input'),
          {
            requestId,
            path: resolveSafeErrorPath(req),
          },
        ),
      );
      return;
    }
  }
  next();
}
