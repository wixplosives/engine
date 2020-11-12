globalThis.envMessages = [...(globalThis.envMessages ?? []), 'node', 'preload'];

export const init = (runtimeOptions: Record<string, string | boolean>) => {
    globalThis.envMessages = [...(globalThis.envMessages ?? []), 'node', 'preloadInit'];
    globalThis.runtimeOptions = runtimeOptions;
};
