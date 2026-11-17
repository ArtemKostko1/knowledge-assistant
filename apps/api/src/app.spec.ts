import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module.js';
import { AuthConfig } from './auth/auth.config.js';
import { AppUserRepository } from './auth/app-user.repository.js';
import { AuthUserService } from './auth/auth-user.service.js';
import { JwtVerifier } from './auth/jwt-verifier.js';

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
    const app = module.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});
