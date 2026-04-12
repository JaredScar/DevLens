/**
 * Serializable app state persisted in the main process (electron-store).
 * Keep field shapes stable for migrations later.
 */
export interface WorkspaceDTO {
  id: string;
  name: string;
  color: string;
}

export interface PersistedTabDTO {
  id: string;
  workspaceId: string;
  kind: 'browser' | 'internal';
  url: string;
  title: string;
  internalRoute?: string;
  pinned?: boolean;
  groupId?: string | null;
}

export interface TabGroupDTO {
  id: string;
  workspaceId: string;
  title: string;
  color: string;
  collapsed?: boolean;
}

export interface BookmarkDTO {
  id: string;
  url: string;
  title: string;
}

export interface HistoryEntryDTO {
  id: string;
  url: string;
  title: string;
  at: number;
}

export interface NoteDTO {
  id: string;
  workspaceId: string;
  title: string;
  body: string;
  /** Optional URL associated with the note (e.g., page the note was created on). */
  url?: string;
  updatedAt: number;
}

export interface SavedSessionDTO {
  id: string;
  name: string;
  workspaceId: string;
  tabs: Array<{ url: string; title: string }>;
  savedAt: number;
}

export interface ClipboardEntryDTO {
  id: string;
  text: string;
  kind: 'url' | 'text';
  savedAt: number;
}

export interface AutomationRuleDTO {
  id: string;
  enabled: boolean;
  name: string;
  triggerType: 'url_contains' | 'workspace_active' | 'time_window';
  /** For `time_window`: local `HH:mm-HH:mm` (24h). Overnight supported (e.g. `22:00-06:00`). */
  triggerValue: string;
  actionType: 'open_widget' | 'switch_workspace' | 'run_javascript' | 'block_hostname';
  /** Hostname, workspace id, widget id, JS snippet, or URL (hostname extracted for block). */
  actionValue: string;
}

/** Saved form hints for “smart autofill” (injected into focused fields on the active page). */
export interface AutofillHintDTO {
  id: string;
  label: string;
  value: string;
}

/** Exported / imported theme file (Settings → Appearance). */
export interface DevLensThemeFileV1 {
  version: 1;
  themePreset?: 'dark' | 'light' | 'midnight' | 'solarized' | 'high-contrast';
  variables?: Record<string, string>;
  customThemeVariables?: Record<string, string>;
}

/** Exported / imported keyboard shortcut profile (Settings → Shortcuts). */
export interface DevLensShortcutProfileFileV1 {
  version: 1;
  bindings: Record<string, string>;
}

/** Local read-later queue (Phase 3.3); sync-ready shape. */
export interface ReadLaterEntryDTO {
  id: string;
  url: string;
  title: string;
  addedAt: number;
}

/** Paired device for cross-device sync (Phase 3.3). */
export interface PairedDeviceDTO {
  id: string;
  name: string;
  pairedAt: number;
  lastSeenAt: number;
  /** Fingerprint/public key for local encryption (optional). */
  publicKey?: string;
}

/** Page annotation for collaboration (Phase 3.4). */
export interface AnnotationDTO {
  id: string;
  url: string;
  /** CSS selector for the annotated element. */
  selector: string;
  /** Selected text context. */
  text: string;
  /** User's note/comment. */
  note: string;
  /** Optional absolute position coordinates. */
  x?: number;
  y?: number;
  createdAt: number;
  updatedAt: number;
  /** Share with team/paired devices. */
  shared: boolean;
  /** Author (for team scenarios). */
  authorName?: string;
}

/** Shared bookmark collection (Phase 3.4). */
export interface SharedBookmarkCollectionDTO {
  id: string;
  name: string;
  createdAt: number;
  bookmarks: BookmarkDTO[];
  /** Share token for importing by others. */
  shareToken: string;
}

/** Shared workspace export (Phase 3.4). */
export interface SharedWorkspaceDTO {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  /** Share token for importing by others. */
  shareToken: string;
  /** Included tabs (serialized). */
  tabs: Array<{ url: string; title: string; pinned?: boolean }>;
  groups: TabGroupDTO[];
}

