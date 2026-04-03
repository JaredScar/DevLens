import { z } from 'zod';

/** Reject unknown top-level keys on store patches (typos / malicious extra fields). */
const BookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
});

const HistoryEntrySchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  at: z.number(),
});

const NoteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.string().optional(),
  updatedAt: z.number(),
});

const SavedSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  workspaceId: z.string(),
  tabs: z.array(z.object({ url: z.string(), title: z.string() })),
  savedAt: z.number(),
});

const ClipboardEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['url', 'text']),
  savedAt: z.number(),
});

const AutomationRuleSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string(),
  triggerType: z.enum(['url_contains', 'workspace_active', 'time_window']),
  triggerValue: z.string(),
  actionType: z.enum(['open_widget', 'switch_workspace', 'run_javascript', 'block_hostname']),
  actionValue: z.string(),
});

const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

const TabGroupSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  color: z.string(),
  collapsed: z.boolean().optional(),
});

const PersistedTabSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  kind: z.enum(['browser', 'internal']),
  url: z.string(),
  title: z.string(),
  internalRoute: z.string().optional(),
  pinned: z.boolean().optional(),
  groupId: z.string().nullable().optional(),
});

const ReadLaterSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  addedAt: z.number(),
});

export const StorePatchSchema = z
  .object({
    settings: z.record(z.string(), z.unknown()).optional(),
    workspaces: z.array(WorkspaceSchema).optional(),
    activeWorkspaceId: z.string().optional(),
    tabGroups: z.array(TabGroupSchema).optional(),
    openTabs: z.array(PersistedTabSchema).optional(),
    bookmarks: z.array(BookmarkSchema).optional(),
    history: z.array(HistoryEntrySchema).optional(),
    notes: z.array(NoteSchema).optional(),
    savedSessions: z.array(SavedSessionSchema).optional(),
    clipboardHistory: z.array(ClipboardEntrySchema).optional(),
    automationRules: z.array(AutomationRuleSchema).optional(),
    pluginStates: z.record(z.string(), z.object({ enabled: z.boolean() })).optional(),
    pluginStorage: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    readLater: z.array(ReadLaterSchema).optional(),
  })
  .strict();

export const TabsReportActiveSchema = z.object({
  url: z.string().max(32_768),
  title: z.string().max(8_192),
});

export const HistoryAppendSchema = z.object({
  url: z.string().min(1).max(32_768),
  title: z.string().max(8_192),
});

export const SessionInitSchema = z.object({
  partition: z
    .string()
    .min(1)
    .max(512)
    .refine(
      (p) => p.startsWith('persist:dev-lens-ws-'),
      'partition must be a dev-lens workspace session',
    ),
});

export const BlockerSetEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const ShellOpenExternalSchema = z.object({
  url: z.string().min(1).max(32_768),
});

export const PluginSetEnabledSchema = z.object({
  id: z.string().min(1).max(128),
  enabled: z.boolean(),
});

export function ipcParse<T>(schema: z.ZodType<T>, label: string, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    console.warn(`[ipc] ${label} validation failed:`, msg);
    throw new Error(`Invalid ${label}`);
  }
  return r.data;
}
