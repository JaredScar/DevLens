import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ApiResponse {
  status: number;
  statusText: string;
  elapsed: number;
  body: string;
  headers: Record<string, string>;
}

interface HistoryItem {
  method: string;
  url: string;
  body: string;
  headersText: string;
  at: number;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;
type HttpMethod = (typeof METHODS)[number];

function parseHeaderLines(raw: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf(':');
    if (i > 0) {
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (k) o[k] = v;
    }
  }
  return o;
}

@Component({
  selector: 'app-api-tester-widget',
  imports: [FormsModule],
  templateUrl: './api-tester-widget.component.html',
  styleUrl: './api-tester-widget.component.scss',
})
export class ApiTesterWidgetComponent {
  readonly methods = METHODS;
  readonly method = signal<HttpMethod>('GET');
  readonly url = signal('');
  readonly body = signal('');
  readonly requestHeadersText = signal('');
  readonly bearerToken = signal('');
  readonly basicUser = signal('');
  readonly basicPassword = signal('');
  readonly loading = signal(false);
  readonly response = signal<ApiResponse | null>(null);
  readonly error = signal('');
  readonly showBody = signal(false);
  readonly showReqHeaders = signal(false);
  readonly showRespHeaders = signal(true);
  readonly history = signal<HistoryItem[]>([]);

  get statusColor(): string {
    const s = this.response()?.status ?? 0;
    if (s >= 200 && s < 300) return 'success';
    if (s >= 300 && s < 400) return 'warn';
    return 'error';
  }

  formattedBody(): string {
    const raw = this.response()?.body ?? '';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  responseHeaderLines(): { key: string; value: string }[] {
    const h = this.response()?.headers ?? {};
    return Object.keys(h)
      .sort()
      .map((key) => ({ key, value: h[key] }));
  }

  responseHeadersFormatted(): string {
    return this.responseHeaderLines()
      .map((l) => `${l.key}: ${l.value}`)
      .join('\n');
  }

  historyUrlShort(u: string): string {
    return u.length > 36 ? u.slice(0, 36) + '…' : u;
  }

  applyBearer(): void {
    const t = this.bearerToken().trim();
    if (!t) return;
    const cur = this.requestHeadersText();
    const lines = cur.split('\n').filter((l) => !/^authorization\s*:/i.test(l.trim()));
    const next = [...lines, `Authorization: Bearer ${t}`].join('\n');
    this.requestHeadersText.set(next);
  }

  applyBasic(): void {
    const u = this.basicUser().trim();
    if (!u) return;
    const p = this.basicPassword();
    const token = typeof btoa === 'function' ? btoa(`${u}:${p}`) : '';
    if (!token) return;
    const cur = this.requestHeadersText();
    const lines = cur.split('\n').filter((l) => !/^authorization\s*:/i.test(l.trim()));
    const next = [...lines, `Authorization: Basic ${token}`].join('\n');
    this.requestHeadersText.set(next);
  }

  loadHistoryItem(h: HistoryItem): void {
    this.method.set(h.method as HttpMethod);
    this.url.set(h.url);
    this.body.set(h.body);
    this.requestHeadersText.set(h.headersText);
  }

  async send(): Promise<void> {
    const target = this.url().trim();
    if (!target) return;
    this.loading.set(true);
    this.response.set(null);
    this.error.set('');
    const start = Date.now();
    const m = this.method();
    const headerObj = parseHeaderLines(this.requestHeadersText());
    if (m !== 'GET' && m !== 'HEAD' && this.body().trim()) {
      if (!headerObj['Content-Type'] && !headerObj['content-type']) {
        headerObj['Content-Type'] = 'application/json';
      }
    }
    try {
      const init: RequestInit = {
        method: m,
        headers: headerObj,
      };
      if (m !== 'GET' && m !== 'HEAD' && this.body().trim()) {
        init.body = this.body();
      }
      const res = await fetch(target, init);
      const text = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });
      this.response.set({
        status: res.status,
        statusText: res.statusText,
        elapsed: Date.now() - start,
        body: text,
        headers,
      });
      this.history.update((list) => {
        const item: HistoryItem = {
          method: m,
          url: target,
          body: this.body(),
          headersText: this.requestHeadersText(),
          at: Date.now(),
        };
        return [item, ...list.filter((x) => x.url !== target || x.method !== m)].slice(0, 20);
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
