import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  OpenAPIObject,
  OperationObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { createParserApplication } from '../src/common/http/parser-application.js';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { SafeExpressAdapter } from '../src/common/http/safe-express.adapter.js';
import { configureSwagger } from '../src/config/swagger.config.js';
import { AppUserRepository } from '../src/modules/auth/app-user.repository.js';
import { authNoStore } from '../src/modules/auth/auth-http.js';
import { AuthConfig } from '../src/modules/auth/config/auth.config.js';
import { AuthUserService } from '../src/modules/auth/auth-user.service.js';
import { JwtVerifier } from '../src/modules/auth/jwt-verifier.js';

const profileId = 'a1234567-1234-4123-8123-123456789abc';
const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T04:05:06.000Z');
const profile = {
  id: profileId,
  email: 'user@example.test',
  createdAt,
  updatedAt,
  internalOnly: 'internal-persistence-value',
};
const expectedProfile = {
  id: profileId,
  email: profile.email,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
};

async function createTestApp(
  environment: NodeJS.ProcessEnv,
): Promise<INestApplication> {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AuthConfig)
    .useValue({})
    .overrideProvider(JwtVerifier)
    .useValue({
      verify: async (token: string) => ({ id: profileId, token }),
    })
    .overrideProvider(AuthUserService)
    .useValue({ confirmedEmail: async () => profile.email })
    .overrideProvider(AppUserRepository)
    .useValue({
      upsert: async () => profile,
      find: async () => profile,
    })
    .compile();
  const app = module.createNestApplication(new SafeExpressAdapter(), {
    bodyParser: false,
  });
  app.use(requestIdMiddleware);
  app.use(authNoStore);
  configureSwagger(app, environment);
  app.use(createParserApplication().getInstance());
  await app.init();
  return app;
}

function operation(
  document: OpenAPIObject,
  path: string,
  method: 'get' | 'post',
): OperationObject {
  const route = document.paths[path]?.[method];
  if (!route) throw new Error(`Missing OpenAPI operation: ${method} ${path}`);
  return route;
}

function responseSchema(
  operationObject: OperationObject,
  status: string,
): SchemaObject | undefined {
  return responseObject(operationObject, status)?.content?.['application/json']
    ?.schema as SchemaObject | undefined;
}

function responseObject(
  operationObject: OperationObject,
  status: string,
): ResponseObject | undefined {
  const response = operationObject.responses[status];
  if (!response || '$ref' in response) return undefined;
  return response;
}

