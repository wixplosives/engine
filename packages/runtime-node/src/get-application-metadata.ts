import memoizeOne from 'memoize-one';

import { BaseHost, Communication } from '@wixc3/engine-core';
import { LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID } from '@wixc3/engine-core-node';

import { metadataApiToken, MetadataCollectionAPI } from './types';

export const getApplicationMetaData = memoizeOne((com: Communication) => {
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
});
