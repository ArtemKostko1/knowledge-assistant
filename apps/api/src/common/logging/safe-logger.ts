import { ConsoleLogger } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { METHODS } from 'node:http';
import type { ApiErrorCode, DiagnosticErrorType } from '../http/api-error.js';
import {
  API_ERROR_CODES,
  classifyDiagnosticError,
  resolveSafeErrorPath,
} from '../http/api-error.js';

type Level = 'log' | 'warn' | 'error' | 'debug' | 'fatal';
type RequestFields = { requestId: string; method?: string; route?: string };
export type ApplicationLogEvent =
  | (RequestFields & {
      event: 'http.request.completed';
      outcome: 'finished' | 'aborted';
      statusCode?: number;
      durationMs: number;
    })
  | (RequestFields & {
      event: 'http.request.failed';
      statusCode: number;
      errorCode: ApiErrorCode;
      diagnosticType: DiagnosticErrorType;
      boundary: 'nest' | 'parser';
    });

export interface LogSink {
  write(level: Level, fields: Readonly<Record<string, unknown>>): void;
}

export function createConsoleSink(
  environment = process.env.NODE_ENV,
  debug = false,
): LogSink {
  const consoleLogger = new ConsoleLogger({
    json: environment === 'production',
    colors: false,
    compact: environment === 'production',
    structuredParams: true,
    flattenParams: true,
    logLevels: debug
      ? ['log', 'warn', 'error', 'fatal', 'debug']
      : ['log', 'warn', 'error', 'fatal'],
  });
  return {
    write(level, fields): void {
      consoleLogger[level]('API event', fields, 'API');
    },
  };
}

export class SafeLogger implements LoggerService {
  constructor(private readonly sink: LogSink = createConsoleSink()) {}

  private write(level: Level, fields: Readonly<Record<string, unknown>>): void {
    try {
      this.sink.write(level, { service: 'knowledge-assistant-api', ...fields });
    } catch {
      // A logging failure must not change the HTTP result or recursively log.
    }
  }

  application(event: ApplicationLogEvent): void {
    try {
      if (typeof event !== 'object' || event === null || Array.isArray(event))
        return;
      const name = event.event;
      if (name !== 'http.request.completed' && name !== 'http.request.failed')
        return;
      const requestId = event.requestId;
      if (
        typeof requestId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          requestId,
        )
      )
        return;
      const rawRoute = event.route;
      const route =
        typeof rawRoute === 'string'
          ? resolveSafeErrorPath({ route: { path: rawRoute } })
          : undefined;
      const method = event.method;
      const base = {
        event: name,
        requestId,
        method:
          typeof method === 'string' && METHODS.includes(method)
            ? method
            : 'UNKNOWN',
        ...(route ? { route } : {}),
      };
      if (
        event.event === 'http.request.completed' &&
        name === 'http.request.completed'
      ) {
        const outcome = event.outcome;
        const duration = event.durationMs;
        const status = event.statusCode;
        this.write('log', {
          ...base,
          outcome: outcome === 'finished' ? 'finished' : 'aborted',
          durationMs:
            typeof duration === 'number' && Number.isFinite(duration)
              ? Math.max(0, duration)
              : 0,
          ...(outcome === 'finished' &&
          typeof status === 'number' &&
          Number.isInteger(status) &&
          status >= 100 &&
          status <= 599
            ? { statusCode: status }
            : {}),
        });
      } else if (
        event.event === 'http.request.failed' &&
        name === 'http.request.failed'
      ) {
        const status = event.statusCode;
        const errorCode = event.errorCode;
        const diagnosticType = event.diagnosticType;
        const boundary = event.boundary;
        this.write('error', {
          ...base,
          statusCode:
            typeof status === 'number' &&
            Number.isInteger(status) &&
            status >= 500 &&
            status <= 599
              ? status
              : 500,
          errorCode:
            typeof errorCode === 'string' && API_ERROR_CODES.includes(errorCode)
              ? errorCode
              : 'INTERNAL_SERVER_ERROR',
          diagnosticType:
            typeof diagnosticType === 'string' &&
            [
              'TypeError',
              'ReferenceError',
              'RangeError',
              'UnknownError',
            ].includes(diagnosticType)
              ? diagnosticType
              : 'UnknownError',
          boundary: boundary === 'parser' ? 'parser' : 'nest',
        });
      }
    } catch {
      // Invalid inputs and failed record construction must never affect callers.
    }
  }

  startupFailure(code: 'INVALID_LOG_LEVEL' | 'BOOTSTRAP_FAILED'): void {
    this.write('fatal', {
      event: 'api.startup.failed',
      code:
        code === 'INVALID_LOG_LEVEL' ? 'INVALID_LOG_LEVEL' : 'BOOTSTRAP_FAILED',
      context: 'bootstrap',
    });
  }

  private system(level: Level, message: unknown): void {
    try {
      const errorMessage =
        message instanceof Error ? message.message : undefined;
      const configurationFailure =
        typeof errorMessage === 'string' &&
        /^(Missing required configuration: (DATABASE_URL|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_JWT_ISSUER|SUPABASE_JWT_AUDIENCE|SUPABASE_JWT_ALGORITHM)|Invalid configuration: (DATABASE_URL|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_JWT_ISSUER|SUPABASE_JWT_AUDIENCE|SUPABASE_JWT_ALGORITHM)|Invalid configuration: SUPABASE_ANON_KEY must be public)$/.test(
          errorMessage,
        );
      this.write(level, {
        event: 'nest.system',
        code: configurationFailure
          ? 'CONFIGURATION_FAILED'
          : level === 'error' || level === 'fatal'
            ? 'NEST_SYSTEM_ERROR'
            : 'NEST_SYSTEM_MESSAGE',
        diagnosticType: classifyDiagnosticError(message),
        context: configurationFailure ? 'AuthConfig' : 'Nest',
      });
    } catch {
      // A hostile error or proxy must not escape the logger.
    }
  }

  log(message: unknown, ..._params: unknown[]): void {
    void _params;
    this.system('log', message);
  }
  warn(message: unknown, ..._params: unknown[]): void {
    void _params;
    this.system('warn', message);
  }
  error(message: unknown, ..._params: unknown[]): void {
    void _params;
    this.system('error', message);
  }
  debug(message: unknown, ..._params: unknown[]): void {
    void _params;
    this.system('debug', message);
  }
  verbose(message: unknown, ..._params: unknown[]): void {
    void _params;
    this.system('debug', message);
  }
  fatal(message: unknown, ..._params: unknown[]): void {
    void _params;
    this.system('fatal', message);
  }
}

// The bootstrap, DI and parser boundary share this one policy instance.
export const safeLogger = new SafeLogger({
  write(level, fields): void {
    if (process.env.NODE_ENV === 'test') return;
    runtimeSink.write(level, fields);
  },
});
let runtimeSink = createConsoleSink();

export function configureLogging(environment = process.env): void {
  const level = environment.LOG_LEVEL ?? 'info';
  runtimeSink = createConsoleSink(environment.NODE_ENV, level === 'debug');
  if (level !== 'info' && level !== 'debug') {
    safeLogger.startupFailure('INVALID_LOG_LEVEL');
    throw new Error('Invalid logging configuration');
  }
}
