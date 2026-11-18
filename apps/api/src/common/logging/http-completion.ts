import type {
  ApiRequestContext,
  ExpressNext,
} from '../http/request-context.js';
import { resolveSafeErrorPath } from '../http/api-error.js';
import { safeLogger } from './safe-logger.js';
import type { SafeLogger } from './safe-logger.js';

interface CompletionResponse {
  statusCode: number;
  once(event: 'finish' | 'close', listener: () => void): unknown;
}

export function createHttpCompletion(
  logger: SafeLogger = safeLogger,
  clock: () => number = () => performance.now(),
): (
  req: ApiRequestContext,
  res: CompletionResponse,
  next: ExpressNext,
) => void {
  return (req, res, next): void => {
    let start: number;
    try {
      start = clock();
    } catch {
      next();
      return;
    }
    let recorded = false;
    const complete = (outcome: 'finished' | 'aborted'): void => {
      if (recorded) return;
      recorded = true;
      try {
        const route = resolveSafeErrorPath(req);
        if (
          outcome === 'finished' &&
          req.method === 'GET' &&
          route === '/health' &&
          res.statusCode === 200
        )
          return;
        if (!req.requestId) return;
        logger.application({
          event: 'http.request.completed',
          requestId: req.requestId,
          method: req.method,
          route,
          outcome,
          ...(outcome === 'finished' ? { statusCode: res.statusCode } : {}),
          durationMs: Math.round(Math.max(0, clock() - start) * 10) / 10,
        });
      } catch {
        // Completion instrumentation must not interrupt the response lifecycle.
      }
    };
    res.once('finish', () => complete('finished'));
    res.once('close', () => complete('aborted'));
    next();
  };
}

export const httpCompletion = createHttpCompletion();
