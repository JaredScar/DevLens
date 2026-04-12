/**
 * Page annotation service for team collaboration (Phase 3.4).
 * Allows adding notes/comments to specific elements on web pages.
 */
import { Injectable, inject, signal } from '@angular/core';
import { IPC_CHANNELS, IPC_EVENTS } from '@dev-lens/shared';
import { ElectronBridgeService } from './electron-bridge.service';
import { ToastService } from './toast.service';
import type { AnnotationDTO } from '@dev-lens/shared';

export interface AnnotationCreatePayload {
  url: string;
  selector: string;
  text: string;
  note: string;
  x?: number;
  y?: number;
}

export interface AnnotationsUpdatedEvent {
  url: string;
  annotations: AnnotationDTO[];
}

@Injectable({ providedIn: 'root' })
export class AnnotationService {
  private readonly bridge = inject(ElectronBridgeService);
  private readonly toast = inject(ToastService);

  readonly annotations = signal<AnnotationDTO[]>([]);
  readonly isLoading = signal(false);

  constructor() {
    this.listenForAnnotationUpdates();
  }

  /** Save a new annotation. */
  async saveAnnotation(payload: AnnotationCreatePayload): Promise<string | null> {
    this.isLoading.set(true);
    try {
      const result = await this.bridge.invoke<{ id: string }>(
        IPC_CHANNELS.ANNOTATION_SAVE,
        payload,
      );
      this.toast.show('Annotation saved', 'success');
      return result.id;
    } catch {
      this.toast.show('Failed to save annotation', 'error');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Get annotations for a specific URL. */
  async loadAnnotationsForUrl(url: string): Promise<AnnotationDTO[]> {
    try {
      const result = await this.bridge.invoke<AnnotationDTO[]>(
        IPC_CHANNELS.ANNOTATION_GET_FOR_URL,
        { url },
      );
      this.annotations.set(result);
      return result;
    } catch {
      return [];
    }
  }

  /** Delete an annotation. */
  async deleteAnnotation(id: string): Promise<void> {
    try {
      await this.bridge.invoke(IPC_CHANNELS.ANNOTATION_DELETE, { id });
      this.annotations.update((list) => list.filter((a) => a.id !== id));
      this.toast.show('Annotation deleted', 'success');
    } catch {
      this.toast.show('Failed to delete annotation', 'error');
    }
  }

  /** Toggle sharing status for an annotation. */
  async setShared(id: string, shared: boolean): Promise<void> {
    try {
      await this.bridge.invoke(IPC_CHANNELS.ANNOTATION_SET_SHARED, { id, shared });
      this.annotations.update((list) => list.map((a) => (a.id === id ? { ...a, shared } : a)));
      this.toast.show(shared ? 'Annotation shared' : 'Annotation unshared', 'success');
    } catch {
      this.toast.show('Failed to update sharing', 'error');
    }
  }

  /** Get annotations for current URL (computed). */
  readonly currentAnnotations = computed(() => this.annotations());

  /** Get shared annotations only. */
  readonly sharedAnnotations = computed(() => this.annotations().filter((a) => a.shared));

  private listenForAnnotationUpdates(): void {
    if (!this.bridge.isElectron) return;

    window.devLens?.on(IPC_EVENTS.ANNOTATIONS_UPDATED, (data) => {
      const event = data as AnnotationsUpdatedEvent;
      this.annotations.set(event.annotations);
    });
  }
}
