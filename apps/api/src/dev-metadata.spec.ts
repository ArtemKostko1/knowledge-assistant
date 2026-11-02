import ts from 'typescript';
import { readFileSync } from 'node:fs';

describe('development compilation', () => {
  it('preserves constructor injection metadata with the production compiler', () => {
    const config = JSON.parse(
      readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'),
    ) as {
      compilerOptions: {
        emitDecoratorMetadata: boolean;
        experimentalDecorators: boolean;
      };
    };
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {
      scripts: { dev: string };
    };
    const launcher = readFileSync(
      new URL('../scripts/dev.mjs', import.meta.url),
      'utf8',
    );
    expect(manifest.scripts.dev).toBe('node scripts/dev.mjs');
    expect(launcher).toContain('tsconfig.build.json');
    expect(launcher).toContain('typescript/bin/tsc');
    const emitted = ts.transpileModule(
      'class Dependency {} @Decorator() class Consumer { constructor(readonly dependency: Dependency) {} } function Decorator(): ClassDecorator { return () => {}; }',
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          ...config.compilerOptions,
        },
      },
    ).outputText;
    expect(emitted).toContain('__metadata("design:paramtypes", [Dependency])');
  });
});
