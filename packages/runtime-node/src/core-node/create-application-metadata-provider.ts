import { Communication } from '@wixc3/engine-core';
import { metadataApiToken, type MetadataCollectionAPI } from '../types.js';
import { ENGINE_ROOT_ENVIRONMENT_ID } from './constants.js';

export function createMetadataProvider(com: Communication) {
    const api = com.apiProxy<MetadataCollectionAPI>(
        {
            id: ENGINE_ROOT_ENVIRONMENT_ID,
        },
        metadataApiToken,
    );

    const metadataPromise = api.getRuntimeArguments();

    return {
        getMetadata: () => metadataPromise,
        dispose: () => {},
    };
}
