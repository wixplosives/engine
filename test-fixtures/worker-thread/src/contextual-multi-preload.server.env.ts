import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import contextualMultiPreloadFeature, {
    contextualMultiServerEnv,
    workerEnv,
} from './contextual-multi-preload.feature.js';

contextualMultiPreloadFeature.setup(
    contextualMultiServerEnv,
    ({ onDispose, contextualMultiPreloadWorkerEcho }, { COM: { communication } }) => {
        return {
            contextualMultiPreloadWorkersService: {
                echo: async (values: string[]) => {
                    const responses = Promise.all(
                        values.map(async (value) => {
                            const context = communication.getEnvironmentContext(workerEnv);
                            const activeEnv = workerEnv.environments.find((e) => e.env == context);

                            const worker = workerThreadInitializer({
                                communication,
                                env: { ...activeEnv, ...workerEnv },
                                environmentStartupOptions: {
                                    environmentContextName: context,
                                },
                            });
                            onDispose(() => worker.dispose());

                            await worker.initialize();
                            const workerEcho = contextualMultiPreloadWorkerEcho.get({
                                id: worker.id,
                            });
                            return await workerEcho.echo(value);
                        }),
                    );

                    return responses;
                },
            },
        };
    },
);
