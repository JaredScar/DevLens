import type { UserStore } from './user-data-store';

/**
 * Opt-in diagnostic heartbeat (console only). No network unless extended later.
 */
export function startTelemetryHeartbeat(getStore: () => UserStore): void {
  setInterval(
    () => {
      try {
        if (!getStore().get('settings').telemetryOptIn) return;
        console.info('[dev-lens:telemetry]', { t: Date.now(), kind: 'heartbeat' });
      } catch {
        /* ignore */
      }
    },
    10 * 60 * 1000,
  );
}
