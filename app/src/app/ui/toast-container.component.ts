import { Component, inject } from '@angular/core';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toast.items(); track t.id) {
        <div class="toast" [class.toast--error]="t.variant === 'error'" role="status">
          <span class="toast__text">{{ t.text }}</span>
          <button
            type="button"
            class="toast__dismiss"
            (click)="toast.dismiss(t.id)"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      top: 56px;
      right: 12px;
      z-index: 9000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: min(420px, calc(100vw - 24px));
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--dl-radius, 8px);
      border: 1px solid var(--dl-border, #30363d);
      background: var(--dl-bg-elevated, #21262d);
      color: var(--dl-text, #e6edf3);
      box-shadow: var(--dl-shadow, 0 12px 40px rgba(0, 0, 0, 0.5));
      font-size: 13px;
      line-height: 1.4;
    }
    .toast--error {
      border-color: var(--dl-danger, #f85149);
      background: rgba(248, 81, 73, 0.12);
    }
    .toast__text {
      flex: 1;
      min-width: 0;
    }
    .toast__dismiss {
      flex-shrink: 0;
      border: none;
      background: transparent;
      color: var(--dl-muted, #8b949e);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 2px;
    }
    .toast__dismiss:hover {
      color: var(--dl-text, #e6edf3);
    }
  `,
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);
}
