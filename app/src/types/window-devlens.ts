export {};

declare global {
  interface Window {
    devLens?: {
      invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
      on(channel: string, callback: (data: unknown) => void): () => void;
    };
  }
}
