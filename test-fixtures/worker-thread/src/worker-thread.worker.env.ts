import workerThreadFeature, { workerEnv } from './worker-thread.feature';

export interface WorkerEcho {
    ping: () => string;
}

workerThreadFeature.setup(workerEnv, ({ workerResponseConfig: { response } }) => {
    return {
        workerEcho: {
            ping: () => {
                return response;
            },
        },
    };
});
