import { COM, Config, Environment, Feature } from '@wixc3/engine-core';

import echoFeature from './echo.feature';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'single');

export default new Feature({
    id: 'managedCrossOriginIframeFeature',
    api: {
        config: new Config<{
            managed: boolean;
            message?: string;
            origin?: string;
        }>({
            managed: false,
        }),
    },
    dependencies: [COM.asEntity, echoFeature.asEntity],
});
