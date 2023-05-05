import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import multiFeature, { multiServerEnv, workerEnv } from './multi.feature';

multiFeature.setup(multiServerEnv, ({ onDispose, multiWorkerEcho }, { COM: { communication } }) => {
    return {
        multiWorkersService: {
            initAndCallWorkersEcho: async (values: string[]) => {
                const responses = Promise.all(
                    values.map((value) => {
                        const worker = workerThreadInitializer({
                            communication,
                            env: workerEnv,
                        });
                        onDispose(worker.dispose);

                        return worker.initialize().then(() => {
                            const workerEcho = multiWorkerEcho.get({
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
});
