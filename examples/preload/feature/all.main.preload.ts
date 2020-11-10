globalThis.envMessages = [...(globalThis.envMessages ?? []), 'main', 'preload'];

export const init = (runtimeOptions: Record<string, string | boolean>) => {
    globalThis.runtimeOptions = runtimeOptions;
};
