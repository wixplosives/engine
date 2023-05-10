import contextualMultiPreloadFeature, { PreloadedGlobalThis, workerEnv } from './contextual-multi-preload.feature';

export interface ContextualMultiPreloadWorkerEcho {
    echo: (value: string) => string;
}

contextualMultiPreloadFeature.setup(workerEnv, () => {
    return {
        contextualMultiPreloadWorkerEcho: {
            echo: (value) => {
                const preloadedGlobalThis = global as unknown as PreloadedGlobalThis;
                return `${value} from ${preloadedGlobalThis.workerName}`;
            },
        },
    };
});
