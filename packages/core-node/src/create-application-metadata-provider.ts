import { Communication, reportError } from '@wixc3/engine-core';
import { createDisposables } from '@wixc3/patterns';
import { MetadataCollectionAPI, metadataApiToken } from './types';
import { METADATA_PROVIDER_ENV_ID, ENGINE_ROOT_ENVIRONMENT_ID } from './constants';
import memoizeOne from 'memoize-one';

/**
 * creates a new instance of metadata provider that can get application metadata using `MetadataCollectionAPI` api
 * that should be registered for `ROOT_ENGINE_ENV_ID` environment
 * @param com The communication instance that have registered hosts for `ROOT_ENGINE_ENV_ID` and `METADATA_PROVIDER_ENV_ID`
 */
export function createMetadataProvider(com: Communication) {
    const metadataProviderCom = createMetadataProviderCommunication(com);
    const { metadata, disposeCommunication } = getMetadataFromCommunication(metadataProviderCom);

    return {
        getMetadata: () => metadata,
        dispose: disposeCommunication,
    };
}

// memoize function to call api only once
const getMetadataFromCommunication = memoizeOne((metadataProviderCom: Communication) => {
    const api = metadataProviderCom.apiProxy<MetadataCollectionAPI>(
        {
            id: ENGINE_ROOT_ENVIRONMENT_ID,
        },
        metadataApiToken
    );

    const metadata = api.getRuntimeArguments();

    // use disposables to ignore multiple dispose calls
    const disposables = createDisposables();
    disposables.add(() => metadataProviderCom.dispose());

    // dispose metadataProviderCom once metadata is obtained
    // it is done cause we don't need communication anymore once result memoized
    // this might help with issue when client did not call dispose when exiting
    // and this communication instance hangs process by being subscribed for events
    metadata.then(() => disposables.dispose()).catch(reportError);

    return {
        metadata,
        disposeCommunication: disposables.dispose,
    };
});

// memoize function to create single communication instance per env
const createMetadataProviderCommunication = memoizeOne((communication: Communication) => {
    const rootHost = communication.getEnvironmentHost(ENGINE_ROOT_ENVIRONMENT_ID);
    if (!rootHost) {
        throw new Error(
            `no host was initialized under the environment ${ENGINE_ROOT_ENVIRONMENT_ID}. Cannot get application metadata API`
        );
    }

    const metadataProviderHost = communication.getEnvironmentHost(METADATA_PROVIDER_ENV_ID);
    if (!metadataProviderHost) {
        throw new Error(
            `no host was initialized under the environment ${METADATA_PROVIDER_ENV_ID}. Cannot get application metadata API`
        );
    }

    const metadataProviderCom = new Communication(metadataProviderHost, METADATA_PROVIDER_ENV_ID);
    metadataProviderCom.registerEnv(ENGINE_ROOT_ENVIRONMENT_ID, rootHost);

    return metadataProviderCom;
});
