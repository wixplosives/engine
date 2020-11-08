import contextualFeature, { procEnv } from './contextual.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'procEnvEval'];

contextualFeature.setup(procEnv, () => {
    return {
        procEnvMessages: {
            getProcEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
