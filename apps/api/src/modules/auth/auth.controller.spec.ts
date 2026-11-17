import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../../app.module.js';
import { AuthConfig } from './config/auth.config.js';
import { JwtVerifier } from './jwt-verifier.js';
import { AuthUserService } from './auth-user.service.js';
import { AppUserRepository } from './app-user.repository.js';
import { authNoStore } from './auth-http.js';
const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

describe('authentication HTTP boundary (no database/network)', () => {
  it('guards input, bootstraps from fresh Auth data, and keeps me read-only', async () => {
    const id = 'a1234567-1234-4123-8123-123456789abc';
    const config = new AuthConfig(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      'http://127.0.0.1:54321/auth/v1',
      'authenticated',
      'ES256',
      'unused',
    );
    const pair = await generateKeyPair('ES256');
    const keys = createLocalJWKSet({ keys: [await exportJWK(pair.publicKey)] });
    const verifier = new JwtVerifier(config);
    const token = (expired = false) =>
      new SignJWT({ role: 'authenticated', email: 'stale@example.test' })
        .setProtectedHeader({ alg: 'ES256' })
        .setSubject(id)
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt()
        .setExpirationTime(expired ? 1 : '5m')
        .sign(pair.privateKey);
    const createdAt = new Date('2026-01-02T03:04:05.000Z');
    const updatedAt = new Date('2026-01-03T04:05:06.000Z');
    const expectedProfile = {
      id,
      email: 'current@example.test',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
    let row: {
      id: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
    } | null = null;
    const users = {
      upsert: jestApi.fn(async (userId: string, email: string) => {
        row = { id: userId, email, createdAt, updatedAt };
        return row;
      }),
      find: jestApi.fn(async () => row),
    };
    const auth = {
      confirmedEmail: jestApi.fn(async () => 'current@example.test'),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthConfig)
      .useValue(config)
      .overrideProvider(JwtVerifier)
      .useValue({ verify: (value: string) => verifier.verify(value, keys) })
      .overrideProvider(AuthUserService)
      .useValue(auth)
      .overrideProvider(AppUserRepository)
      .useValue(users)
      .compile();
    const app = module.createNestApplication();
    app.use(authNoStore);
    await app.init();
    try {
      const bearer = `Bearer ${await token()}`;
      await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Authorization', bearer)
        .set('Content-Type', 'application/json')
        .send('{')
        .expect(400)
        .expect('Cache-Control', 'no-store');
      for (const route of ['/auth/me', '/auth/bootstrap']) {
        const call = route.endsWith('me')
          ? request(app.getHttpServer()).get(route)
          : request(app.getHttpServer()).post(route);
        await call.expect(401).expect('Cache-Control', 'no-store');
      }
      await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Authorization', `Bearer ${await token(true)}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', bearer)
        .expect(404)
        .expect('Cache-Control', 'no-store');
      for (const body of [
        { id: 'attacker' },
        { email: 'attacker@example.test' },
        {},
        [],
      ]) {
        await request(app.getHttpServer())
          .post('/auth/bootstrap')
          .set('Authorization', bearer)
          .send(body)
          .expect(400);
      }
      await request(app.getHttpServer())
        .post('/auth/bootstrap?id=attacker')
        .set('Authorization', bearer)
        .expect(400);
      await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Authorization', bearer)
        .set('Content-Type', 'text/plain')
        .send('attacker')
        .expect(400);
      expect(users.upsert).not.toHaveBeenCalled();
      expect(auth.confirmedEmail).not.toHaveBeenCalled();
      auth.confirmedEmail.mockRejectedValueOnce(
        new ForbiddenException('Confirmed email required'),
      );
      await request(app.getHttpServer())
        .post('/auth/bootstrap')
        .set('Authorization', bearer)
        .expect(403);
      expect(users.upsert).not.toHaveBeenCalled();
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/auth/bootstrap')
          .set('Authorization', bearer)
          .expect(200)
          .expect('Cache-Control', 'no-store')
          .expect(expectedProfile);
      }
      expect(users.upsert).toHaveBeenNthCalledWith(
        1,
        id,
        'current@example.test',
      );
      expect(auth.confirmedEmail).toHaveBeenCalledTimes(3);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', bearer)
        .expect(200)
        .expect(expectedProfile);
      expect(users.upsert).toHaveBeenCalledTimes(2);
      expect(auth.confirmedEmail).toHaveBeenCalledTimes(3);
      expect(users.find).toHaveBeenLastCalledWith(id);
    } finally {
      await app.close();
    }
  });
});
