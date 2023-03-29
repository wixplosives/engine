import testFeature, { workerEnv } from './worker-thread.feature';

export interface WorkerEcho {
    ping: () => string;
}

testFeature.setup(workerEnv, ({ workerResponseConfig: { response } }) => {
    return {
        workerEcho: {
            ping: () => {
                return response;
            },
        },
    };
});
