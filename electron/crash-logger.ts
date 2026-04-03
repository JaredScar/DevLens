import fs from 'node:fs';
import path from 'node:path';

/**
 * Append uncaught main-process errors to userData/crash-log.txt (local diagnostics).
 * Optional Sentry (or similar) can be wired here later via env.
 */
export function initCrashLogger(userDataPath: string): void {
  const logPath = path.join(userDataPath, 'crash-log.txt');

  const write = (kind: string, err: unknown): void => {
    const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    const line = `${new Date().toISOString()} [${kind}] ${detail}\n`;
    try {
      fs.appendFileSync(logPath, line, 'utf8');
    } catch {
      /* ignore disk errors */
    }
    console.error(`[crash-logger] ${kind}`, err);
  };

  process.on('uncaughtException', (e) => {
    write('uncaughtException', e);
  });

  process.on('unhandledRejection', (reason) => {
    write('unhandledRejection', reason);
  });
}
