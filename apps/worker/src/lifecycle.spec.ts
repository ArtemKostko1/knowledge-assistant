import { EventEmitter } from 'node:events';
import { startWorker } from './main.js';

class FakeQueue extends EventEmitter {
  starts = 0;
  stops = 0;
  startFailure?: Error;
  stopFailure?: Error;

  async start(): Promise<void> {
    this.starts++;
    if (this.startFailure) throw this.startFailure;
  }

  async stop(): Promise<void> {
    this.stops++;
    if (this.stopFailure) throw this.stopFailure;
  }
}

function setup() {
  const boss = new FakeQueue();
  const runtime = new EventEmitter() as EventEmitter & { exitCode?: number };
  const logs: string[] = [];
  const errors: string[] = [];
  const logger = {
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
  };
  return { boss, runtime, logger, logs, errors };
}

describe('worker queue lifecycle', () => {
  it('starts, listens before startup, and stops on a signal', async () => {
    const { boss, runtime, logger, logs } = setup();
    await startWorker(boss, runtime, logger);
    expect(boss.listenerCount('error')).toBe(1);
    expect(logs).toHaveLength(1);
    runtime.emit('SIGTERM');
    await Promise.resolve();
    expect(boss.stops).toBe(1);
    expect(runtime.exitCode).toBeUndefined();
  });

  it('cleans up a startup rejection without disclosing its contents', async () => {
    const { boss, runtime, logger, errors } = setup();
    boss.startFailure = new Error('postgresql://user:secret@host/db');
    await startWorker(boss, runtime, logger);
    expect(boss.stops).toBe(1);
    expect(runtime.exitCode).toBe(1);
    expect(errors.join(' ')).not.toContain('secret');
  });

  it('treats background errors as fatal and drains only once', async () => {
    const { boss, runtime, logger, errors } = setup();
    await startWorker(boss, runtime, logger);
    expect(() =>
      boss.emit('error', new Error('password=secret')),
    ).not.toThrow();
    runtime.emit('SIGINT');
    await Promise.resolve();
    expect(boss.stops).toBe(1);
    expect(runtime.exitCode).toBe(1);
    expect(errors.join(' ')).not.toContain('secret');
  });

  it('reports stop failures without an unhandled rejection', async () => {
    const { boss, runtime, logger, errors } = setup();
    boss.stopFailure = new Error('password=secret');
    await startWorker(boss, runtime, logger);
    runtime.emit('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));
    expect(runtime.exitCode).toBe(1);
    expect(errors).toContain('Worker queue shutdown failed.');
    expect(errors.join(' ')).not.toContain('secret');
  });
});
