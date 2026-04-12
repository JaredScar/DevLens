import {
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatureFlagsService } from '@core/services/feature-flags.service';
import { LayoutService } from '@core/services/layout.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';
import { NotesService } from '@core/services/notes.service';
import { WidgetRegistryService } from '@core/services/widget-registry.service';
import { SpotlightService } from './spotlight.service';
import { TranslatePipe } from '@ngx-translate/core';

type CategoryKey = 'TABS' | 'BOOKMARKS' | 'HISTORY' | 'NOTES' | 'COMMANDS';

interface Row {
  id: string;
  label: string;
  sub?: string;
  category: CategoryKey;
  run: () => void;
}

@Component({
  selector: 'app-spotlight',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './spotlight.component.html',
  styleUrl: './spotlight.component.scss',
})
export class SpotlightComponent {
  readonly spotlight = inject(SpotlightService);
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('spotIn');
  private readonly tabs = inject(TabsService);
  private readonly persisted = inject(PersistedStateService);
  private readonly notes = inject(NotesService);
  private readonly layout = inject(LayoutService);
  private readonly widgets = inject(WidgetRegistryService);
  private readonly features = inject(FeatureFlagsService);

  readonly query = signal('');
  readonly selected = signal(0);

  constructor() {
    effect(() => {
      if (this.spotlight.open()) {
        queueMicrotask(() => this.inputRef()?.nativeElement?.focus());
      }
    });
  }

  readonly rows = computed(() => {
    const ff = this.features.flags();
    const q = this.query().trim().toLowerCase();
    const rows: Row[] = [];

    for (const t of this.tabs.tabs()) {
      const hay = `${t.title} ${t.url}`.toLowerCase();
      if (!q || hay.includes(q)) {
        rows.push({
          id: `tab-${t.id}`,
          label: t.title || 'Tab',
          sub: t.url,
          category: 'TABS',
          run: () => {
            void this.tabs.selectTab(t.id);
            this.spotlight.hide();
          },
        });
      }
    }

    for (const b of this.persisted.snapshot()?.bookmarks ?? []) {
      const hay = `${b.title} ${b.url}`.toLowerCase();
      if (!q || hay.includes(q)) {
        rows.push({
          id: `bm-${b.id}`,
          label: b.title,
          sub: b.url,
          category: 'BOOKMARKS',
          run: () => {
            void this.tabs.addBrowserTab(b.url, b.title);
            this.spotlight.hide();
          },
        });
      }
    }

    for (const h of (this.persisted.snapshot()?.history ?? []).slice(0, 40)) {
      const hay = `${h.title} ${h.url}`.toLowerCase();
      if (!q || hay.includes(q)) {
        rows.push({
          id: `hist-${h.id}`,
          label: h.title,
          sub: h.url,
          category: 'HISTORY',
          run: () => {
            void this.tabs.addBrowserTab(h.url, h.title);
            this.spotlight.hide();
          },
        });
      }
    }

    for (const n of this.notes.notes()) {
      const hay = `${n.title} ${n.body}`.toLowerCase();
      if (!q || hay.includes(q)) {
        rows.push({
          id: `note-${n.id}`,
          label: n.title || 'Note',
          sub: n.body.slice(0, 80),
          category: 'NOTES',
          run: () => {
            this.spotlight.hide();
            if (!ff.rightSidebar || !ff.widgets.notes) return;
            this.layout.openRightSidebar();
            this.widgets.select('notes');
            this.notes.requestFocusNote(n.id);
          },
        });
      }
    }

    rows.push(
      {
        id: 'cmd-new-tab',
        label: 'New browser tab',
        category: 'COMMANDS',
        run: () => {
          void this.tabs.addBrowserTab('about:blank', 'New Tab');
          this.spotlight.hide();
        },
      },
      {
        id: 'cmd-settings',
        label: 'Open settings',
        category: 'COMMANDS',
        run: () => {
          void this.tabs.addInternalTab('settings', 'Settings');
          this.spotlight.hide();
        },
      },
    );

    return rows;
  });

  readonly visible = this.spotlight.open;

  onInput(): void {
    this.selected.set(0);
  }

  pick(i: number): void {
    const r = this.rows()[i];
    if (r) r.run();
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (!this.spotlight.open()) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.spotlight.hide();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const n = this.rows().length;
      if (n) this.selected.update((i) => (i + 1) % n);
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const n = this.rows().length;
      if (n) this.selected.update((i) => (i - 1 + n) % n);
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.pick(this.selected());
    }
  }
}
