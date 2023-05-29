import { worker } from '@wixc3/isomorphic-worker/worker-scope';

import { COM, reportError, UniversalWorkerHost } from '@wixc3/engine-core';

import { importModules } from './import-modules';
import { runNodeEnvironment } from './node-environment';
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
        runtimeOptions,
    } = command.runOptions;
    if (requiredModules) {
        await importModules(basePath, requiredModules);
    }

    const host = new UniversalWorkerHost(worker, worker.workerData.name);

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
        options: runtimeOptions,
    });

    disposables.add(() => {
        worker.removeEventListener('message', messageHandler);
        return engine.shutdown();
    });
};

const messageHandler = (message: any) => {
    const workerThreadCommand = message?.data as WorkerThreadCommand;

    switch (workerThreadCommand.id) {
        case 'workerThreadStartupCommand':
            handleStartupMessage(workerThreadCommand).catch(reportError);
            break;

        case 'workerThreadDisposeCommand':
            disposables
                .dispose()
                .then(() => {
                    worker.postMessage({ id: 'workerThreadDisposedEvent' } as WorkerThreadEvent);
                })
                .catch(reportError);
            break;
    }
};

worker.addEventListener('message', messageHandler);
