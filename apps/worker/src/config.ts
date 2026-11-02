export function requireDatabaseUrl(value: string | undefined): string {
  if (!value) throw new Error('DATABASE_URL must be set for the worker');
  return value;
}
