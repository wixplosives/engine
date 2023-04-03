import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import multiFeature, { serverEnv, workerEnv } from './multi-async-get.feature';

multiFeature.setup(serverEnv, ({ run, multiWorkerEcho }, { COM: { communication } }) => {
    run(async () => {
        const { id, dispose } = await workerThreadInitializer({
            communication,
            env: workerEnv,
        });

        const getWorker = async (instanceId: string) => {
            await Promise.resolve();
            return multiWorkerEcho.get({ id: instanceId });
        };

        const worker = await getWorker(id);
        await worker.ping();

        await dispose();
        process.exit(0);
    });
});
