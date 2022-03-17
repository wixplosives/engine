import { BaseHost, Communication, EnvironmentInitializer, IActiveEnvironment } from '@wixc3/engine-com';
import { LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID } from '@wixc3/engine-core-node';
import {
    initializeNodeEnvironment,
    InitializeNodeEnvironmentOptions,
    metadataApiToken,
    MetadataCollectionAPI,
} from '@wixc3/engine-electron-commons';

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */

export const initializeNodeEnvironmentInNode: EnvironmentInitializer<
    Promise<IActiveEnvironment>,
    Omit<InitializeNodeEnvironmentOptions, 'getApplicationMetaData'>
> = async (options) => {
    const { id, dispose, onDisconnect } = await initializeNodeEnvironment({
        getApplicationMetaData: (com) => getApplicationMetaData(com),
        ...options,
    });
    process.on('exit', dispose);
    return { id, onDisconnect };
};

async function getApplicationMetaData(com: Communication) {
    const parentHost = com.getEnvironmentHost(LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID);
    if (!parentHost) {
        throw new Error(
            `no host was initialized under the environment ${LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID}. Cannot retrieve application metadata`
        );
    }

    if (!(parentHost as BaseHost).parent) {
        throw new Error(
            `the host provided for the ${LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID} environment must be a child of a host of an environment/communication which provides the meta data api`
        );
    }

    const communication = new Communication(new BaseHost(), com.getEnvironmentId());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    communication.registerEnv(LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID, (parentHost as BaseHost).parent!);
    communication.registerMessageHandler(parentHost);
    const apiProxy = communication.apiProxy<MetadataCollectionAPI>(
        {
            id: LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID,
        },
        metadataApiToken
    );
    return apiProxy.getRuntimeArguments();
}
