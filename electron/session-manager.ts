import { session } from 'electron';
import { attachRequestBlocker } from './blocker';
import { attachNetworkSpy, type NetworkLogPayload } from './network-spy';

const WEBSTORE_URL_PATTERNS = [
  '*://chromewebstore.google.com/*',
  '*://chrome.google.com/webstore/*',
];

/**
 * Fix the sec-ch-ua Client Hints header for Chrome Web Store requests.
 *
 * The new chromewebstore.google.com uses Client Hints for *server-side* browser
 * detection. Electron's Chromium sends "Chromium";v="X" but omits the
 * "Google Chrome";v="X" brand that the store requires to serve the install
 * button. Without this fix, the server renders "Item currently unavailable"
 * in the SSR HTML before any JavaScript runs — no client-side shim can rescue it.
 *
 * Export so main.ts can apply it to session.defaultSession too.
 */
export function attachWebStoreChromeBranding(ses: import('electron').Session): void {
  ses.webRequest.onBeforeSendHeaders({ urls: WEBSTORE_URL_PATTERNS }, (details, callback) => {
    const headers = { ...details.requestHeaders };

    const major = (process.versions.chrome ?? '130').split('.')[0];
    const fullVersion = process.versions.chrome ?? '130.0.0.0';
    const platform =
      process.platform === 'darwin'
        ? '"macOS"'
        : process.platform === 'win32'
          ? '"Windows"'
          : '"Linux"';

    // ── sec-ch-ua (major-version brand list) ──────────────────────────────
    const key = Object.keys(headers).find((k) => k.toLowerCase() === 'sec-ch-ua');
    if (key) {
      const ua = headers[key];
      if (ua && !/Google Chrome/.test(ua)) {
        const vMatch = ua.match(/"Chromium";v="(\d+)"/);
        const v = vMatch ? vMatch[1] : major;
        headers[key] = `${ua}, "Google Chrome";v="${v}"`;
      }
    } else {
      headers['sec-ch-ua'] =
        `"Not_A Brand";v="99", "Chromium";v="${major}", "Google Chrome";v="${major}"`;
      headers['sec-ch-ua-mobile'] = headers['sec-ch-ua-mobile'] ?? '?0';
      headers['sec-ch-ua-platform'] = headers['sec-ch-ua-platform'] ?? platform;
    }

    // ── sec-ch-ua-full-version-list (full semver brand list) ──────────────
    // The Web Store API calls also send this hint; without "Google Chrome"
    // here, the installability check made by the React app can still fail.
    const fvKey = Object.keys(headers).find(
      (k) => k.toLowerCase() === 'sec-ch-ua-full-version-list',
    );
    if (fvKey) {
      const fv = headers[fvKey];
      if (fv && !/Google Chrome/.test(fv)) {
        const cvMatch = fv.match(/"Chromium";v="([^"]+)"/);
        const cv = cvMatch ? cvMatch[1] : fullVersion;
        headers[fvKey] = `${fv}, "Google Chrome";v="${cv}"`;
      }
    } else {
      headers['sec-ch-ua-full-version-list'] =
        `"Not_A Brand";v="99.0.0.0", "Chromium";v="${fullVersion}", "Google Chrome";v="${fullVersion}"`;
    }

    callback({ requestHeaders: headers });
  });
}

/**
 * Manages Electron sessions for webview partitions.
 * Replaces the old BrowserView-based TabManager for all session/blocker concerns.
 */
export class SessionManager {
  private readonly initialized = new Set<string>();
  private blockedSession = 0;

  constructor(
    private readonly isBlockerEnabled: () => boolean,
    private readonly emitBlockerStats: () => void,
    private readonly emitNetworkLog: (payload: NetworkLogPayload) => void,
  ) {}

  /**
   * Attach the request blocker to a partition's session.
   * Safe to call multiple times for the same partition (idempotent).
   */
  initSession(partition: string): void {
    if (this.initialized.has(partition)) return;
    this.initialized.add(partition);
    const ses = session.fromPartition(partition);

    // Remove "Electron/X.X.X" from the user-agent so that websites (including
    // the Chrome Web Store) treat the webview as a regular Chrome browser.
    // Without this, the Chrome Web Store hides the "Add to Chrome" button.
    const cleanUA = ses.getUserAgent().replace(/ Electron\/[\d.]+/, '');
    ses.setUserAgent(cleanUA);

    // Fix sec-ch-ua Client Hints so the Web Store server-side render sees
    // "Google Chrome" and returns the install button instead of "unavailable".
    attachWebStoreChromeBranding(ses);

    attachRequestBlocker(ses, this.isBlockerEnabled, () => {
      this.blockedSession++;
      this.emitBlockerStats();
    });
    attachNetworkSpy(ses, partition, (p) => this.emitNetworkLog(p));
  }

  getBlockedSessionCount(): number {
    return this.blockedSession;
  }

  resetBlockerStats(): void {
    this.blockedSession = 0;
    this.emitBlockerStats();
  }

  /** Return all currently-initialized session objects (for extension loading). */
  getInitializedSessions(): import('electron').Session[] {
    return [...this.initialized].map((partition) => session.fromPartition(partition));
  }
}

export function sanitizePartition(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}
