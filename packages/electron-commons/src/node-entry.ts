import { BaseHost, COM, Communication } from '@wixc3/engine-core';
import {
    MetadataCollectionAPI,
    metadataApiToken,
    ENGINE_ROOT_ENVIRONMENT_ID,
    METADATA_PROVIDER_ENV_ID,
} from '@wixc3/engine-core-node';
import { importModules, runIPCEnvironment } from '@wixc3/engine-runtime-node';

import { isNodeEnvStartupMessage } from './types';

const onMessageListener = async (message: unknown) => {
    if (isNodeEnvStartupMessage(message)) {
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
        } = message.runOptions;
        if (requiredModules) {
            await importModules(basePath, requiredModules);
        }

        // if current node environment wishes to launch a new one, it needs to pass on the runtime arguments it received.
        // creating an access point at runtime application, so it could use the ENGINE_PARENT_ENV_ID to be able to retrieve all getRuntimeArguments values into the app while launching a new environment using the initializer provided from '@wixc3/engine-electron-node'
        const rootEngineEnvHost = new BaseHost();
        rootEngineEnvHost.name = ENGINE_ROOT_ENVIRONMENT_ID;
        const rootCom = new Communication(rootEngineEnvHost, ENGINE_ROOT_ENVIRONMENT_ID);
        rootCom.registerAPI<MetadataCollectionAPI>(metadataApiToken, {
            getRuntimeArguments: () => message.runOptions,
        });

        const metadataProviderHost = new BaseHost();
        metadataProviderHost.name = METADATA_PROVIDER_ENV_ID;
        rootCom.registerEnv('metadataRetriever', metadataProviderHost);

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

        await runIPCEnvironment({
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
    }
};

// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.once('message', onMessageListener);
