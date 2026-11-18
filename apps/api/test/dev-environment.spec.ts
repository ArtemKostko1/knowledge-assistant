import { readFileSync } from 'node:fs';
import {
  configureLogging,
  safeLogger,
} from '../src/common/logging/safe-logger.js';

const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

describe('host development environment wiring', () => {
  it('forwards only the host runtime inputs through Turbo', () => {
    const turbo = JSON.parse(
      readFileSync(new URL('../../../turbo.json', import.meta.url), 'utf8'),
    ) as {
      tasks: { dev: { passThroughEnv: string[] } };
    };
    expect(turbo.tasks.dev.passThroughEnv).toEqual([
      'DATABASE_URL',
      'API_INTERNAL_URL',
      'PORT',
      'LOG_LEVEL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_JWT_ISSUER',
      'SUPABASE_JWT_AUDIENCE',
      'SUPABASE_JWT_ALGORITHM',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]);
  });

  it('passes LOG_LEVEL only to the Compose API with an unset-only default', () => {
    const compose = readFileSync(
      new URL('../../../compose.yaml', import.meta.url),
      'utf8',
    );
    const api = compose.match(/^  api:\r?\n([\s\S]*?)(?=^  worker:)/m)?.[1];
    expect(api).toBeDefined();
    expect(api).toMatch(/^      LOG_LEVEL: \$\{LOG_LEVEL-info\}$/m);
    expect(compose.match(/^\s+LOG_LEVEL:/gm)).toHaveLength(1);
  });

  it('applies default, debug and invalid levels to the API logger', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousNestLevel = process.env.NEST_LOG_LEVEL;
    const output: string[] = [];
    const stdout = jestApi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        output.push(chunk.toString());
        return true;
      });
    const stderr = jestApi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk) => {
        output.push(chunk.toString());
        return true;
      });
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEST_LOG_LEVEL = 'fatal';
      configureLogging({ NODE_ENV: 'production' });
      safeLogger.debug('secret-debug');
      expect(output).toHaveLength(0);
      configureLogging({ NODE_ENV: 'production', LOG_LEVEL: 'debug' });
      safeLogger.debug('secret-debug');
      expect(output).toHaveLength(1);
      expect(JSON.parse(output[0] ?? '')).toMatchObject({ level: 'debug' });
      expect(() =>
        configureLogging({
          NODE_ENV: 'production',
          LOG_LEVEL: 'secret-invalid',
        }),
      ).toThrow('Invalid logging configuration');
      expect(() =>
        configureLogging({ NODE_ENV: 'production', LOG_LEVEL: '' }),
      ).toThrow('Invalid logging configuration');
      expect(output.join('')).not.toContain('secret');
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousNestLevel === undefined) delete process.env.NEST_LOG_LEVEL;
      else process.env.NEST_LOG_LEVEL = previousNestLevel;
      configureLogging({ NODE_ENV: previousNodeEnv });
      stdout.mockRestore();
      stderr.mockRestore();
    }
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
