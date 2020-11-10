globalThis.envMessages = [...(globalThis.envMessages ?? []), 'worker', 'preload'];

export const init = (runtimeOptions: Record<string, string | boolean>) => {
    globalThis.runtimeOptions = runtimeOptions;
};
