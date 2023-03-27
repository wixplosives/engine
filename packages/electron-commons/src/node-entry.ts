import { BaseHost, COM, Communication } from '@wixc3/engine-core';
import { LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID, metadataApiToken, MetadataCollectionAPI } from '@wixc3/engine-core-node';
import { runIPCEnvironment } from '@wixc3/engine-runtime-node';

import { importModules } from './import-modules';
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
        const parentHost = new BaseHost();
        const com = new Communication(parentHost, LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID);
        com.registerAPI<MetadataCollectionAPI>(metadataApiToken, {
            getRuntimeArguments: () => message.runOptions,
        });
        const comHost = parentHost.open();
        com.registerEnv(environmentName, comHost);

        config.push(
            COM.use({
                config: {
                    connectedEnvironments: {
                        [LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID]: {
                            id: LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID,
                            host: comHost,
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
