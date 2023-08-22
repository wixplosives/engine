import contextualFeature, { procEnv } from './preload-context.feature.js';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'procEnvEval'];

contextualFeature.setup(procEnv, () => {
    return {
        procEnvMessages: {
            getProcEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
