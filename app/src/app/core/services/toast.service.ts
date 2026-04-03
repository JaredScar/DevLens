import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'info' | 'error';

export interface ToastItem {
  id: string;
  text: string;
  variant: ToastVariant;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly items = signal<ToastItem[]>([]);

  show(text: string, variant: ToastVariant = 'info', durationMs = 4000): void {
    const id = `t-${++this.seq}`;
    this.items.update((a) => [...a, { id, text, variant }]);
    window.setTimeout(() => this.dismiss(id), durationMs);
  }

  error(text: string, durationMs = 5500): void {
    this.show(text, 'error', durationMs);
  }

  dismiss(id: string): void {
    this.items.update((a) => a.filter((x) => x.id !== id));
  }
}
