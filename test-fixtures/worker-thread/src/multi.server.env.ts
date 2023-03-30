import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import multiFeature, { serverEnv, workerEnv } from './multi.feature';

const workersCount = 3;

multiFeature.setup(serverEnv, ({ run, multiWorkerEcho, workerResponseConfig }, { COM: { communication } }) => {
    run(async () => {
        const workerEnvs = await Promise.all(
            new Array(workersCount).fill(undefined).map(() =>
                workerThreadInitializer({
                    communication,
                    env: workerEnv,
                })
            )
        );

        let exitCode = 0;
        for (const workerEnv of workerEnvs) {
            const workerEchoService = multiWorkerEcho.get({ id: workerEnv.id });
            const response = await workerEchoService.ping();

            if (response !== workerResponseConfig.response) {
                exitCode = 1;
            }
        }

        for (const { dispose } of workerEnvs) {
            await dispose();
        }

        process.exit(exitCode);
    });
});
