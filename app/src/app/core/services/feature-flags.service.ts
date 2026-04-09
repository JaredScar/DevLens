import { Injectable, computed, inject } from '@angular/core';
import {
  defaultFeatureFlags,
  mergeFeatureFlags,
  type DevLensFeatureFlags,
  type DevLensFeatureWidgetFlags,
} from '@dev-lens/shared';
import { PersistedStateService } from './persisted-state.service';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private readonly persisted = inject(PersistedStateService);

  /** Effective flags (defaults if missing from snapshot). */
  readonly flags = computed(() => {
    const raw = this.persisted.snapshot()?.settings.featureFlags;
    return raw ? mergeFeatureFlags(defaultFeatureFlags(), raw) : defaultFeatureFlags();
  });

  mode(
    id: keyof Pick<DevLensFeatureFlags, 'spotlight' | 'splitView' | 'focusMode' | 'devtools'>,
  ): boolean {
    return this.flags()[id];
  }

  toolbar(
    id: keyof Pick<
      DevLensFeatureFlags,
      'aiSummarize' | 'autofillMenu' | 'bookmarksButton' | 'chromeExtensionStrip'
    >,
  ): boolean {
    return this.flags()[id];
  }

  data(id: keyof Pick<DevLensFeatureFlags, 'historyRecording' | 'automation'>): boolean {
    return this.flags()[id];
  }

  rightSidebar(): boolean {
    return this.flags().rightSidebar;
  }

  widget(id: keyof DevLensFeatureWidgetFlags): boolean {
    return this.flags().widgets[id];
  }
}
