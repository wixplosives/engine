import { Communication } from '@wixc3/engine-core';
import { createDisposables } from '@wixc3/patterns';
import { MetadataCollectionAPI, metadataApiToken } from '../types';
import { METADATA_PROVIDER_ENV_ID, ENGINE_ROOT_ENVIRONMENT_ID } from './constants';
import memoizeOne from 'memoize-one';

/**
 * creates a new instance of metadata provider that can get application metadata using `MetadataCollectionAPI` api
 * that should be registered for `ROOT_ENGINE_ENV_ID` environment
 * @param com The communication instance that have registered hosts for `ROOT_ENGINE_ENV_ID` and `METADATA_PROVIDER_ENV_ID`
 */
export function createMetadataProvider(com: Communication) {
    const { metadataPromise, disposeCommunication } = loadMetadata(com);
    return {
        getMetadata: () => metadataPromise,
        dispose: disposeCommunication,
    };
}

// memoize function to instantiate single communication instance and call api only once
const loadMetadata = memoizeOne((communication: Communication) => {
    const rootHost = communication.getEnvironmentHost(ENGINE_ROOT_ENVIRONMENT_ID);
    if (!rootHost) {
        throw new Error(
            `no host was initialized under the environment ${ENGINE_ROOT_ENVIRONMENT_ID}. Cannot get application metadata API`,
        );
    }

    const metadataProviderHost = communication.getEnvironmentHost(METADATA_PROVIDER_ENV_ID);
    if (!metadataProviderHost) {
        throw new Error(
            `no host was initialized under the environment ${METADATA_PROVIDER_ENV_ID}. Cannot get application metadata API`,
        );
    }

    const metadataProviderCom = new Communication(metadataProviderHost, METADATA_PROVIDER_ENV_ID);
    metadataProviderCom.registerEnv(ENGINE_ROOT_ENVIRONMENT_ID, rootHost);

    const api = metadataProviderCom.apiProxy<MetadataCollectionAPI>(
        {
            id: ENGINE_ROOT_ENVIRONMENT_ID,
        },
        metadataApiToken,
    );

    const metadataPromise = api.getRuntimeArguments();

    // use disposables to ignore multiple dispose calls
    const disposables = createDisposables();
    disposables.add(() => metadataProviderCom.dispose(), {
        name: 'metadataProvider metadataProviderCom',
    });

    return {
        metadataPromise,
        disposeCommunication: disposables.dispose,
    };
});
