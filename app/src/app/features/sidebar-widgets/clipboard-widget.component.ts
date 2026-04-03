import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { ClipboardEntryDTO } from '@dev-lens/shared';
import { appendClipboardEntryIfNew } from '@core/clipboard-merge';
import { PersistedStateService } from '@core/services/persisted-state.service';

@Component({
  selector: 'app-clipboard-widget',
  imports: [DatePipe],
  templateUrl: './clipboard-widget.component.html',
  styleUrl: './clipboard-widget.component.scss',
})
export class ClipboardWidgetComponent implements OnInit, OnDestroy {
  readonly persisted = inject(PersistedStateService);

  readonly entries = signal<ClipboardEntryDTO[]>([]);
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastClipboard = '';

  ngOnInit(): void {
    this.loadStored();
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private loadStored(): void {
    const stored = this.persisted.snapshot()?.clipboardHistory ?? [];
    this.entries.set([...stored]);
  }

  private startPolling(): void {
    if (!navigator.clipboard?.readText) return;
    this.pollInterval = setInterval(() => void this.checkClipboard(), 2000);
  }

  private async checkClipboard(): Promise<void> {
    const snap = this.persisted.snapshot();
    if (snap?.settings.clipboardMonitoringPaused || snap?.settings.systemClipboardWatch) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== this.lastClipboard) {
        this.lastClipboard = text;
        await appendClipboardEntryIfNew(this.persisted, text);
        this.loadStored();
      }
    } catch {
      /* clipboard access denied */
    }
  }

  async copy(entry: ClipboardEntryDTO): Promise<void> {
    await navigator.clipboard.writeText(entry.text);
  }

  async remove(id: string): Promise<void> {
    const updated = this.entries().filter((e) => e.id !== id);
    this.entries.set(updated);
    await this.persisted.patch({ clipboardHistory: updated });
  }

  async clearAll(): Promise<void> {
    this.entries.set([]);
    await this.persisted.patch({ clipboardHistory: [] });
  }

  displayText(text: string): string {
    return text.length > 60 ? text.slice(0, 57) + '…' : text;
  }
}
