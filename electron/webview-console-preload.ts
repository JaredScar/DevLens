/**
 * Injected into every `<webview>` guest (see `main.ts` will-attach-webview).
 * Forwards console.* to the embedder via `sendToHost`.
 * Also exposes `window.__devlensExt` to the page's main world so our
 * chrome.webstore shim (injected via executeJavaScript) can request
 * extension installs via the main process.
 */
import { contextBridge, ipcRenderer } from 'electron';

// Expose an install-request API to the page's main world.
// The chrome.webstore shim (injected on Chrome Web Store pages) calls this.
contextBridge.exposeInMainWorld('__devlensExt', {
  requestInstall: (extensionId: string): void => {
    ipcRenderer.send('devlens-ext-install', { extensionId });
  },
});

const CHANNEL = 'dev-lens-console-log';

function stringifyArg(a: unknown): string {
  if (typeof a === 'object' && a !== null) {
    try {
      return JSON.stringify(a);
    } catch {
      return Object.prototype.toString.call(a);
    }
  }
  if (typeof a === 'string') return a;
  if (typeof a === 'number' || typeof a === 'boolean' || typeof a === 'bigint') return String(a);
  if (typeof a === 'symbol') return a.description ?? 'Symbol()';
  if (typeof a === 'function') return '[Function]';
  if (a === undefined) return 'undefined';
  return Object.prototype.toString.call(a);
}

function forward(level: string, args: unknown[]): void {
  try {
    const msg = args.map(stringifyArg).join(' ');
    ipcRenderer.sendToHost(CHANNEL, { level, msg, t: Date.now() });
  } catch {
    /* ignore */
  }
}

for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const orig = console[level].bind(console) as (...a: unknown[]) => void;
  (console as unknown as Record<string, (...a: unknown[]) => void>)[level] = (
    ...args: unknown[]
  ): void => {
    forward(level, args);
    orig(...args);
  };
}

/**
 * When the guest document is raw JSON (common for API URLs), replace with a readable pretty-printed view.
 */
function tryPrettyPrintJsonPage(): void {
  const run = (): void => {
    try {
      const ct = document.contentType || '';
      const body = document.body;
      if (!body) return;
      const raw = (body.innerText || '').trim();
      if (raw.length < 2) return;
      if (raw[0] !== '{' && raw[0] !== '[') return;
      const looksJsonOnly =
        ct.includes('json') ||
        document.querySelectorAll('body > *').length <= 2 ||
        /^\s*(\[|\{)/.test(body.innerHTML || '');
      if (!looksJsonOnly) return;
      const parsed: unknown = JSON.parse(raw) as unknown;
      const formatted = JSON.stringify(parsed, null, 2);
      const esc = (s: string): string =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.documentElement.innerHTML = `<head><meta charset="utf-8"><title>JSON</title><style>
        body{margin:0;font:13px ui-monospace,Cascadia Code,monospace;white-space:pre-wrap;padding:16px;background:#0d1117;color:#e6edf3}
        .dl-json-hint{position:fixed;top:8px;right:12px;font-size:11px;color:#8b949e}
      </style></head><body><div class="dl-json-hint">Dev-Lens JSON view</div><pre>${esc(formatted)}</pre></body>`;
    } catch {
      /* not valid JSON */
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}

tryPrettyPrintJsonPage();
