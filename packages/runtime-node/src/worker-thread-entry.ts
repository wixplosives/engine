import { parentPort } from 'node:worker_threads';

import { COM, reportError } from '@wixc3/engine-core';

import { importModules } from './import-modules';
import { runNodeEnvironment } from './node-environment';
import { WorkerThreadHost } from './worker-thread-host';
import { WorkerThreadCommand, WorkerThreadEvent, WorkerThreadStartupCommand } from './types';
import { createDisposables } from '@wixc3/patterns';

const disposables = createDisposables();

const handleStartupMessage = async (command: WorkerThreadStartupCommand) => {
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

    const host = new WorkerThreadHost(parentPort!);

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

    const engine = await runNodeEnvironment({
        env,
        featureName,
        features,
        config,
        host,
        name: environmentName,
        type: 'workerthread',
        childEnvName: environmentContextName,
    });

    disposables.add(() => {
        parentPort!.off('message', messageHandler);
        return engine.shutdown();
    });
};

const messageHandler = (message: unknown) => {
    const workerThreadCommand = message as WorkerThreadCommand;

    switch (workerThreadCommand.id) {
        case 'workerThreadStartupCommand':
            handleStartupMessage(workerThreadCommand).catch(reportError);
            break;

        case 'workerThreadDisposeCommand':
            disposables
                .dispose()
                .then(() => {
                    parentPort!.postMessage({ id: 'workerThreadDisposedEvent' } as WorkerThreadEvent);
                })
                .catch(reportError);
            break;
    }
};

if (parentPort === null) {
    throw new Error('this file should be executed in `worker_thread` context');
}

parentPort.on('message', messageHandler);
