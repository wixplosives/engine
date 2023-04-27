import { BaseHost, COM, Communication, reportError } from '@wixc3/engine-core';
import {
    ENGINE_ROOT_ENVIRONMENT_ID,
    METADATA_PROVIDER_ENV_ID,
    MetadataCollectionAPI,
    metadataApiToken,
} from '@wixc3/engine-core-node';
import { emitEvent, importModules, runIPCEnvironment } from '@wixc3/engine-runtime-node';

import { toError } from '@wixc3/common';
import { NodeEnvironmentCommand, NodeEnvironmentEvent, NodeEnvironmentStartupCommand } from './types';

let disposeEnv: (() => Promise<void>) | undefined;

async function handleStartupCommand(command: NodeEnvironmentStartupCommand) {
    const {
        requiredModules,
        basePath,
        environmentName,
        config,
        environmentContextName,
        featureName,
        features,
        bundlePath,
        runtimeOptions,
        parentEnvName,
        env,
    } = command.runOptions;

    if (requiredModules) {
        await importModules(basePath, requiredModules);
    }

    // if current node environment wishes to launch a new one, it needs to pass on the runtime arguments it received.
    // creating an access point at runtime application, so it could use the ENGINE_PARENT_ENV_ID to be able to retrieve all getRuntimeArguments values into the app while launching a new environment using the initializer provided from '@wixc3/engine-electron-node'
    const rootEngineEnvHost = new BaseHost();
    rootEngineEnvHost.name = ENGINE_ROOT_ENVIRONMENT_ID;
    const rootCom = new Communication(rootEngineEnvHost, ENGINE_ROOT_ENVIRONMENT_ID);
    rootCom.registerAPI<MetadataCollectionAPI>(metadataApiToken, {
        getRuntimeArguments: () => command.runOptions,
    });

    const metadataProviderHost = new BaseHost();
    metadataProviderHost.name = METADATA_PROVIDER_ENV_ID;
    rootCom.registerEnv(METADATA_PROVIDER_ENV_ID, metadataProviderHost);

    config.push(
        COM.use({
            config: {
                connectedEnvironments: {
                    [ENGINE_ROOT_ENVIRONMENT_ID]: {
                        id: ENGINE_ROOT_ENVIRONMENT_ID,
                        host: rootEngineEnvHost,
                    },
                    [METADATA_PROVIDER_ENV_ID]: {
                        id: METADATA_PROVIDER_ENV_ID,
                        host: metadataProviderHost,
                    },
                },
            },
        })
    );

    const { close } = await runIPCEnvironment({
        type: 'node',
        name: environmentName,
        bundlePath,
        childEnvName: environmentContextName,
        featureName,
        config,
        features,
        options: runtimeOptions,
        context: basePath,
        parentEnvName,
        env,
    });

    disposeEnv = close;
}

async function handleDisposeCommand() {
    await Promise.all([disposeEnv?.()]);
}

const messageHandler = (message: unknown) => {
    const command = message as NodeEnvironmentCommand;

    switch (command.id) {
        case 'nodeEnvironmentStartupCommand':
            handleStartupCommand(command).catch((e) => {
                emitEvent<NodeEnvironmentEvent>(process, {
                    id: 'nodeEnvironmentInitFailedEvent',
                    error: toError(e).message,
                });
            });
            break;

        case 'nodeEnvironmentDisposeCommand':
            handleDisposeCommand()
                .then(() => process.off('message', messageHandler))
                .then(() =>
                    emitEvent<NodeEnvironmentEvent>(process, {
                        id: 'nodeEnvironmentDisposedEvent',
                    })
                )
                .catch(reportError);
            break;
    }
};

// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.on('message', messageHandler);
