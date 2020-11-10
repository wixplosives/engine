import allFeature, { workerEnv } from './all.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'enveval'];

allFeature.setup(workerEnv, () => {
    return {
        workerEnvMessages: {
            getWorkerEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
