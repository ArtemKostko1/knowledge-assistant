import { PgBoss } from 'pg-boss';
import { requireDatabaseUrl } from './config.js';

type Queue = {
  on(event: 'error', listener: (error: Error) => void): unknown;
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
};
type Runtime = {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  exitCode?: string | number | null;
};
type Logger = Pick<Console, 'log' | 'error'>;

export async function startWorker(
  boss: Queue,
  runtime: Runtime = process,
  logger: Logger = console,
): Promise<void> {
  let stopping: Promise<void> | undefined;
  const stop = (failure: boolean): Promise<void> => {
    if (failure) runtime.exitCode = 1;
    stopping ??= boss.stop().then(
      () => undefined,
      () => {
        runtime.exitCode = 1;
        logger.error('Worker queue shutdown failed.');
      },
    );
    return stopping;
  };

  // pg-boss emits pool/background errors. Treat these as fatal and drain once;
  // never log Error objects because connection details may contain credentials.
  boss.on('error', () => {
    logger.error('Worker queue background failure; stopping.');
    void stop(true);
  });
  runtime.on('SIGINT', () => void stop(false));
  runtime.on('SIGTERM', () => void stop(false));

  try {
    await boss.start();
    if (!stopping) {
      logger.log(
        'Worker connected to PostgreSQL; no product jobs registered yet.',
      );
    }
  } catch {
    runtime.exitCode = 1;
    logger.error(
      'Worker queue startup failed. Check local database availability and permissions.',
    );
    await stop(true);
  }
}

if (process.env.NODE_ENV !== 'test') {
  try {
    const boss = new PgBoss(requireDatabaseUrl(process.env.DATABASE_URL));
    void startWorker(boss);
  } catch {
    process.exitCode = 1;
    console.error('Worker configuration failed: DATABASE_URL is required.');
  }
}
