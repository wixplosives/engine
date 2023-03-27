import { parentPort } from 'node:worker_threads';
import { COM, Communication } from '@wixc3/engine-core';
import { WorkerThreadHost } from '@wixc3/engine-core-node';
import { runNodeEnvironment } from '@wixc3/engine-runtime-node';
import { importModules } from './import-modules';
import { isWorkerThreadEnvStartupMessage } from './types';

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

        const parentHost = new WorkerThreadHost(parentPort);
        const communication = new Communication(parentHost, parentEnvName);

        const workerHost = parentHost.open();
        communication.registerEnv(environmentName, workerHost);

        config.push(
            COM.use({
                config: {
                    connectedEnvironments: {
                        [parentEnvName]: {
                            id: parentEnvName,
                            host: parentHost,
                        },
                    },
                },
            })
        );

        await runNodeEnvironment({
            env,
            featureName,
            features,
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
