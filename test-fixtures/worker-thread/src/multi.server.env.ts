import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import multiFeature, { multiServerEnv, workerEnv } from './multi.feature';

multiFeature.setup(multiServerEnv, ({ onDispose, multiWorkerEcho }, { COM: { communication } }) => {
    return {
        multiWorkersService: {
            initAndCallWorkersEcho: async (values: string[]) => {
                const responses = Promise.all(
                    values.map((value) =>
                        workerThreadInitializer({
                            communication,
                            env: workerEnv,
                        }).then(({ dispose, id }) => {
                            onDispose(dispose);

                            const workerEcho = multiWorkerEcho.get({
                                id,
                            });
                            return workerEcho.echo(value);
                        })
                    )
                );

                return responses;
            },
        },
    };
});
