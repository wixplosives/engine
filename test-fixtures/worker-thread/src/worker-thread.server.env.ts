import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import workerThreadFeature, { serverEnv, workerEnv } from './worker-thread.feature';

workerThreadFeature.setup(serverEnv, ({ run, workerEcho, workerResponseConfig }, { COM: { communication } }) => {
    run(async () => {
        const { dispose: disposeWorker } = await workerThreadInitializer({
            communication,
            env: workerEnv,
        });

        const response = await workerEcho.ping();

        await disposeWorker();

        if (response === workerResponseConfig.response) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    });
});
