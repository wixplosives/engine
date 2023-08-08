import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import workerThreadFeature, { serverEnv, workerEnv } from './worker-thread.feature.js';

workerThreadFeature.setup(serverEnv, ({ onDispose, workerEcho }, { COM: { communication } }) => {
    return {
        workerService: {
            initAndCallWorkerEcho: async (value) => {
                const worker = workerThreadInitializer({
                    communication,
                    env: workerEnv,
                });
                onDispose(worker.dispose);

                await worker.initialize();

                const result = await workerEcho.echo(value);
                return result;
            },
        },
    };
});
