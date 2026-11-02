import { spawn } from 'node:child_process';

// Compile with TypeScript (not tsx/esbuild) so Nest's emitted design metadata
// matches the production build. Restart only after a successful compilation.
const compiler = spawn(
  process.execPath,
  [
    '../../node_modules/typescript/bin/tsc',
    '-p',
    'tsconfig.build.json',
    '--watch',
    '--pretty',
    'false',
  ],
  { stdio: ['inherit', 'pipe', 'inherit'] },
);
let server;
let closing = false;
let output = '';
let restarts = Promise.resolve();

async function restart() {
  if (server) {
    const previous = server;
    if (previous.exitCode === null) {
      await new Promise((resolve) => {
        previous.once('exit', resolve);
        previous.kill();
      });
    }
  }
  if (closing) return;
  server = spawn(
    process.execPath,
    ['--env-file-if-exists=../../.env', 'dist/main.js'],
    { stdio: 'inherit' },
  );
  server.on('error', () => console.error('API development process failed.'));
}

compiler.stdout.setEncoding('utf8');
compiler.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  output += chunk;
  const lines = output.split(/\r?\n/);
  output = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.includes('Found 0 errors. Watching for file changes.')) continue;
    restarts = restarts.then(restart).catch(() => {
      process.exitCode = 1;
      console.error('API development restart failed.');
    });
  }
});
compiler.on('error', (error) =>
  console.error('API development compiler failed:', error.message),
);
compiler.on('exit', (code) => {
  if (server) server.kill();
  if (!closing) process.exitCode = code || 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    closing = true;
    if (server) server.kill();
    compiler.kill();
  });
}
