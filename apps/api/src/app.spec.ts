import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module.js';

describe('health endpoint', () => {
  it('returns readiness of the HTTP skeleton', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
