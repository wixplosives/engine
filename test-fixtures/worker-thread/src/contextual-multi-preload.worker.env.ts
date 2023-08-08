import contextualMultiPreloadFeature, { workerEnv } from './contextual-multi-preload.feature.js';

export interface ContextualMultiPreloadWorkerEcho {
    echo: (value: string) => string;
}

contextualMultiPreloadFeature.setup(workerEnv, () => {
    return {
        contextualMultiPreloadWorkerEcho: {
            echo: (value) => {
                return `${value} from ${globalThis.workerName}`;
            },
        },
    };
});
