globalThis.envMessages.push('enveval');
import nodeFeature, { mainEnv, nodeEnv, workerEnv } from './node.feature';
import { socketServerInitializer, workerInitializer } from '@wixc3/engine-core';

nodeFeature.setup(
    mainEnv,
    (
        { run, nodeEnvMessages: { getNodeEnvMessages }, workerEnvMessages: { getWorkerEnvMessages } },
        { COM: { startEnvironment } }
    ) => {
        run(async () => {
            await startEnvironment(nodeEnv, socketServerInitializer());
            await startEnvironment(workerEnv, workerInitializer());
            const nodeMessages = await getNodeEnvMessages();
            const workerMessages = await getWorkerEnvMessages();
            document.body.innerHTML = JSON.stringify({
                window: globalThis.envMessages,
                node: nodeMessages,
                worker: workerMessages,
            });
        });
    }
);
