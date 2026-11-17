import { ExpressAdapter } from '@nestjs/platform-express';
import { expressErrorMiddleware } from './express-error.middleware.js';

export function createParserApplication(
  errorHandler: typeof expressErrorMiddleware = expressErrorMiddleware,
): ExpressAdapter {
  const parser = new ExpressAdapter();
  parser.registerParserMiddleware(undefined, false);
  parser.use(errorHandler);
  return parser;
}
