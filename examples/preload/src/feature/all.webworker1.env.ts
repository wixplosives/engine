import allFeature, { workerEnv } from './all.feature.js';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'enveval'];

allFeature.setup(workerEnv, () => {
    return {
        workerEnvMessages: {
            getWorkerEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
