import { Component, computed, effect, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { WorkspaceService } from '@core/services/workspace.service';
import { ToastService } from '@core/services/toast.service';
import { FormsModule } from '@angular/forms';
import {
  COMPANION_SNAPSHOT_VERSION,
  IPC_CHANNELS,
  type AutofillHintDTO,
  type AutomationRuleDTO,
  type CompanionSnapshotV1,
  type DevLensShortcutProfileFileV1,
  type DevLensStoreSnapshot,
  type DevLensThemeFileV1,
} from '@dev-lens/shared';
import { BackupCryptoService } from '@core/services/backup-crypto.service';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { PluginRuntimeService } from '@core/services/plugin-runtime.service';
import {
  SHORTCUT_DEFAULTS,
  buildMergedShortcutBindings,
  describeShortcutConflicts,
} from '@core/services/shortcut-registry.service';
import { THEME_CSS_VARIABLE_KEYS } from '@core/theme-tokens';
import {
  mergeAutomationRulesLww,
  mergeBookmarksLww,
  mergeClipboardLww,
  mergeNotesLww,
  mergePluginStatesLww,
  mergePluginStorageLww,
  mergeReadLaterLww,
  mergeSavedSessionsLww,
  mergeWorkspacesLww,
} from '@core/backup-merge';

/** Decrypted encrypted-backup payload (v1). */
interface BackupImportPayload {
  bookmarks?: DevLensStoreSnapshot['bookmarks'];
  notes?: DevLensStoreSnapshot['notes'];
  readLater?: DevLensStoreSnapshot['readLater'];
  workspaces?: DevLensStoreSnapshot['workspaces'];
  activeWorkspaceId?: DevLensStoreSnapshot['activeWorkspaceId'];
  settings?: DevLensStoreSnapshot['settings'];
  savedSessions?: DevLensStoreSnapshot['savedSessions'];
  automationRules?: DevLensStoreSnapshot['automationRules'];
  tabGroups?: DevLensStoreSnapshot['tabGroups'];
  openTabs?: DevLensStoreSnapshot['openTabs'];
  clipboardHistory?: DevLensStoreSnapshot['clipboardHistory'];
  history?: DevLensStoreSnapshot['history'];
  pluginStates?: DevLensStoreSnapshot['pluginStates'];
  pluginStorage?: DevLensStoreSnapshot['pluginStorage'];
}

type Section =
  | 'general'
  | 'privacy'
  | 'appearance'
  | 'automation'
  | 'shortcuts'
  | 'ai'
  | 'plugins'
  | 'sync'
  | 'advanced';

type SettingsShape = DevLensStoreSnapshot['settings'];

@Component({
  selector: 'app-settings',
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly persisted = inject(PersistedStateService);
  readonly bridge = inject(ElectronBridgeService);
  readonly pluginRuntime = inject(PluginRuntimeService);
  readonly backupCrypto = inject(BackupCryptoService);
  private readonly toast = inject(ToastService);
  private readonly workspaceSvc = inject(WorkspaceService);

  readonly workspaces = computed(() => this.workspaceSvc.workspaces());

  readonly section = signal<Section>('general');
  readonly blockListStatus = signal<string>('');
  readonly shortcutConflicts = signal<string[]>([]);
  readonly themeRegistryEntries = signal<{ id: string; name: string; sourceUrl?: string }[]>([]);

  readonly backupExportOpen = signal(false);
  readonly backupExportPass = signal('');
  readonly backupExportPass2 = signal('');

  readonly backupImportOpen = signal(false);
  readonly backupImportJson = signal<string | null>(null);
  readonly backupImportPass = signal('');
  readonly backupImportStep = signal<'pass' | 'confirm'>('pass');
  readonly backupImportDecoded = signal<BackupImportPayload | null>(null);

  readonly resetDataConfirmOpen = signal(false);
  readonly shortcutsResetConfirmOpen = signal(false);

  readonly apiKeyVisible = signal(false);

  readonly nav: { id: Section; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: 'fa-gear' },
    { id: 'privacy', label: 'Privacy', icon: 'fa-shield-halved' },
    { id: 'appearance', label: 'Appearance', icon: 'fa-palette' },
    { id: 'automation', label: 'Automation', icon: 'fa-bolt' },
    { id: 'ai', label: 'AI', icon: 'fa-robot' },
    { id: 'shortcuts', label: 'Shortcuts', icon: 'fa-keyboard' },
    { id: 'plugins', label: 'Plugins', icon: 'fa-puzzle-piece' },
    { id: 'sync', label: 'Sync & backup', icon: 'fa-cloud-arrow-up' },
    { id: 'advanced', label: 'Advanced', icon: 'fa-wrench' },
  ];

  readonly shortcutRows: { id: string; label: string }[] = [
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'newTab', label: 'New tab' },
    { id: 'closeTab', label: 'Close tab' },
    { id: 'cycleTabNext', label: 'Next tab' },
    { id: 'cycleTabPrev', label: 'Previous tab' },
    { id: 'toggleSplit', label: 'Toggle split view' },
    { id: 'focusMode', label: 'Focus mode' },
    { id: 'toggleDevtools', label: 'Toggle DevTools' },
    { id: 'inspectElement', label: 'Inspect element (at pointer)' },
  ];

  constructor() {
    effect(() => {
      const snap = this.persisted.snapshot();
      if (!snap) {
        this.shortcutConflicts.set([]);
        return;
      }
      const merged = buildMergedShortcutBindings(snap.settings.shortcutBindings ?? {});
      this.shortcutConflicts.set(describeShortcutConflicts(merged));
    });
    effect(() => {
      if (this.section() === 'plugins' && this.bridge.isElectron) {
        void this.pluginRuntime.refresh();
      }
    });
    effect(() => {
      if (this.section() !== 'appearance') return;
      void fetch('/theme-registry.json')
        .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
        .then((data: { themes?: { id: string; name: string; sourceUrl?: string }[] } | null) => {
          const arr = data?.themes && Array.isArray(data.themes) ? data.themes : [];
          this.themeRegistryEntries.set(arr);
        })
        .catch(() => this.themeRegistryEntries.set([]));
    });
  }

  async patchSettings(p: Partial<SettingsShape>): Promise<void> {
    const cur = this.persisted.snapshot()?.settings;
    if (!cur) return;
    await this.persisted.patch({ settings: { ...cur, ...p } });
  }

  allowlistLines(snap: DevLensStoreSnapshot): string {
    return (snap.settings.trackerAllowlistHosts ?? []).join('\n');
  }

  async setAllowlistText(text: string): Promise<void> {
    const hosts = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await this.patchSettings({ trackerAllowlistHosts: hosts });
  }

  focusAllowlistLines(snap: DevLensStoreSnapshot): string {
    return (snap.settings.focusModeAllowlistHosts ?? []).join('\n');
  }

  async setFocusAllowlistText(text: string): Promise<void> {
    const hosts = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await this.patchSettings({ focusModeAllowlistHosts: hosts });
  }

  userBlockedLines(snap: DevLensStoreSnapshot): string {
    return (snap.settings.userBlockedHosts ?? []).join('\n');
  }

  async setUserBlockedText(text: string): Promise<void> {
    const hosts = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await this.patchSettings({ userBlockedHosts: hosts });
  }

  async refreshRemoteBlockList(): Promise<void> {
    if (!this.bridge.isElectron) return;
    this.blockListStatus.set('Updating…');
    const r = await this.bridge.invoke<{ ok: boolean; count?: number; error?: string }>(
      IPC_CHANNELS.BLOCKER_REFRESH_LIST,
    );
    if (r.ok) this.blockListStatus.set(`Loaded ${r.count ?? 0} host rules.`);
    else this.blockListStatus.set(r.error ?? 'Update failed.');
  }

  async setStartup(b: 'restore' | 'new-tab'): Promise<void> {
    const cur = this.persisted.snapshot()?.settings;
    if (!cur) return;
    await this.persisted.patch({ settings: { ...cur, startupBehavior: b } });
  }

  async setLanguage(lang: string): Promise<void> {
    const cur = this.persisted.snapshot()?.settings;
    if (!cur) return;
    await this.persisted.patch({ settings: { ...cur, language: lang } });
  }

  requestResetData(): void {
    this.resetDataConfirmOpen.set(true);
  }

  cancelResetData(): void {
    this.resetDataConfirmOpen.set(false);
  }

  async confirmResetData(): Promise<void> {
    this.resetDataConfirmOpen.set(false);
    await this.persisted.patch({
      openTabs: [],
      bookmarks: [],
      history: [],
      notes: [],
      tabGroups: [],
    });
    window.location.reload();
  }

  shortcutDisplayValue(snap: DevLensStoreSnapshot, actionId: string): string {
    return snap.settings.shortcutBindings[actionId] ?? SHORTCUT_DEFAULTS[actionId] ?? '';
  }

  async updateShortcutBinding(actionId: string, raw: string): Promise<void> {
    const cur = this.persisted.snapshot()?.settings;
    if (!cur) return;
    const v = raw.trim().toLowerCase();
    const next = { ...cur.shortcutBindings };
    const def = SHORTCUT_DEFAULTS[actionId];
    if (!v || (def && v === def)) {
      delete next[actionId];
    } else {
      next[actionId] = v;
    }
    const trial = buildMergedShortcutBindings(next);
    if (describeShortcutConflicts(trial).length > 0) {
      this.toast.error(
        'That combo is already used by another action. Choose a different shortcut.',
      );
      return;
    }
    await this.patchSettings({ shortcutBindings: next });
  }

  requestResetAllShortcuts(): void {
    this.shortcutsResetConfirmOpen.set(true);
  }

  cancelShortcutsReset(): void {
    this.shortcutsResetConfirmOpen.set(false);
  }

  async confirmResetAllShortcuts(): Promise<void> {
    this.shortcutsResetConfirmOpen.set(false);
    await this.patchSettings({ shortcutBindings: {} });
    this.toast.show('Shortcuts reset to defaults.');
  }

  exportShortcutProfile(): void {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const payload: DevLensShortcutProfileFileV1 = {
      version: 1,
      bindings: { ...snap.settings.shortcutBindings },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dev-lens-shortcuts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  onImportShortcutProfilePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const o = JSON.parse(reader.result as string) as DevLensShortcutProfileFileV1;
          if (o.version !== 1 || !o.bindings || typeof o.bindings !== 'object') {
            this.toast.error('Invalid shortcut profile file.');
            return;
          }
          const cur = this.persisted.snapshot()?.settings;
          if (!cur) return;
          const merged = buildMergedShortcutBindings(o.bindings);
          if (describeShortcutConflicts(merged).length > 0) {
            this.toast.error('This profile contains conflicting shortcuts. Import aborted.');
            return;
          }
          await this.patchSettings({ shortcutBindings: { ...o.bindings } });
          this.toast.show('Shortcut profile imported.');
        } catch {
          this.toast.error('Could not read shortcut profile JSON.');
        }
      })();
    };
    reader.readAsText(file);
  }

  exportThemeFile(): void {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const el = document.documentElement;
    const variables: Record<string, string> = {};
    for (const k of THEME_CSS_VARIABLE_KEYS) {
      variables[k] = getComputedStyle(el).getPropertyValue(k).trim();
    }
    const payload: DevLensThemeFileV1 = {
      version: 1,
      themePreset: snap.settings.themePreset,
      variables,
      customThemeVariables: snap.settings.customThemeVariables ?? {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dev-lens-theme-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  onImportThemePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const o = JSON.parse(reader.result as string) as DevLensThemeFileV1 & {
            version?: number;
          };
          if (o.version !== undefined && o.version !== 1) {
            this.toast.error('Unsupported theme file version.');
            return;
          }
          const varsA = o.variables && typeof o.variables === 'object' ? o.variables : {};
          const varsB =
            o.customThemeVariables && typeof o.customThemeVariables === 'object'
              ? o.customThemeVariables
              : {};
          const customThemeVariables: Record<string, string> = { ...varsA, ...varsB };
          const preset = o.themePreset;
          const allowed = new Set(['dark', 'light', 'midnight', 'solarized', 'high-contrast']);
          await this.patchSettings({
            ...(preset && allowed.has(preset)
              ? { themePreset: preset as SettingsShape['themePreset'] }
              : {}),
            customThemeVariables,
          });
          this.toast.show('Theme imported.');
        } catch {
          this.toast.error('Could not read theme JSON.');
        }
      })();
    };
    reader.readAsText(file);
  }

  async addAutomationRule(): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const r: AutomationRuleDTO = {
      id: crypto.randomUUID(),
      enabled: true,
      name: 'New rule',
      triggerType: 'url_contains',
      triggerValue: '',
      actionType: 'open_widget',
      actionValue: 'ai',
    };
    await this.persisted.patch({ automationRules: [...snap.automationRules, r] });
  }

  async patchAutomationRules(rules: AutomationRuleDTO[]): Promise<void> {
    await this.persisted.patch({ automationRules: rules });
  }

  async updateRule(id: string, patch: Partial<AutomationRuleDTO>): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const next = snap.automationRules.map((r) => (r.id === id ? { ...r, ...patch } : r));
    await this.patchAutomationRules(next);
  }

  async removeRule(id: string): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    await this.patchAutomationRules(snap.automationRules.filter((r) => r.id !== id));
  }

  /** Curated marketplace rules — maintained by the Dev-Lens team. */
  readonly marketplaceRules: (Omit<AutomationRuleDTO, 'id'> & { description: string })[] = [
    {
      enabled: true,
      name: 'Work hours — open Notes',
      description: 'Opens the Notes widget automatically during working hours (09:00–17:00 local).',
      triggerType: 'time_window',
      triggerValue: '09:00-17:00',
      actionType: 'open_widget',
      actionValue: 'notes',
    },
    {
      enabled: true,
      name: 'GitHub — open AI summary',
      description:
        'When navigating to GitHub, opens the AI assistant to help summarise PRs and issues.',
      triggerType: 'url_contains',
      triggerValue: 'github.com',
      actionType: 'open_widget',
      actionValue: 'ai',
    },
    {
      enabled: false,
      name: 'Evening — switch to Personal workspace',
      description: 'Switches to your Personal workspace after 18:00 local time.',
      triggerType: 'time_window',
      triggerValue: '18:00-23:59',
      actionType: 'switch_workspace',
      actionValue: '',
    },
    {
      enabled: false,
      name: 'Block social media distractions',
      description: 'Blocks twitter.com / x.com from loading. Enable when you need to focus.',
      triggerType: 'url_contains',
      triggerValue: 'twitter.com',
      actionType: 'block_hostname',
      actionValue: 'twitter.com',
    },
    {
      enabled: false,
      name: 'YouTube — block autoplay',
      description: 'Runs JS to pause autoplay on YouTube pages.',
      triggerType: 'url_contains',
      triggerValue: 'youtube.com',
      actionType: 'run_javascript',
      actionValue: 'document.querySelector("video")?.pause();',
    },
  ];

  async installMarketplaceRule(mr: (typeof this.marketplaceRules)[number]): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const r: AutomationRuleDTO = {
      ...mr,
      id: crypto.randomUUID(),
    };
    await this.persisted.patch({ automationRules: [...snap.automationRules, r] });
    this.toast.show(`"${mr.name}" installed.`);
  }

  ruleTimeStart(triggerValue: string): string {
    return (triggerValue ?? '').split('-')[0] ?? '09:00';
  }

  ruleTimeEnd(triggerValue: string): string {
    return (triggerValue ?? '').split('-')[1] ?? '17:00';
  }

  /** @deprecated kept for any legacy callers; use installMarketplaceRule instead. */
  async addAutomationPresetRules(): Promise<void> {
    await this.installMarketplaceRule(this.marketplaceRules[0]);
  }

  setFontSize(v: number): void {
    if (v === 12 || v === 14 || v === 16) void this.patchSettings({ fontSize: v });
  }

  setAiProvider(v: string): void {
    if (v === 'mock' || v === 'openai') void this.patchSettings({ aiProvider: v });
  }

  setThemePreset(v: string): void {
    const allowed = ['dark', 'light', 'midnight', 'solarized', 'high-contrast'] as const;
    type T = (typeof allowed)[number];
    if ((allowed as readonly string[]).includes(v))
      void this.patchSettings({ themePreset: v as T });
  }

  async addAutofillHint(): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const h: AutofillHintDTO = {
      id: crypto.randomUUID(),
      label: 'New hint',
      value: '',
    };
    await this.patchSettings({ autofillHints: [...(snap.settings.autofillHints ?? []), h] });
  }

  async updateAutofillHint(id: string, patch: Partial<AutofillHintDTO>): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const next = (snap.settings.autofillHints ?? []).map((x) =>
      x.id === id ? { ...x, ...patch } : x,
    );
    await this.patchSettings({ autofillHints: next });
  }

  async removeAutofillHint(id: string): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    await this.patchSettings({
      autofillHints: (snap.settings.autofillHints ?? []).filter((x) => x.id !== id),
    });
  }

  exportCompanionSnapshot(): void {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const payload: CompanionSnapshotV1 = {
      companion: COMPANION_SNAPSHOT_VERSION,
      exportedAt: Date.now(),
      app: 'dev-lens',
      bookmarks: snap.bookmarks.map((b) => ({ url: b.url, title: b.title })),
      readLater: snap.readLater.map((r) => ({ url: r.url, title: r.title, addedAt: r.addedAt })),
      sessions: snap.savedSessions.map((s) => ({
        name: s.name,
        savedAt: s.savedAt,
        tabs: s.tabs,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dev-lens-companion-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  openBackupExportModal(): void {
    this.backupExportPass.set('');
    this.backupExportPass2.set('');
    this.backupExportOpen.set(true);
  }

  closeBackupExportModal(): void {
    this.backupExportOpen.set(false);
  }

  onModalBackdropKeydown(
    ev: KeyboardEvent,
    target: 'backup-export' | 'backup-import' | 'reset-data' | 'shortcuts-reset',
  ): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    switch (target) {
      case 'backup-export':
        this.closeBackupExportModal();
        break;
      case 'backup-import':
        this.cancelBackupImport();
        break;
      case 'reset-data':
        this.cancelResetData();
        break;
      case 'shortcuts-reset':
        this.cancelShortcutsReset();
        break;
    }
  }

  async submitBackupExport(): Promise<void> {
    const pass = this.backupExportPass().trim();
    const pass2 = this.backupExportPass2().trim();
    if (pass.length < 8) {
      this.toast.error('Passphrase must be at least 8 characters.');
      return;
    }
    if (pass !== pass2) {
      this.toast.error('Passphrases do not match.');
      return;
    }
    const snap = this.persisted.snapshot();
    if (!snap) return;
    this.backupExportOpen.set(false);
    const payload = {
      bookmarks: snap.bookmarks,
      notes: snap.notes,
      readLater: snap.readLater,
      workspaces: snap.workspaces,
      activeWorkspaceId: snap.activeWorkspaceId,
      settings: snap.settings,
      savedSessions: snap.savedSessions,
      automationRules: snap.automationRules,
      tabGroups: snap.tabGroups,
      openTabs: snap.openTabs,
      clipboardHistory: snap.clipboardHistory,
      history: snap.history,
      pluginStates: snap.pluginStates,
      pluginStorage: snap.pluginStorage,
    };
    try {
      const json = await this.backupCrypto.encryptJson(payload, pass);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dev-lens-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      await this.patchSettings({ lastEncryptedBackupAt: new Date().toISOString() });
      this.toast.show('Encrypted backup file saved.');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Export failed.');
    }
  }

  cancelBackupImport(): void {
    this.backupImportOpen.set(false);
    this.backupImportJson.set(null);
    this.backupImportPass.set('');
    this.backupImportStep.set('pass');
    this.backupImportDecoded.set(null);
  }

  async backupImportDecryptStep(): Promise<void> {
    const json = this.backupImportJson();
    const pass = this.backupImportPass().trim();
    if (!json || !pass) {
      this.toast.error('Enter your passphrase.');
      return;
    }
    try {
      const data = await this.backupCrypto.decryptJson<BackupImportPayload>(json, pass);
      this.backupImportDecoded.set(data);
      this.backupImportStep.set('confirm');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not decrypt backup.');
    }
  }

  async applyBackupImport(): Promise<void> {
    const data = this.backupImportDecoded();
    const cur = this.persisted.snapshot();
    if (!data || !cur) return;
    const mode = cur.settings.encryptedImportMode ?? 'replace';
    try {
      if (mode === 'merge_lww') {
        const patch: Partial<DevLensStoreSnapshot> = {};
        if (data.bookmarks) patch.bookmarks = mergeBookmarksLww(cur.bookmarks, data.bookmarks);
        if (data.notes) patch.notes = mergeNotesLww(cur.notes, data.notes);
        if (data.readLater) patch.readLater = mergeReadLaterLww(cur.readLater, data.readLater);
        if (data.savedSessions)
          patch.savedSessions = mergeSavedSessionsLww(cur.savedSessions, data.savedSessions);
        if (data.automationRules)
          patch.automationRules = mergeAutomationRulesLww(
            cur.automationRules,
            data.automationRules,
          );
        if (data.clipboardHistory)
          patch.clipboardHistory = mergeClipboardLww(cur.clipboardHistory, data.clipboardHistory);
        if (data.workspaces) patch.workspaces = mergeWorkspacesLww(cur.workspaces, data.workspaces);
        if (data.pluginStates)
          patch.pluginStates = mergePluginStatesLww(cur.pluginStates ?? {}, data.pluginStates);
        if (data.pluginStorage)
          patch.pluginStorage = mergePluginStorageLww(cur.pluginStorage ?? {}, data.pluginStorage);
        await this.persisted.patch(patch);
      } else {
        await this.persisted.patch({
          ...(data.bookmarks ? { bookmarks: data.bookmarks } : {}),
          ...(data.notes ? { notes: data.notes } : {}),
          ...(data.readLater ? { readLater: data.readLater } : {}),
          ...(data.workspaces ? { workspaces: data.workspaces } : {}),
          ...(data.activeWorkspaceId ? { activeWorkspaceId: data.activeWorkspaceId } : {}),
          ...(data.settings ? { settings: data.settings } : {}),
          ...(data.savedSessions ? { savedSessions: data.savedSessions } : {}),
          ...(data.automationRules ? { automationRules: data.automationRules } : {}),
          ...(data.tabGroups ? { tabGroups: data.tabGroups } : {}),
          ...(data.openTabs ? { openTabs: data.openTabs } : {}),
          ...(data.clipboardHistory ? { clipboardHistory: data.clipboardHistory } : {}),
          ...(data.history ? { history: data.history } : {}),
          ...(data.pluginStates ? { pluginStates: data.pluginStates } : {}),
          ...(data.pluginStorage ? { pluginStorage: data.pluginStorage } : {}),
        });
      }
      this.cancelBackupImport();
      this.toast.show('Backup imported successfully.');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Import failed.');
    }
  }

  onImportEncryptedBackupPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.backupImportJson.set(reader.result as string);
      this.backupImportPass.set('');
      this.backupImportStep.set('pass');
      this.backupImportDecoded.set(null);
      this.backupImportOpen.set(true);
    };
    reader.readAsText(file);
  }
}