/** Per-widget visibility (Settings → Features). All default true. */
export interface DevLensFeatureWidgetFlags {
  notes: boolean;
  ai: boolean;
  console: boolean;
  clipboard: boolean;
  sessions: boolean;
  api: boolean;
  history: boolean;
  /** Matches widget id `readlater`. */
  readlater: boolean;
  perf: boolean;
  json: boolean;
  bookmarks: boolean;
  /** Phase 3.3: Device pairing widget. */
  pairing: boolean;
  /** Phase 3.4: Shared bookmarks widget. */
  sharedBookmarks: boolean;
  /** Phase 3.4: Shared workspaces widget. */
  sharedWorkspaces: boolean;
}

/** Optional/productivity features toggles; core browsing stays available. */
export interface DevLensFeatureFlags {
  spotlight: boolean;
  splitView: boolean;
  focusMode: boolean;
  devtools: boolean;
  aiSummarize: boolean;
  autofillMenu: boolean;
  bookmarksButton: boolean;
  chromeExtensionStrip: boolean;
  historyRecording: boolean;
  automation: boolean;
  rightSidebar: boolean;
  widgets: DevLensFeatureWidgetFlags;
}

export function defaultFeatureFlags(): DevLensFeatureFlags {
  return {
    spotlight: true,
    splitView: true,
    focusMode: true,
    devtools: true,
    aiSummarize: true,
    autofillMenu: true,
    bookmarksButton: true,
    chromeExtensionStrip: true,
    historyRecording: true,
    automation: true,
    rightSidebar: true,
    widgets: {
      notes: true,
      ai: true,
      console: true,
      clipboard: true,
      sessions: true,
      api: true,
      history: true,
      readlater: true,
      perf: true,
      json: true,
      bookmarks: true,
      pairing: true,
      sharedBookmarks: true,
      sharedWorkspaces: true,
    },
  };
}

/** Deep-friendly partial for feature flag updates (widgets nested). */
export type DevLensFeatureFlagsPatch = Omit<Partial<DevLensFeatureFlags>, 'widgets'> & {
  widgets?: Partial<DevLensFeatureWidgetFlags>;
};

/** Merge persisted flags with defaults so new keys default to on after upgrades. */
export function mergeFeatureFlags(
  base: DevLensFeatureFlags,
  partial?: DevLensFeatureFlagsPatch,
): DevLensFeatureFlags {
  return {
    ...base,
    ...partial,
    widgets: {
      ...base.widgets,
      ...partial?.widgets,
    },
  };
}

