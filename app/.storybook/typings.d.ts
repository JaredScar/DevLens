declare module '*.md' {
  const content: string;
  export default content;
}

// Extend Window interface for Electron bridge
declare global {
  interface Window {
    devLens?: {
      invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

export {};
