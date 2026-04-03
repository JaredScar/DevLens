import {
  Component,
  computed,
  inject,
  signal,
  ElementRef,
  viewChild,
  AfterViewChecked,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PageAiIntentService } from '@core/services/page-ai-intent.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';

interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
}

const CANNED: Record<string, string> = {
  summarize:
    'Sure! This page appears to be about web development. Key points: modern frameworks, component-based architecture, and reactive data flow.',
  help: 'I can summarize pages, answer questions about content, or assist with research. Just ask!',
  default:
    "I'm a local AI assistant. I can help analyze the current page, answer questions, or assist with research tasks.",
};

function pickResponse(input: string): string {
  const q = input.toLowerCase();
  if (q.includes('summar') || q.includes('what is this')) return CANNED['summarize'];
  if (q.includes('help') || q.includes('what can you')) return CANNED['help'];
  return CANNED['default'];
}

/** RAG-lite: pull several body text chunks from the active page for AI context. */
const PAGE_CONTEXT_CHUNK = 1400;
const PAGE_CONTEXT_MAX_CHUNKS = 5;
const PAGE_CONTEXT_SCRIPT = `(function(){
  var t=document.title||'';
  var b=document.body&&document.body.innerText?document.body.innerText:'';
  var max=${PAGE_CONTEXT_CHUNK};
  var cap=${PAGE_CONTEXT_MAX_CHUNKS};
  var chunks=[];
  for(var i=0;i<b.length&&chunks.length<cap;i+=max){chunks.push(b.slice(i,i+max));}
  return JSON.stringify({title:t,chunks:chunks});
})()`;

function formatPageContextForAi(raw: string): string {
  try {
    const o = JSON.parse(raw) as { title?: string; chunks?: string[] };
    const title = o.title?.trim() || '(untitled)';
    const parts = (o.chunks ?? []).filter((c) => c?.trim());
    if (!parts.length) return title + ' — (no body text)';
    return (
      title +
      '\n\n' +
      parts.map((c, i) => '[Chunk ' + (i + 1) + '/' + parts.length + ']\n' + c.trim()).join('\n\n')
    );
  } catch {
    return raw.slice(0, 6000);
  }
}

@Component({
  selector: 'app-ai-widget',
  imports: [FormsModule],
  templateUrl: './ai-widget.component.html',
  styleUrl: './ai-widget.component.scss',
})
export class AiWidgetComponent implements AfterViewChecked, OnDestroy {
  private readonly tabs = inject(TabsService);
  private readonly persisted = inject(PersistedStateService);
  private readonly pageAi = inject(PageAiIntentService);
  private readonly scrollRef = viewChild<ElementRef<HTMLElement>>('scroll');
  private intentSub: Subscription | undefined;

  readonly messages = signal<ChatMessage[]>([
    {
      role: 'bot',
      text: 'Hi! I can help you summarize pages, answer questions about content, or assist with research. What would you like to know?',
    },
  ]);
  readonly input = signal('');
  readonly loading = signal(false);

  /** Matches `runCompletion`: real API only when OpenAI + API key. */
  readonly showDemoBanner = computed(() => {
    const s = this.persisted.snapshot()?.settings;
    if (!s) return true;
    return s.aiProvider !== 'openai' || (s.aiApiKey?.trim()?.length ?? 0) === 0;
  });

  private lastScrollLen = 0;

  constructor() {
    this.intentSub = this.pageAi.intents$.subscribe((text) => {
      void this.runCompletion(text);
    });
  }

  ngOnDestroy(): void {
    this.intentSub?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    const msgs = this.messages();
    if (msgs.length !== this.lastScrollLen) {
      this.lastScrollLen = msgs.length;
      const el = this.scrollRef()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }

  openAiSettings(): void {
    void this.tabs.addInternalTab('settings', 'Settings');
  }

  async send(): Promise<void> {
    const text = this.input().trim();
    if (!text) return;
    this.input.set('');
    await this.runCompletion(text);
  }

  private async runCompletion(userText: string): Promise<void> {
    this.messages.update((m) => [...m, { role: 'user', text: userText }]);
    this.loading.set(true);

    let context = '';
    try {
      const raw = (await this.tabs.executeJavaScriptInActive(PAGE_CONTEXT_SCRIPT)) as string;
      context = formatPageContextForAi(typeof raw === 'string' ? raw : '');
    } catch {
      /* ignore */
    }

    const settings = this.persisted.snapshot()?.settings;
    const useOpenAi =
      settings?.aiProvider === 'openai' && (settings.aiApiKey?.trim()?.length ?? 0) > 0;

    try {
      if (useOpenAi && settings) {
        const base = (settings.aiBaseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
        const model = settings.aiModel?.trim() || 'gpt-4o-mini';
        const thread = this.messages()
          .slice(1)
          .map((msg) => ({
            role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: msg.text,
          }));
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.aiApiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a concise assistant inside a desktop browser. Use the page context when relevant. Keep answers brief unless the user asks for detail.\n\nPage context:\n' +
                  (context || '(no page context)'),
              },
              ...thread.slice(-14),
            ],
          }),
        });
        const data = (await res.json()) as {
          error?: { message?: string };
          choices?: { message?: { content?: string } }[];
        };
        if (!res.ok) {
          const err = data.error?.message ?? `HTTP ${res.status}`;
          this.messages.update((m) => [...m, { role: 'bot', text: `Error: ${err}` }]);
        } else {
          const reply = data.choices?.[0]?.message?.content?.trim() || '(empty response)';
          this.messages.update((m) => [...m, { role: 'bot', text: reply }]);
        }
      } else {
        await new Promise((r) => setTimeout(r, 400));
        const response = context
          ? `Based on page context: ${pickResponse(userText)}`
          : pickResponse(userText);
        this.messages.update((m) => [...m, { role: 'bot', text: response }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.messages.update((m) => [...m, { role: 'bot', text: `Request failed: ${msg}` }]);
    } finally {
      this.loading.set(false);
    }
  }
}
