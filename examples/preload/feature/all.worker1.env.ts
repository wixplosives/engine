import allFeature, { workerEnv } from './all.feature';

globalThis.envMessages.push('enveval');

allFeature.setup(workerEnv, () => {
    return {
        workerEnvMessages: {
            getWorkerEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
