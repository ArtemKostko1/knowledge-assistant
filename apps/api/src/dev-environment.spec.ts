import { readFileSync } from 'node:fs';

describe('host development environment wiring', () => {
  it('forwards only the host runtime inputs through Turbo', () => {
    const turbo = JSON.parse(
      readFileSync(new URL('../../../turbo.json', import.meta.url), 'utf8'),
    ) as {
      tasks: { dev: { passThroughEnv: string[] } };
    };
    expect(turbo.tasks.dev.passThroughEnv).toEqual(['DATABASE_URL', 'PORT']);
  });

  it('loads the root env file for API and worker, without requiring a database', () => {
    const api = readFileSync(
      new URL('../scripts/dev.mjs', import.meta.url),
      'utf8',
    );
    const worker = JSON.parse(
      readFileSync(
        new URL('../../worker/package.json', import.meta.url),
        'utf8',
      ),
    ) as {
      scripts: { dev: string };
    };
    expect(api).toContain('--env-file-if-exists=../../.env');
    expect(worker.scripts.dev).toContain('--env-file-if-exists=../../.env');
  });
});
