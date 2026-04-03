/**
 * Renderer IPC channel strings inlined here on purpose: some dev bundles resolve
 * `@dev-lens/shared` in a way that drops newer keys from `IPC_CHANNELS`, which
 * produced `invoke(undefined)` at runtime. Keep in sync with `shared/src/ipc-channels.ts`
 * and `electron/preload.ts` ALLOWED_INVOKE.
 */
export const RENDERER_INVOKE = {
  SESSION_INIT: 'dev-lens:session:init',
  HISTORY_APPEND: 'dev-lens:history:append',
  SHELL_OPEN_EXTERNAL: 'dev-lens:shell:open-external',
  DEVTOOLS_ATTACH: 'dev-lens:devtools:attach',
  DEVTOOLS_DETACH: 'dev-lens:devtools:detach',
  DEVTOOLS_SET_BOUNDS: 'dev-lens:devtools:set-bounds',
} as const;
