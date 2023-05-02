import { AsyncApi, Communication } from '@wixc3/engine-core';
import { IEngineRuntimeArguments, MetadataCollectionAPI, metadataApiToken } from './types';
import { METADATA_PROVIDER_ENV_ID, ENGINE_ROOT_ENVIRONMENT_ID } from './constants';

/**
 * gets application metadata using `MetadataCollectionAPI` that should be registered for `ROOT_ENGINE_ENV_ID` environment
 * @param com The communication instance that have registered hosts for `ROOT_ENGINE_ENV_ID` and `METADATA_PROVIDER_ENV_ID`
 */
export const getApplicationMetaData = async (com: Communication): Promise<IEngineRuntimeArguments> => {
    const api = getMetadataApi(com);
    const result = await api.getRuntimeArguments();

    return result;
};

let metadataApi: AsyncApi<MetadataCollectionAPI> | undefined;
function getMetadataApi(communication: Communication) {
    return (
        metadataApi ??
        (metadataApi = (function (): AsyncApi<MetadataCollectionAPI> {
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

            return metadataProviderCom.apiProxy<MetadataCollectionAPI>(
                {
                    id: ENGINE_ROOT_ENVIRONMENT_ID,
                },
                metadataApiToken
            );
        })())
    );
}
