/**
 * Device Pairing Widget (Phase 3.3)
 * QR-code pairing for cross-device sync.
 */
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DevicePairingService } from '@core/services/device-pairing.service';
import { FeatureFlagsService } from '@core/services/feature-flags.service';
import { LayoutService } from '@core/services/layout.service';
import { PushNotificationService } from '@core/services/push-notification.service';

@Component({
  selector: 'app-device-pairing-widget',
  imports: [FormsModule],
  template: `
    <div class="dp-widget">
      <header class="dp-header">
        <h3 class="dp-title">
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 16 16"
          >
            <rect x="2" y="4" width="12" height="8" rx="1" />
            <circle cx="5" cy="8" r="1" fill="currentColor" />
            <path d="M8 6v4M10 6v4" />
          </svg>
          Device Pairing
        </h3>
        <button
          type="button"
          class="dp-close"
          (click)="layout.closeRightSidebar()"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div class="dp-body">
        <!-- Generate Pairing -->
        <div class="dp-section">
          <h4 class="dp-section-title">Pair New Device</h4>
          <p class="dp-hint">Scan this QR code with your mobile device to pair</p>

          @if (pairing.currentPairing()) {
            <div class="dp-qr">
              <img [src]="pairing.currentPairing()?.qrDataUrl" alt="Pairing QR Code" />
              <div class="dp-code">{{ pairing.currentPairing()?.pairingCode }}</div>
              <p class="dp-expiry">Expires in 10 minutes</p>
            </div>
            <button type="button" class="dp-btn dp-btn--secondary" (click)="pairing.clearPairing()">
              Dismiss
            </button>
          } @else {
            <button
              type="button"
              class="dp-btn dp-btn--primary"
              (click)="generatePairing()"
              [disabled]="pairing.isLoading()"
            >
              @if (pairing.isLoading()) {
                Generating...
              } @else {
                Generate Pairing Code
              }
            </button>
          }
        </div>

        <!-- Enter Pairing Code -->
        <div class="dp-section">
          <h4 class="dp-section-title">Enter Pairing Code</h4>
          <p class="dp-hint">Enter the 6-digit code from another device</p>
          <div class="dp-input-group">
            <input
              type="text"
              class="dp-input"
              [(ngModel)]="inputCode"
              placeholder="000000"
              maxlength="6"
              pattern="[0-9]{6}"
            />
            <input
              type="text"
              class="dp-input dp-input--device"
              [(ngModel)]="deviceName"
              placeholder="Device name (e.g. iPhone)"
            />
            <button
              type="button"
              class="dp-btn dp-btn--primary"
              (click)="completePairing()"
              [disabled]="!isValidCode() || pairing.isLoading()"
            >
              Connect
            </button>
          </div>
        </div>

        <!-- Paired Devices -->
        <div class="dp-section">
          <h4 class="dp-section-title">Paired Devices ({{ pairing.pairedDevices().length }})</h4>
          @if (pairing.pairedDevices().length === 0) {
            <p class="dp-empty">No paired devices yet</p>
          } @else {
            <ul class="dp-device-list">
              @for (device of pairing.pairedDevices(); track device.id) {
                <li class="dp-device">
                  <div class="dp-device-info">
                    <span class="dp-device-name">{{ device.name }}</span>
                    <span class="dp-device-date">Paired {{ formatDate(device.pairedAt) }}</span>
                  </div>
                  <button
                    type="button"
                    class="dp-btn dp-btn--small dp-btn--danger"
                    (click)="removeDevice(device.id)"
                  >
                    Remove
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <!-- Remote Tabs -->
        @if (notifications.pendingRemoteTabs().length > 0) {
          <div class="dp-section dp-section--highlight">
            <h4 class="dp-section-title">Incoming Tabs</h4>
            <ul class="dp-tab-list">
              @for (tab of notifications.pendingRemoteTabs(); track tab.url) {
                <li class="dp-tab-item">
                  <div class="dp-tab-info">
                    <span class="dp-tab-url">{{ tab.title || tab.url }}</span>
                    <span class="dp-tab-device">From {{ tab.deviceName }}</span>
                  </div>
                  <div class="dp-tab-actions">
                    <button type="button" class="dp-btn dp-btn--small" (click)="acceptTab(tab)">
                      Open
                    </button>
                    <button
                      type="button"
                      class="dp-btn dp-btn--small dp-btn--secondary"
                      (click)="dismissTab(tab)"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .dp-widget {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--dl-bg);
      color: var(--dl-text);
    }
    .dp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--dl-border);
    }
    .dp-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .dp-close {
      background: none;
      border: none;
      color: var(--dl-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
    }
    .dp-close:hover {
      color: var(--dl-text);
    }
    .dp-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .dp-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--dl-border);
    }
    .dp-section:last-child {
      border-bottom: none;
    }
    .dp-section-title {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--dl-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dp-hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--dl-muted);
    }
    .dp-qr {
      text-align: center;
      padding: 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .dp-qr img {
      max-width: 200px;
      height: auto;
    }
    .dp-code {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 4px;
      margin: 12px 0 4px;
      color: var(--dl-accent);
    }
    .dp-expiry {
      font-size: 11px;
      color: var(--dl-muted);
      margin: 0;
    }
    .dp-input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dp-input {
      padding: 8px 12px;
      border: 1px solid var(--dl-border);
      border-radius: 6px;
      background: var(--dl-input-bg);
      color: var(--dl-text);
      font-size: 13px;
      text-align: center;
      letter-spacing: 2px;
    }
    .dp-input--device {
      text-align: left;
      letter-spacing: normal;
    }
    .dp-input:focus {
      outline: none;
      border-color: var(--dl-accent);
    }
    .dp-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--dl-surface);
      color: var(--dl-text);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dp-btn:hover:not(:disabled) {
      background: var(--dl-hover);
    }
    .dp-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .dp-btn--primary {
      background: var(--dl-accent);
      color: white;
    }
    .dp-btn--primary:hover:not(:disabled) {
      background: var(--dl-accent-hover);
    }
    .dp-btn--secondary {
      background: var(--dl-muted);
    }
    .dp-btn--danger {
      background: #dc3545;
      color: white;
    }
    .dp-btn--danger:hover:not(:disabled) {
      background: #c82333;
    }
    .dp-btn--small {
      padding: 4px 12px;
      font-size: 12px;
    }
    .dp-device-list,
    .dp-tab-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .dp-device,
    .dp-tab-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--dl-border-subtle);
    }
    .dp-device:last-child,
    .dp-tab-item:last-child {
      border-bottom: none;
    }
    .dp-device-info,
    .dp-tab-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dp-device-name,
    .dp-tab-url {
      font-size: 13px;
      font-weight: 500;
    }
    .dp-device-date,
    .dp-tab-device {
      font-size: 11px;
      color: var(--dl-muted);
    }
    .dp-tab-actions {
      display: flex;
      gap: 6px;
    }
    .dp-empty {
      font-size: 12px;
      color: var(--dl-muted);
      font-style: italic;
    }
    .dp-section--highlight {
      background: var(--dl-accent-bg, rgba(74, 144, 217, 0.1));
      border-radius: 8px;
      padding: 12px;
    }
  `,
})
export class DevicePairingWidgetComponent {
  readonly pairing = inject(DevicePairingService);
  readonly notifications = inject(PushNotificationService);
  readonly layout = inject(LayoutService);
  readonly features = inject(FeatureFlagsService);

  inputCode = '';
  deviceName = '';

  generatePairing(): void {
    this.pairing.generatePairing();
  }

  completePairing(): void {
    if (!this.isValidCode()) return;
    const name = this.deviceName.trim() || 'New Device';
    this.pairing.completePairing(this.inputCode, name).then((success) => {
      if (success) {
        this.inputCode = '';
        this.deviceName = '';
      }
    });
  }

  removeDevice(deviceId: string): void {
    this.pairing.removeDevice(deviceId);
  }

  acceptTab(tab: { url: string; title?: string; deviceId: string; deviceName: string }): void {
    this.notifications.acceptRemoteTab(tab);
  }

  dismissTab(tab: { url: string; title?: string; deviceId: string; deviceName: string }): void {
    this.notifications.dismissRemoteTab(tab);
  }

  isValidCode(): boolean {
    return /^\d{6}$/.test(this.inputCode);
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
}
