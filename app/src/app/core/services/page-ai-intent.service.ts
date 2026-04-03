import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Fire-and-forget user prompts into the AI widget (e.g. omnibox “Summarize”). */
@Injectable({ providedIn: 'root' })
export class PageAiIntentService {
  private readonly subject = new Subject<string>();

  readonly intents$ = this.subject.asObservable();

  emitUserMessage(text: string): void {
    const t = text.trim();
    if (t) this.subject.next(t);
  }
}
