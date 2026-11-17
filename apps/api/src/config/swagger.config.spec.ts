import { isSwaggerEnabled } from './swagger.config.js';

describe('Swagger availability policy', () => {
  it('enables documentation by default outside production', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it('allows documentation to be disabled outside production', () => {
    expect(
      isSwaggerEnabled({
        NODE_ENV: 'development',
        SWAGGER_ENABLED: 'false',
      }),
    ).toBe(false);
  });

  it('keeps documentation disabled in production even when explicitly enabled', () => {
    expect(
      isSwaggerEnabled({
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
      }),
    ).toBe(false);
  });
});