export interface DevLensStoreSnapshot {
  settings: {
    searchEngine: 'google' | 'ddg';
    blockerEnabled: boolean;
    fontSize: 12 | 14 | 16;
    language: string;
    startupBehavior: 'restore' | 'new-tab';
    /** Hostnames allowed through the blocker (e.g. `analytics.google.com`). */
    trackerAllowlistHosts: string[];
    /** When true, main process refreshes the remote block list on a timer. */
    blockListAutoUpdate: boolean;
    /** Optional override URL for hosts-format block list fetch. */
    blockListSourceUrl?: string;
    /** Suspend idle browser tabs after N minutes (0 = off). */
    tabSuspendAfterMinutes: number;
    /** Right sidebar width in pixels (clamped in UI). */
    rightSidebarWidthPx: number;
    /** When true, do not record clipboard history (renderer poll + system hook inserts). */
    clipboardMonitoringPaused: boolean;
    /** When true, main process polls the OS clipboard and forwards text to the renderer. */
    systemClipboardWatch: boolean;
    /** On window close, save current browser tabs as a named session before exit. */
    autoSaveSessionOnClose: boolean;
    /** AI sidebar: mock canned replies or OpenAI-compatible API. */
    aiProvider: 'mock' | 'openai';
    /** API key for OpenAI-compatible providers (stored locally). */
    aiApiKey: string;
    /** Chat model id (e.g. gpt-4o-mini). */
    aiModel: string;
    /** Optional API base URL (default https://api.openai.com/v1). */
    aiBaseUrl: string;
    /** UI color preset applied via `data-theme` on the document root. */
    themePreset: 'dark' | 'light' | 'midnight' | 'solarized' | 'high-contrast';
    /**
     * Optional keyboard shortcut overrides. Keys are action ids (e.g. `spotlight`, `newTab`);
     * values are combos like `ctrl+k` or `meta+shift+i` (lowercase key names).
     */
    shortcutBindings: Record<string, string>;
    /** In focus mode, keep chrome visible on these hostnames (one per line / entry). */
    focusModeAllowlistHosts: string[];
    /** Focus timer minutes (0 = off). Shows a notification when elapsed. */
    focusPomodoroMinutes: number;
    /**
     * Optional CSS variable overrides applied after the selected `themePreset`
     * (e.g. `{ \"--dl-accent\": \"#ff00aa\" }`).
     */
    customThemeVariables: Record<string, string>;
    /**
     * User-defined hostnames to block (merged with curated + remote lists when blocker is on).
     * Editable under Settings → Privacy; automation can append via `block_hostname`.
     */
    userBlockedHosts: string[];
    /** Short labels + values for quick fill on the active page (top bar menu). */
    autofillHints: AutofillHintDTO[];
    /** When true, allow anonymous usage heartbeats (console / optional endpoint; off by default). */
    telemetryOptIn: boolean;
    /** Prefer HTTPS: normalize typed http:// navigations to https:// when possible. */
    httpsOnlyMode: boolean;
    /** ISO timestamp of last successful encrypted backup export (optional, UI hint). */
    lastEncryptedBackupAt?: string;
    /**
     * Encrypted backup import: replace whole sections vs merge lists by id / URL (last-write-wins where timestamps exist).
     */
    encryptedImportMode: 'replace' | 'merge_lww';
    /** Mirror document direction for RTL languages (experimental). */
    uiRtl: boolean;
    /** Toggle optional UI and behavior (defaults all true). */
    featureFlags: DevLensFeatureFlags;
  };
  workspaces: WorkspaceDTO[];
  activeWorkspaceId: string;
  tabGroups: TabGroupDTO[];
  openTabs: PersistedTabDTO[];
  bookmarks: BookmarkDTO[];
  history: HistoryEntryDTO[];
  notes: NoteDTO[];
  savedSessions: SavedSessionDTO[];
  clipboardHistory: ClipboardEntryDTO[];
  automationRules: AutomationRuleDTO[];
  /** Per-plugin enable flag (id → enabled). */
  pluginStates: Record<string, { enabled: boolean }>;
  /** Sandboxed plugin storage namespace (plugin id → JSON-serializable bag). */
  pluginStorage: Record<string, Record<string, unknown>>;
  readLater: ReadLaterEntryDTO[];
  /** Paired devices for cross-device sync (Phase 3.3). */
  pairedDevices: PairedDeviceDTO[];
  /** Page annotations for collaboration (Phase 3.4). */
  annotations: AnnotationDTO[];
  /** Shared bookmark collections (Phase 3.4). */
  sharedBookmarkCollections: SharedBookmarkCollectionDTO[];
  /** Shared workspaces (Phase 3.4). */
  sharedWorkspaces: SharedWorkspaceDTO[];
}

export interface TabUpdatedPayload {
  tabId: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function defaultStoreSnapshot(): DevLensStoreSnapshot {
  const wsId = 'ws-default';
  return {
    settings: {
      searchEngine: 'ddg',
      blockerEnabled: true,
      fontSize: 14,
      language: 'en',
      startupBehavior: 'restore',
      trackerAllowlistHosts: [],
      blockListAutoUpdate: true,
      tabSuspendAfterMinutes: 0,
      rightSidebarWidthPx: 260,
      clipboardMonitoringPaused: false,
      systemClipboardWatch: false,
      autoSaveSessionOnClose: false,
      aiProvider: 'mock',
      aiApiKey: '',
      aiModel: 'gpt-4o-mini',
      aiBaseUrl: '',
      themePreset: 'dark',
      shortcutBindings: {},
      focusModeAllowlistHosts: [],
      focusPomodoroMinutes: 0,
      customThemeVariables: {},
      userBlockedHosts: [],
      autofillHints: [],
      telemetryOptIn: false,
      httpsOnlyMode: false,
      encryptedImportMode: 'replace',
      uiRtl: false,
      featureFlags: defaultFeatureFlags(),
    },
    workspaces: [{ id: wsId, name: 'Personal', color: '#58a6ff' }],
    activeWorkspaceId: wsId,
    tabGroups: [],
    openTabs: [],
    bookmarks: [],
    history: [],
    notes: [],
    savedSessions: [],
    clipboardHistory: [],
    automationRules: [],
    pluginStates: {},
    pluginStorage: {},
    readLater: [],
    pairedDevices: [],
    annotations: [],
    sharedBookmarkCollections: [],
    sharedWorkspaces: [],
  };
}
