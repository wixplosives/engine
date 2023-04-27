import { parentPort, type MessagePort } from 'node:worker_threads';

import { COM, reportError } from '@wixc3/engine-core';
import { toError } from '@wixc3/common';

import { importModules } from './import-modules';
import { runNodeEnvironment } from './node-environment';
import { WorkerThreadHost } from './worker-thread-host';
import { WorkerThreadCommand, WorkerThreadEvent, WorkerThreadStartupCommand } from './types';
import { emitEvent } from './communication-helpers';

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

    disposeNodeEnv = runningNodeEnv.dispose;
};

const messageHandler = (message: unknown) => {
    const workerThreadCommand = message as WorkerThreadCommand;

    switch (workerThreadCommand.id) {
        case 'workerThreadStartupCommand':
            handleStartupMessage(workerThreadCommand).catch((e) => {
                ensureWorkerThreadContext(parentPort);
                emitEvent<WorkerThreadEvent>(parentPort, {
                    id: 'workerThreadInitFailedEvent',
                    error: toError(e).message,
                });
            });
            break;

        case 'workerThreadDisposeCommand':
            Promise.all([disposeNodeEnv])
                .then(() => {
                    ensureWorkerThreadContext(parentPort);
                    emitEvent<WorkerThreadEvent>(parentPort, { id: 'workerThreadDisposedEvent' });
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
