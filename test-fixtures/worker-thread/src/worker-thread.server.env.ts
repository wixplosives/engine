import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import workerThreadFeature, { serverEnv, workerEnv } from './worker-thread.feature';

workerThreadFeature.setup(serverEnv, ({ onDispose, workerEcho }, { COM: { communication } }) => {
    return {
        workerService: {
            initAndCallWorkerEcho: async (value) => {
                const { dispose: disposeWorker } = await workerThreadInitializer({
                    communication,
                    env: workerEnv,
                });

                onDispose(disposeWorker);

                const result = await workerEcho.echo(value);
                return result;
            },
        },
    };
});
