import { requireDatabaseUrl } from './config.js';

describe('worker configuration', () => {
  it('requires a database URL for queue startup', () => {
    expect(() => requireDatabaseUrl(undefined)).toThrow(
      'DATABASE_URL must be set',
    );
    expect(() => requireDatabaseUrl('')).toThrow('DATABASE_URL must be set');
  });

  it('accepts a configured URL', () => {
    expect(requireDatabaseUrl('postgresql://localhost/test')).toBe(
      'postgresql://localhost/test',
    );
  });
});
