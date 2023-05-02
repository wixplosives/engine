import { parentPort, type MessagePort } from 'node:worker_threads';

import { COM, reportError } from '@wixc3/engine-core';

import { importModules } from './import-modules';
import { runNodeEnvironment } from './node-environment';
import { WorkerThreadHost } from './worker-thread-host';
import { WorkerThreadCommand, WorkerThreadEvent, WorkerThreadStartupCommand } from './types';

let disposeNodeEnv: () => Promise<void> | undefined;

const handleStartupMessage = async (command: WorkerThreadStartupCommand) => {
    ensureWorkerThreadContext(parentPort);

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
    } = command.runOptions;
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

    const runningNodeEnv = await runNodeEnvironment({
        env,
        featureName,
        features,
        config,
        host,
        name: environmentName,
        type: 'workerthread',
        childEnvName: environmentContextName,
    });

    disposeNodeEnv = () => {
        ensureWorkerThreadContext(parentPort);
        parentPort.off('message', messageHandler);
        return runningNodeEnv.dispose();
    };
};

const messageHandler = (message: unknown) => {
    const workerThreadCommand = message as WorkerThreadCommand;

    switch (workerThreadCommand.id) {
        case 'workerThreadStartupCommand':
            handleStartupMessage(workerThreadCommand).catch(reportError);
            break;

        case 'workerThreadDisposeCommand':
            Promise.all([disposeNodeEnv()])
                .then(() => {
                    ensureWorkerThreadContext(parentPort);
                    parentPort.postMessage({ id: 'workerThreadDisposedEvent' } as WorkerThreadEvent);
                })
                .catch(reportError);
            break;
    }
};

function ensureWorkerThreadContext(port: MessagePort | null): asserts port is MessagePort {
    if (port === null) {
        throw new Error('this file should be executed in `worker_thread` context');
    }
}

ensureWorkerThreadContext(parentPort);
parentPort.on('message', messageHandler);
