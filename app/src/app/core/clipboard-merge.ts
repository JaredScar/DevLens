import type { ClipboardEntryDTO } from '@dev-lens/shared';
import type { PersistedStateService } from '@core/services/persisted-state.service';

function isUrl(text: string): boolean {
  return /^https?:\/\//.test(text.trim());
}

/** Append clipboard text if new; persists via store. */
export async function appendClipboardEntryIfNew(
  persisted: PersistedStateService,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const existing = persisted.snapshot()?.clipboardHistory ?? [];
  if (existing.some((e) => e.text === trimmed)) return;
  const entry: ClipboardEntryDTO = {
    id: crypto.randomUUID(),
    text: trimmed,
    kind: isUrl(trimmed) ? 'url' : 'text',
    savedAt: Date.now(),
  };
  const updated = [entry, ...existing].slice(0, 50);
  await persisted.patch({ clipboardHistory: updated });
}
