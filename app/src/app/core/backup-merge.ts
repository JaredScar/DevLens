import type {
  AutomationRuleDTO,
  BookmarkDTO,
  ClipboardEntryDTO,
  NoteDTO,
  ReadLaterEntryDTO,
  SavedSessionDTO,
  WorkspaceDTO,
} from '@dev-lens/shared';

export function mergeWorkspacesLww(local: WorkspaceDTO[], remote: WorkspaceDTO[]): WorkspaceDTO[] {
  const byId = new Map(local.map((w) => [w.id, w] as const));
  for (const w of remote) byId.set(w.id, w);
  return [...byId.values()];
}

/** Imported bookmark wins on URL collision. */
export function mergeBookmarksLww(local: BookmarkDTO[], remote: BookmarkDTO[]): BookmarkDTO[] {
  const byUrl = new Map<string, BookmarkDTO>();
  for (const b of local) byUrl.set(b.url, b);
  for (const b of remote) byUrl.set(b.url, b);
  return [...byUrl.values()];
}

export function mergeNotesLww(local: NoteDTO[], remote: NoteDTO[]): NoteDTO[] {
  const byId = new Map(local.map((n) => [n.id, n] as const));
  for (const n of remote) {
    const ex = byId.get(n.id);
    if (!ex || n.updatedAt >= ex.updatedAt) byId.set(n.id, n);
  }
  return [...byId.values()];
}

export function mergeReadLaterLww(
  local: ReadLaterEntryDTO[],
  remote: ReadLaterEntryDTO[],
): ReadLaterEntryDTO[] {
  const byUrl = new Map<string, ReadLaterEntryDTO>();
  for (const e of local) byUrl.set(e.url, e);
  for (const e of remote) {
    const ex = byUrl.get(e.url);
    if (!ex || e.addedAt >= ex.addedAt) byUrl.set(e.url, e);
  }
  return [...byUrl.values()].sort((a, b) => b.addedAt - a.addedAt);
}

export function mergeSavedSessionsLww(
  local: SavedSessionDTO[],
  remote: SavedSessionDTO[],
): SavedSessionDTO[] {
  const byId = new Map(local.map((s) => [s.id, s] as const));
  for (const s of remote) {
    const ex = byId.get(s.id);
    if (!ex || s.savedAt >= ex.savedAt) byId.set(s.id, s);
  }
  return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
}

export function mergeAutomationRulesLww(
  local: AutomationRuleDTO[],
  remote: AutomationRuleDTO[],
): AutomationRuleDTO[] {
  const byId = new Map(local.map((r) => [r.id, r] as const));
  for (const r of remote) byId.set(r.id, r);
  return [...byId.values()];
}

export function mergeClipboardLww(
  local: ClipboardEntryDTO[],
  remote: ClipboardEntryDTO[],
): ClipboardEntryDTO[] {
  const byId = new Map(local.map((c) => [c.id, c] as const));
  for (const c of remote) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
}

export function mergePluginStatesLww(
  local: Record<string, { enabled: boolean }>,
  remote: Record<string, { enabled: boolean }>,
): Record<string, { enabled: boolean }> {
  return { ...local, ...remote };
}

export function mergePluginStorageLww(
  local: Record<string, Record<string, unknown>>,
  remote: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { ...local };
  for (const [pid, bag] of Object.entries(remote)) {
    out[pid] = { ...(out[pid] ?? {}), ...bag };
  }
  return out;
}
