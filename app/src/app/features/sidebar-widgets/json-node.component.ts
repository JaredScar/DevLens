import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-json-node',
  standalone: true,
  imports: [JsonNodeComponent],
  template: `
    @if (isNull()) {
      <span class="jn-null">null</span>
    } @else if (kind() === 'primitive') {
      <span class="jn-prim">{{ primText() }}</span>
    } @else if (kind() === 'array') {
      <div class="jn-block">
        <button type="button" class="jn-toggle" (click)="open.set(!open())">
          {{ open() ? '▼' : '▶' }} [{{ arrLen() }}]
        </button>
        @if (open()) {
          <div class="jn-children">
            @for (item of arrVal(); track $index) {
              <div class="jn-row">
                <span class="jn-idx">{{ $index }}</span>
                <app-json-node [value]="item" [depth]="depth() + 1" />
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <div class="jn-block">
        <button type="button" class="jn-toggle" (click)="open.set(!open())">
          {{ open() ? '▼' : '▶' }} {{ braceOpen() }}
        </button>
        @if (open()) {
          <div class="jn-children">
            @for (kv of objEntries(); track kv.k) {
              <div class="jn-row">
                <span class="jn-key">"{{ kv.k }}"</span>
                <span class="jn-colon">:</span>
                <app-json-node [value]="kv.v" [depth]="depth() + 1" />
              </div>
            }
          </div>
          <span class="jn-close">{{ braceClose() }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      line-height: 1.45;
    }
    .jn-null {
      color: var(--dl-muted);
    }
    .jn-prim {
      color: var(--dl-accent);
      word-break: break-all;
    }
    .jn-toggle {
      border: none;
      background: transparent;
      color: var(--dl-text);
      cursor: pointer;
      padding: 0 2px 0 0;
      font: inherit;
    }
    .jn-children {
      margin-left: 10px;
      border-left: 1px solid var(--dl-border);
      padding-left: 6px;
    }
    .jn-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 4px;
      margin: 2px 0;
    }
    .jn-idx {
      color: var(--dl-muted);
      min-width: 1.5em;
    }
    .jn-key {
      color: var(--dl-warning);
    }
    .jn-colon {
      color: var(--dl-muted);
    }
    .jn-close {
      color: var(--dl-muted);
    }
  `,
})
export class JsonNodeComponent {
  readonly value = input.required<unknown>();
  readonly depth = input(0);

  readonly open = signal(true);

  isNull(): boolean {
    return this.value() === null;
  }

  kind(): 'primitive' | 'array' | 'object' {
    const v = this.value();
    if (v === null || v === undefined) return 'primitive';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'object') return 'object';
    return 'primitive';
  }

  primText(): string {
    const v = this.value();
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return JSON.stringify(v);
    return String(v);
  }

  arrVal(): unknown[] {
    return Array.isArray(this.value()) ? (this.value() as unknown[]) : [];
  }

  arrLen(): number {
    return this.arrVal().length;
  }

  objEntries(): { k: string; v: unknown }[] {
    const v = this.value();
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return [];
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => ({ k, v: (v as Record<string, unknown>)[k] }));
  }

  braceOpen(): string {
    return this.kind() === 'array' ? '[' : '{';
  }

  braceClose(): string {
    return this.kind() === 'array' ? ']' : '}';
  }
}
