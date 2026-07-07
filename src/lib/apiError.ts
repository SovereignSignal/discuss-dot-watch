/**
 * Log the real error server-side and return only a generic, client-safe message.
 * Raw error.message can leak connection strings, table names, and upstream
 * hostnames — clients get the fallback, operators get the console.
 */
export function clientSafeError(error: unknown, fallback: string): string {
  console.error(`[API] ${fallback}:`, error);
  return fallback;
}
