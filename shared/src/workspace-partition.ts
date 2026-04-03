/**
 * Session partition string for a Dev-Lens workspace browser `<webview>`.
 * Must match main-process workspace init (`electron/main.ts`) exactly.
 */
export function workspaceBrowserPartition(workspaceId: string): string {
  const safe = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return `persist:dev-lens-ws-${safe}`;
}
