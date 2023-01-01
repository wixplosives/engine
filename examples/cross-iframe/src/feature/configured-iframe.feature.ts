import { COM, Environment, Feature } from '@wixc3/engine-core';

import echoFeature from './echo.feature';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');

export default new Feature({
    id: 'managedCrossOriginIframeFeature',
    api: {},
    dependencies: [COM, echoFeature],
});
