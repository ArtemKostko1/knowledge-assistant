import { readFileSync } from 'node:fs';

describe('Docker context exclusions', () => {
  it('excludes root and nested generated and sensitive files from the context', () => {
    const rules = readFileSync(
      new URL('../../../.dockerignore', import.meta.url),
      'utf8',
    )
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter((rule) => rule.length > 0 && !rule.startsWith('#'));

    const globRegex = (pattern: string): RegExp => {
      let source = '^';
      for (let index = 0; index < pattern.length; index += 1) {
        const character = pattern.charAt(index);
        if (character === '*' && pattern[index + 1] === '*') {
          index += 1;
          if (pattern[index + 1] === '/') {
            source += '(?:.*/)?';
            index += 1;
          } else {
            source += '.*';
          }
        } else if (character === '*') {
          source += '[^/]*';
        } else if (character === '?') {
          source += '[^/]';
        } else {
          source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
      }
      return new RegExp(`${source}$`);
    };

    const excluded = (fixture: string): boolean => {
      const segments = fixture.split('/');
      const candidates = segments.map((_, index) =>
        segments.slice(0, index + 1).join('/'),
      );
      let ignored = false;
      for (const rule of rules) {
        const negated = rule.startsWith('!');
        const pattern = rule.replace(/^!/, '').replace(/^\/+|\/+$/g, '');
        if (candidates.some((candidate) => globRegex(pattern).test(candidate)))
          ignored = !negated;
      }
      return ignored;
    };

    for (const directory of [
      'node_modules',
      '.next',
      'dist',
      'coverage',
      '.turbo',
    ]) {
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
      '.env.production.local',
      '.env.example',
      'apps/worker/.env',
      'apps/worker/.env.production',
      'apps/worker/.env.example',
    ]) {
      expect(excluded(file)).toBe(true);
    }
    for (const file of [
      'private.pem',
      'private.key',
      'apps/api/private.pem',
      'apps/api/private.key',
    ]) {
      expect(excluded(file)).toBe(true);
    }
  });
});
