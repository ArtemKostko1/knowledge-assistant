import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureSwagger } from './config/swagger.config.js';
import { createParserApplication } from './common/http/parser-application.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import { SafeExpressAdapter } from './common/http/safe-express.adapter.js';
import { authNoStore } from './modules/auth/auth-http.js';
import { configureLogging, safeLogger } from './common/logging/safe-logger.js';
import { httpCompletion } from './common/logging/http-completion.js';

async function bootstrap(): Promise<void> {
  configureLogging();
  const app = await NestFactory.create(AppModule, new SafeExpressAdapter(), {
    bodyParser: false,
    logger: safeLogger,
  });
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  app.use(httpCompletion);
  app.use(authNoStore);
  configureSwagger(app);
  app.use(createParserApplication().getInstance());
  await app.init();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

void bootstrap().catch(() => {
  safeLogger.startupFailure('BOOTSTRAP_FAILED');
  process.exitCode = 1;
});
