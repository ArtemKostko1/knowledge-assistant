import { readFileSync } from 'node:fs';

describe('Docker context exclusions', () => {
  it('covers root and nested generated/secret fixtures but retains example files', () => {
    const rules = readFileSync(
      new URL('../../../.dockerignore', import.meta.url),
      'utf8',
    )
      .split(/\r?\n/)
      .filter(Boolean);
    const excluded = (fixture: string): boolean => {
      const segments = fixture.split('/');
      const name = segments[segments.length - 1];
      if (name === '.env.example') return false;
      return (
        segments.some((part) => rules.includes(`**/${part}`)) ||
        (name !== undefined &&
          /^\.env(?:\..+)?$/.test(name) &&
          rules.includes('**/.env.*'))
      );
    };
    for (const directory of [
      'node_modules',
      '.next',
      'dist',
      'coverage',
      '.turbo',
    ]) {
      expect(rules).toContain(directory);
      expect(rules).toContain(`**/${directory}`);
      for (const fixture of [
        `${directory}/fixture`,
        `apps/api/${directory}/fixture`,
      ]) {
        expect(excluded(fixture)).toBe(true);
      }
    }
    for (const file of [
      '.env',
      '.env.local',
      'apps/worker/.env',
      'apps/worker/.env.production',
    ]) {
      expect(excluded(file)).toBe(true);
    }
    expect(excluded('.env.example')).toBe(false);
    expect(excluded('apps/worker/.env.example')).toBe(false);
    expect(rules).toEqual(
      expect.arrayContaining([
        '.env',
        '**/.env',
        '.env.*',
        '**/.env.*',
        '!.env.example',
        '!**/.env.example',
      ]),
    );
  });
});