describe('OpenAPI contract', () => {
  it('documents existing routes and preserves their HTTP behavior', async () => {
    const app = await createTestApp({ NODE_ENV: 'test' });
    try {
      const documentResponse = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
        .expect('Content-Type', /application\/json/);
      const document = documentResponse.body as OpenAPIObject;

      expect(Object.keys(document.paths).sort()).toEqual([
        '/auth/bootstrap',
        '/auth/me',
        '/health',
      ]);
      expect(document.paths['/health']?.get).toBeDefined();
      expect(document.paths['/health']?.post).toBeUndefined();
      expect(document.paths['/auth/bootstrap']?.post).toBeDefined();
      expect(document.paths['/auth/bootstrap']?.get).toBeUndefined();
      expect(document.paths['/auth/me']?.get).toBeDefined();
      expect(document.paths['/auth/me']?.post).toBeUndefined();

      const health = operation(document, '/health', 'get');
      const bootstrap = operation(document, '/auth/bootstrap', 'post');
      const me = operation(document, '/auth/me', 'get');
      expect(health.security).toBeUndefined();
      expect(bootstrap.security).toEqual([{ bearer: [] }]);
      expect(me.security).toEqual([{ bearer: [] }]);
      expect(document.components?.securitySchemes?.bearer).toMatchObject({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });

      for (const endpoint of [health, bootstrap, me]) {
        expect(endpoint.requestBody).toBeUndefined();
        expect(endpoint.parameters ?? []).toEqual([]);
      }

      expect(responseSchema(health, '200')).toMatchObject({
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ok'], example: 'ok' },
        },
      });
      expect(
        responseObject(health, '200')?.headers?.['X-Request-ID'],
      ).toBeDefined();

      const profileSchema = document.components?.schemas
        ?.AppUserProfileResponse as SchemaObject | undefined;
      expect(Object.keys(profileSchema?.properties ?? {}).sort()).toEqual([
        'createdAt',
        'email',
        'id',
        'updatedAt',
      ]);
      expect(profileSchema?.required).toEqual([
        'id',
        'email',
        'createdAt',
        'updatedAt',
      ]);
      expect(profileSchema?.properties?.id).toMatchObject({
        type: 'string',
        format: 'uuid',
      });
      expect(profileSchema?.properties?.email).toMatchObject({
        type: 'string',
        format: 'email',
      });
      expect(profileSchema?.properties?.createdAt).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
      expect(profileSchema?.properties?.updatedAt).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
      expect(responseSchema(bootstrap, '200')).toEqual({
        $ref: '#/components/schemas/AppUserProfileResponse',
      });
      expect(responseSchema(me, '200')).toEqual({
        $ref: '#/components/schemas/AppUserProfileResponse',
      });

      const documentedStatuses = (
        endpoint: OperationObject,
        statuses: string[],
      ): void => {
        for (const status of statuses) {
          expect(responseObject(endpoint, status)).toBeDefined();
          expect(
            responseObject(endpoint, status)?.headers?.['Cache-Control'],
          ).toBeDefined();
        }
      };
      documentedStatuses(bootstrap, ['200', '400', '401', '403', '500', '503']);
      documentedStatuses(me, ['200', '400', '401', '404', '500', '503']);
      for (const endpoint of [bootstrap, me]) {
        for (const status of Object.keys(endpoint.responses)) {
          expect(
            responseObject(endpoint, status)?.headers?.['X-Request-ID'],
          ).toBeDefined();
        }
      }
      expect(responseSchema(bootstrap, '400')).toMatchObject({
        $ref: '#/components/schemas/ApiErrorResponseDto',
      });
      expect(responseSchema(me, '500')).toEqual({
        $ref: '#/components/schemas/ApiErrorResponseDto',
      });
      expect(responseSchema(health, '500')).toEqual({
        $ref: '#/components/schemas/ApiErrorResponseDto',
      });
      expect(responseSchema(health, '413')).toEqual({
        $ref: '#/components/schemas/ApiErrorResponseDto',
      });
      for (const status of ['400', '415']) {
        expect(responseSchema(health, status)).toEqual({
          $ref: '#/components/schemas/ApiErrorResponseDto',
        });
        expect(
          responseObject(health, status)?.headers?.['X-Request-ID'],
        ).toBeDefined();
      }
      expect(
        responseObject(health, '413')?.headers?.['X-Request-ID'],
      ).toBeDefined();
      const errorSchema = document.components?.schemas?.ApiErrorResponseDto as
        SchemaObject | undefined;
      expect(errorSchema?.required).toEqual([
        'statusCode',
        'error',
        'requestId',
        'timestamp',
      ]);
      expect(errorSchema?.properties?.statusCode).toMatchObject({
        type: 'integer',
        minimum: 400,
        maximum: 599,
      });
      expect(errorSchema?.properties?.error).toEqual({
        $ref: '#/components/schemas/ApiErrorBodyResponse',
      });
      expect(errorSchema?.properties?.requestId).toMatchObject({
        type: 'string',
        format: 'uuid',
      });
      expect(errorSchema?.properties?.timestamp).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
      expect(errorSchema?.properties?.path).toMatchObject({
        type: 'string',
      });
      const errorBodySchema = document.components?.schemas
        ?.ApiErrorBodyResponse as SchemaObject | undefined;
      expect(errorBodySchema?.required).toEqual(['type', 'code', 'message']);
      expect(errorBodySchema?.properties?.details).toEqual({
        type: 'array',
        items: {
          $ref: '#/components/schemas/ApiValidationErrorDetailResponse',
        },
      });

      await request(app.getHttpServer())
        .get('/docs')
        .expect(200)
        .expect('Content-Type', /text\/html/);
      await request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });

      const bootstrapResponse = await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(bootstrapResponse.body).toEqual(expectedProfile);
      expect(Object.keys(bootstrapResponse.body).sort()).toEqual(
        Object.keys(profileSchema?.properties ?? {}).sort(),
      );
      expect(bootstrapResponse.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(meResponse.body).toEqual(expectedProfile);
      expect(Object.keys(meResponse.body).sort()).toEqual(
        Object.keys(profileSchema?.properties ?? {}).sort(),
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401)
        .expect('Cache-Control', 'no-store');
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      name: 'production hard-off',
      environment: { NODE_ENV: 'production', SWAGGER_ENABLED: 'true' },
    },
    {
      name: 'explicit non-production opt-out',
      environment: { NODE_ENV: 'test', SWAGGER_ENABLED: 'false' },
    },
  ])(
    '$name leaves documentation routes unregistered',
    async ({ environment }) => {
      const app = await createTestApp(environment);
      try {
        await request(app.getHttpServer()).get('/docs').expect(404);
        await request(app.getHttpServer()).get('/docs-json').expect(404);
        await request(app.getHttpServer()).get('/docs-yaml').expect(404);
        await request(app.getHttpServer())
          .get('/docs/swagger-ui-init.js')
          .expect(404);
        await request(app.getHttpServer())
          .get('/health')
          .expect(200)
          .expect({ status: 'ok' });
        await request(app.getHttpServer())
          .get('/auth/me')
          .expect(401)
          .expect('Cache-Control', 'no-store');
      } finally {
        await app.close();
      }
    },
  );
});
