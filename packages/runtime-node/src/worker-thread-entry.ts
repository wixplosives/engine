import { COM, reportError } from '@wixc3/engine-core';
import { parentPort, type MessagePort } from 'node:worker_threads';
import { importModules } from './import-modules';

import { runNodeEnvironment } from './node-environment';
import { WorkerThreadHost } from './worker-thread-host';
import { WorkerThreadCommand, WorkerThreadEvent, WorkerThreadStartupCommand } from './types';
import { toError } from '@wixc3/common';

let disposeNodeEnv: () => Promise<void> | undefined;

const handleStartupMessage = async (command: WorkerThreadStartupCommand) => {
    ensureParentPort(parentPort);

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
                emitEvent({
                    id: 'workerThreadInitFailedEvent',
                    error: toError(e).message,
                });
            });
            break;

        case 'workerThreadDisposeCommand':
            Promise.all([disposeNodeEnv])
                .then(() => {
                    emitEvent({ id: 'workerThreadDisposedEvent' });
                })
                .catch(reportError);
            break;
    }
};

function ensureParentPort(port: MessagePort | null): asserts port is MessagePort {
    if (port === null) {
        throw new Error('this file should be executed in `worker_thread` context');
    }
}

function emitEvent(event: WorkerThreadEvent) {
    ensureParentPort(parentPort);
    parentPort.postMessage(event);
}

ensureParentPort(parentPort);
parentPort.on('message', messageHandler);
