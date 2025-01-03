import { COM, reportError, UniversalWorkerHost } from '@wixc3/engine-core';
import { worker } from '@wixc3/isomorphic-worker/worker-scope';
import { createDisposables } from '@wixc3/patterns';
import { importModules } from './import-modules.js';
import { runNodeEnvironment } from './node-environment.js';
import { type WorkerThreadCommand, type WorkerThreadEvent, type WorkerThreadStartupCommand } from './types.js';

const disposables = createDisposables('workerThreadEntry');

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

    const host = new UniversalWorkerHost(worker, (worker.workerData as { name: string }).name);

    config.push(
        COM.configure({
            config: {
                connectedEnvironments: {
                    [parentEnvName]: {
                        id: parentEnvName,
                        host,
                    },
                },
            },
        }),
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

    disposables.add({
        name: `workerThreadEntry engine shutdown ${engine.entityID}`,
        timeout: 10_000,
        dispose: () => {
            worker.removeEventListener('message', messageHandler);
            return engine.shutdown();
        },
    });
};

const messageHandler = (message: unknown) => {
    if (!message || typeof message !== 'object' || !('data' in message)) {
        return;
    }

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
