import multiFeature, { workerEnv } from './multi.feature';

export interface MultiWorkerEcho {
    ping: () => string;
}

multiFeature.setup(workerEnv, ({ workerResponseConfig: { response } }) => {
    return {
        multiWorkerEcho: {
            ping: () => {
                return response;
            },
        },
    };
});
