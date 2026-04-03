import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonNodeComponent } from './json-node.component';

@Component({
  selector: 'app-json-formatter-widget',
  imports: [FormsModule, JsonNodeComponent],
  templateUrl: './json-formatter-widget.component.html',
  styleUrl: './json-formatter-widget.component.scss',
})
export class JsonFormatterWidgetComponent {
  readonly raw = signal('');
  readonly error = signal('');
  readonly parsed = signal<unknown | null>(null);

  readonly hasTree = computed(() => this.parsed() !== null && this.error() === '');

  apply(): void {
    const text = this.raw().trim();
    this.error.set('');
    this.parsed.set(null);
    if (!text) return;
    try {
      this.parsed.set(JSON.parse(text));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  pretty(): void {
    const text = this.raw().trim();
    if (!text) return;
    try {
      const v = JSON.parse(text);
      this.raw.set(JSON.stringify(v, null, 2));
      this.parsed.set(v);
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
}
