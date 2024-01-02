import { Communication } from '@wixc3/engine-core';
import { metadataApiToken, type MetadataCollectionAPI } from '../types.js';
import { ENGINE_ROOT_ENVIRONMENT_ID } from './constants.js';

export function getMetaData(com: Communication) {
    const api = com.apiProxy<MetadataCollectionAPI>(
        {
            id: ENGINE_ROOT_ENVIRONMENT_ID,
        },
        metadataApiToken,
    );

    return api.getRuntimeArguments();
}
