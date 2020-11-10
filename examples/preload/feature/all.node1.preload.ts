globalThis.envMessages = [...(globalThis.envMessages ?? []), 'node', 'preload'];

export const init = (runtimeOptions: Record<string, string | boolean>) => {
    globalThis.runtimeOptions = runtimeOptions;
};
