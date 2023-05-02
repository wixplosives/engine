import workerThreadFeature, { workerEnv } from './worker-thread.feature';

export interface WorkerEcho {
    echo: (value: string) => string;
}

workerThreadFeature.setup(workerEnv, () => {
    return {
        workerEcho: {
            echo: (value) => {
                return `${value} from worker`;
            },
        },
    };
});
