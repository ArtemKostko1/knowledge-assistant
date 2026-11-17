import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { createParserApplication } from '../src/common/http/parser-application.js';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { SafeExpressAdapter } from '../src/common/http/safe-express.adapter.js';
import { AuthConfig } from '../src/modules/auth/config/auth.config.js';
import { AppUserRepository } from '../src/modules/auth/app-user.repository.js';
import { AuthUserService } from '../src/modules/auth/auth-user.service.js';
import { JwtVerifier } from '../src/modules/auth/jwt-verifier.js';
import { authNoStore } from '../src/modules/auth/auth-http.js';

describe('health endpoint', () => {
  it('returns readiness of the HTTP skeleton', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthConfig)
      .useValue({})
      .overrideProvider(AppUserRepository)
      .useValue({})
      .overrideProvider(AuthUserService)
      .useValue({})
      .overrideProvider(JwtVerifier)
      .useValue({})
      .compile();
    const app = module.createNestApplication(new SafeExpressAdapter(), {
      bodyParser: false,
    });
    app.use(requestIdMiddleware);
    app.use(authNoStore);
    app.use(createParserApplication().getInstance());
    await app.init();
    try {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      await app.close();
    }
  });
});
