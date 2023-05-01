import multiFeature, { workerEnv } from './multi.feature';

export interface MultiWorkerEcho {
    echo: (value: string) => string;
}

multiFeature.setup(workerEnv, () => {
    return {
        multiWorkerEcho: {
            echo: (value) => {
                return `${value} from worker`;
            },
        },
    };
});
