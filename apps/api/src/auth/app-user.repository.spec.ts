import { execFileSync } from 'node:child_process';
import { Test } from '@nestjs/testing';
import { AppUserRepository } from './app-user.repository.js';
import { AuthConfig } from './auth.config.js';
const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

describe('database runtime foundation (no connection or writes)', () => {
  it('awaits Prisma disconnect when the Nest application closes', async () => {
    const repository = new AppUserRepository(
      new AuthConfig(
        'http://unused',
        'sb_publishable_test',
        'http://unused/auth/v1',
        'authenticated',
        'ES256',
        'postgresql://unused:unused@127.0.0.1:1/unused',
      ),
    );
    await repository.onModuleDestroy();
    let disconnected = false;
    const disconnect = jestApi.fn(async () => {
      await Promise.resolve();
      disconnected = true;
    });
    Object.defineProperty(repository, 'db', {
      value: { $disconnect: disconnect },
    });
    const module = await Test.createTestingModule({
      providers: [{ provide: AppUserRepository, useValue: repository }],
    }).compile();
    const app = module.createNestApplication();
    try {
      await app.init();
    } finally {
      await app.close();
    }
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(disconnected).toBe(true);
  });
  it('loads the compiled ESM database package in plain Node', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          "import { createDatabase } from '@knowledge-assistant/database'; const db = createDatabase('postgresql://unused:unused@127.0.0.1:1/unused'); await db.$disconnect();",
        ],
        { cwd: new URL('../../', import.meta.url) },
      ),
    ).not.toThrow();
  });
  it('uses a single UUID-keyed native upsert and never upserts during reads', async () => {
    const config = new AuthConfig(
      'http://unused',
      'sb_publishable_test',
      'http://unused/auth/v1',
      'authenticated',
      'ES256',
      'postgresql://unused:unused@127.0.0.1:1/unused',
    );
    const repository = new AppUserRepository(config);
    await repository.onModuleDestroy();
    const upsert = jestApi
      .fn()
      .mockResolvedValue({ id: 'checked-id', email: 'fresh@example.test' });
    const findUnique = jestApi.fn().mockResolvedValue(null);
    Object.defineProperty(repository, 'db', {
      value: { appUser: { upsert, findUnique } },
    });
    await Promise.all([
      repository.upsert('checked-id', 'fresh@example.test'),
      repository.upsert('checked-id', 'fresh@example.test'),
    ]);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenLastCalledWith({
      where: { id: 'checked-id' },
      create: { id: 'checked-id', email: 'fresh@example.test' },
      update: { email: 'fresh@example.test' },
    });
    await expect(repository.find('checked-id')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'checked-id' } });
    expect(upsert).toHaveBeenCalledTimes(2);
    upsert.mockRejectedValueOnce(new Error('database connection secret'));
    await expect(
      repository.upsert('checked-id', 'fresh@example.test'),
    ).rejects.toMatchObject({ status: 503, message: 'User store unavailable' });
  });
});
