import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import contextualMultiPreloadFeature, { contextualMultiServerEnv, workerEnv } from './contextual-multi-preload.feature';

contextualMultiPreloadFeature.setup(
    contextualMultiServerEnv,
    ({ onDispose, contextualMultiPreloadWorkerEcho }, { COM: { communication } }) => {
        return {
            contextualMultiPreloadWorkersService: {
                echo: async (values: string[]) => {
                    const responses = Promise.all(
                        values.map((value) => {
                            const context = communication.getEnvironmentContext(workerEnv);
                            const activeEnv = workerEnv.environments.find((e) => e.env == context);

                            const worker = workerThreadInitializer({
                                communication,
                                env: { ...activeEnv, ...workerEnv },
                                environmentStartupOptions: {
                                    environmentContextName: context,
                                },
                            });
                            onDispose(worker.dispose);

                            return worker.initialize().then(() => {
                                const workerEcho = contextualMultiPreloadWorkerEcho.get({
                                    id: worker.id,
                                });
                                return workerEcho.echo(value);
                            });
                        })
                    );

                    return responses;
                },
            },
        };
    }
);
