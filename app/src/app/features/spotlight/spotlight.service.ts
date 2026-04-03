import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpotlightService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
  }

  show(): void {
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }
}
