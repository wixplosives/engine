import contextualFeature, { procEnv } from './contextual.feature';
globalThis.envMessages.push('procEnvEval');

contextualFeature.setup(procEnv, () => {
    return {
        procEnvMessages: {
            getProcEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
