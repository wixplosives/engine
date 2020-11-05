import nodeFeature, { workerEnv } from './node.feature';

globalThis.envMessages.push('enveval');

nodeFeature.setup(workerEnv, () => {
    return {
        workerEnvMessages: {
            getWorkerEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
