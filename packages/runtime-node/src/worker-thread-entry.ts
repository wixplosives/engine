import { COM } from '@wixc3/engine-core';
import { importModules, isWorkerThreadEnvStartupMessage, WorkerThreadHost } from '@wixc3/engine-core-node';
import { parentPort } from 'node:worker_threads';

import { runNodeEnvironment } from './node-environment';

const messageHandler = async (message: unknown) => {
    if (isWorkerThreadEnvStartupMessage(message)) {
        if (parentPort === null) {
            throw new Error('this file should be executed in `worker_thread` context');
        }

        const {
            requiredModules,
            basePath,
            environmentName,
            config,
            environmentContextName,
            featureName,
            features,
            parentEnvName,
            env,
        } = message.runOptions;
        if (requiredModules) {
            await importModules(basePath, requiredModules);
        }

        const host = new WorkerThreadHost(parentPort);

        config.push(
            COM.use({
                config: {
                    connectedEnvironments: {
                        [parentEnvName]: {
                            id: parentEnvName,
                            host,
                        },
                    },
                },
            })
        );

        await runNodeEnvironment({
            env,
            featureName,
            features,
            config,
            host,
            name: environmentName,
            type: 'workerthread',
            childEnvName: environmentContextName,
        });
    }
};

if (parentPort !== null) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    parentPort.once('message', messageHandler);
} else {
    throw new Error('this file should be executed in `worker_thread` context');
}
