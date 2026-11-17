import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function isSwaggerEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.NODE_ENV === 'production') return false;
  return environment.SWAGGER_ENABLED?.toLowerCase() !== 'false';
}

export function configureSwagger(
  app: INestApplication,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (!isSwaggerEnabled(environment)) return;

  const config = new DocumentBuilder()
    .setTitle('Knowledge Assistant API')
    .setDescription('HTTP API for the Knowledge Assistant application.')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: false },
  });
}
