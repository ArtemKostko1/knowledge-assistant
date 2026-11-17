
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

const child = spawn(
  isWindows ? 'pnpm.cmd' : 'pnpm',
  [
    'exec',
    'turbo',
    'run',
    'dev',
    '--filter=@knowledge-assistant/web',
    '--filter=@knowledge-assistant/api',
  ],
  {
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  },
);

child.on('error', (error) => {
  console.error('Failed to start development:', error.message);
  process.exitCode = 1;
});

child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
