import allFeature, { mainEnv, nodeEnv, workerEnv } from './all.feature.js';
import { socketClientInitializer, webWorkerInitializer } from '@wixc3/engine-core';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'enveval'];

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
        {
            run,
            nodeEnvMessages: { getNodeEnvMessages, getNodeRuntimeOptions },
            workerEnvMessages: { getWorkerEnvMessages },
        },
        { COM: { communication } },
    ) => {
        run(async () => {
            await socketClientInitializer({ communication, env: nodeEnv });
            await webWorkerInitializer({ communication, env: workerEnv });
            const nodeMessages = await getNodeEnvMessages();
            const workerMessages = await getWorkerEnvMessages();

            const pre = document.createElement('pre');
            pre.setAttribute('id', 'envMessages');

            pre.innerHTML = JSON.stringify(
                {
                    window: globalThis.envMessages,
                    node: nodeMessages,
                    webworker: workerMessages,
                },
                null,
                2,
            );

            const runtimeOptionsPre = document.createElement('pre');
            runtimeOptionsPre.setAttribute('id', 'runtimeOptions');

            const nodeRuntimeOptions = await getNodeRuntimeOptions();
            runtimeOptionsPre.innerHTML = JSON.stringify(
                {
                    node: nodeRuntimeOptions,
                },
                null,
                2,
            );

            const explanation = document.createElement('p');
            explanation.innerHTML = content;

            document.body.appendChild(explanation);
            document.body.appendChild(pre);
            document.body.appendChild(runtimeOptionsPre);
        });
    },
);
