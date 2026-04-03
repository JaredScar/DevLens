import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ElectronBridgeService {
  readonly isElectron = typeof window !== 'undefined' && !!window.devLens;

  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (!window.devLens) {
      return Promise.reject(new Error('Not running in Electron'));
    }
    return window.devLens.invoke<T>(channel, ...args);
  }

  on(channel: string, cb: (data: unknown) => void): () => void {
    if (!window.devLens) {
      return (): void => undefined;
    }
    return window.devLens.on(channel, cb);
  }
}
