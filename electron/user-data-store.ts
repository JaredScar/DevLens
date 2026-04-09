import Store from 'electron-store';
import {
  defaultFeatureFlags,
  defaultStoreSnapshot,
  mergeFeatureFlags,
  type DevLensStoreSnapshot,
} from '@dev-lens/shared';

export type UserStore = Store<DevLensStoreSnapshot>;

export function createUserStore(): UserStore {
  return new Store({
    name: 'dev-lens',
    defaults: defaultStoreSnapshot(),
  }) as UserStore;
}

export function patchUserStore(store: UserStore, partial: Partial<DevLensStoreSnapshot>): void {
  for (const key of Object.keys(partial) as (keyof DevLensStoreSnapshot)[]) {
    const v = partial[key];
    if (v === undefined) continue;
    if (key === 'settings') {
      const prev = store.get('settings');
      const next = v as DevLensStoreSnapshot['settings'];
      const baseFlags = prev.featureFlags ?? defaultFeatureFlags();
      const featureFlags =
        next.featureFlags !== undefined
          ? mergeFeatureFlags(baseFlags, next.featureFlags)
          : baseFlags;
      store.set('settings', {
        ...prev,
        ...next,
        featureFlags,
      });
    } else if (key === 'pluginStates') {
      store.set('pluginStates', {
        ...store.get('pluginStates'),
        ...(v as DevLensStoreSnapshot['pluginStates']),
      });
    } else if (key === 'pluginStorage') {
      const next = { ...store.get('pluginStorage') };
      for (const [pid, bag] of Object.entries(v as DevLensStoreSnapshot['pluginStorage'])) {
        next[pid] = { ...(next[pid] ?? {}), ...bag };
      }
      store.set('pluginStorage', next);
    } else {
      store.set(key, v as never);
    }
  }
}
