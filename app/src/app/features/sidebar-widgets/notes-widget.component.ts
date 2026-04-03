import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSimpleMarkdown } from '@core/note-markdown';
import { NotesService } from '@core/services/notes.service';
import type { NoteDTO } from '@dev-lens/shared';

@Component({
  selector: 'app-notes-widget',
  imports: [FormsModule, DatePipe],
  templateUrl: './notes-widget.component.html',
  styleUrl: './notes-widget.component.scss',
})
export class NotesWidgetComponent {
  readonly notes = inject(NotesService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly draftTitle = signal('');
  readonly draftBody = signal('');
  readonly draftUrl = signal('');
  readonly filter = signal('');
  readonly editingId = signal<string | null>(null);
  readonly flashNoteId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.notes.highlightNoteId();
      if (!id) return;
      this.flashNoteId.set(id);
      queueMicrotask(() => {
        document.querySelector(`[data-note-card="${id}"]`)?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
        this.notes.requestFocusNote(null);
      });
      window.setTimeout(() => this.flashNoteId.set(null), 2200);
    });
  }

  async saveNote(): Promise<void> {
    const title = this.draftTitle().trim() || 'Untitled';
    const body = this.draftBody();
    const url = this.draftUrl().trim() || undefined;
    const id = this.editingId() ?? crypto.randomUUID();
    await this.notes.upsert({
      id,
      title,
      body,
      url,
    });
    this.draftTitle.set('');
    this.draftBody.set('');
    this.draftUrl.set('');
    this.editingId.set(null);
  }

  startEdit(n: NoteDTO): void {
    this.editingId.set(n.id);
    this.draftTitle.set(n.title);
    this.draftBody.set(n.body);
    this.draftUrl.set(n.url ?? '');
  }

  cancelCompose(): void {
    this.draftTitle.set('');
    this.draftBody.set('');
    this.draftUrl.set('');
    this.editingId.set(null);
  }

  filtered() {
    const q = this.filter().trim().toLowerCase();
    const list = this.notes.notes();
    if (!q) return list;
    return list.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q));
  }

  previewHtml(n: NoteDTO): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderSimpleMarkdown(n.body || ''));
  }
}
