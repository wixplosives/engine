import allFeature, { mainEnv, nodeEnv, workerEnv } from './all.feature';
import { socketServerInitializer, workerInitializer } from '@wixc3/engine-core';
globalThis.envMessages.push('enveval');

const content = `
This example is meant to show how to use preload files.
In each environment we have an array that has the name of the env as the first element
and then each file pushes it self into a global array.
There are expected to be 4 elements in each element, except for node which has a small caveat.
In development mode we analyze files on the same process as the node enviroment, which is why feature is missing in node.
If building and then running this example, one can see it with 4 elements as exepcted;
`;

allFeature.setup(
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

            const pre = document.createElement('pre');

            pre.innerHTML = JSON.stringify(
                {
                    window: globalThis.envMessages,
                    node: nodeMessages,
                    worker: workerMessages,
                },
                null,
                2
            );

            const explanation = document.createElement('p');
            explanation.innerHTML = content;

            document.body.appendChild(explanation);
            document.body.appendChild(pre);
        });
    }
);
