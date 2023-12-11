import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import multiFeature, { multiServerEnv, workerEnv } from './multi.feature.js';

multiFeature.setup(multiServerEnv, ({ onDispose, multiWorkerEcho }, { COM: { communication } }) => {
    return {
        multiWorkersService: {
            initAndCallWorkersEcho: async (values: string[]) => {
                const responses = Promise.all(
                    values.map(async (value) => {
                        const worker = workerThreadInitializer({
                            communication,
                            env: workerEnv,
                        });
                        onDispose(() => worker.dispose());

                        await worker.initialize();
                        const workerEcho = multiWorkerEcho.get({
                            id: worker.id,
                        });
                        return await workerEcho.echo(value);
                    }),
                );

                return responses;
            },
        },
    };
});
