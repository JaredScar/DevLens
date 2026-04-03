/**
 * Browser-agnostic snapshot for cross-device / companion apps (Phase 3.3).
 * Export only non-secret data; encrypt separately if needed.
 */

export const COMPANION_SNAPSHOT_VERSION = 1;

export interface CompanionSnapshotV1 {
  companion: 1;
  exportedAt: number;
  app: 'dev-lens';
  bookmarks: Array<{ url: string; title: string }>;
  readLater: Array<{ url: string; title: string; addedAt: number }>;
  sessions: Array<{ name: string; savedAt: number; tabs: Array<{ url: string; title: string }> }>;
}

export function validateCompanionSnapshot(raw: unknown): raw is CompanionSnapshotV1 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    o['companion'] === COMPANION_SNAPSHOT_VERSION &&
    o['app'] === 'dev-lens' &&
    typeof o['exportedAt'] === 'number'
  );
}
