import { COM, Environment, EngineFeature } from '@wixc3/engine-core';
import echoFeature from './echo.feature';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');

export default class ManagedCrossOriginIframeFeature extends EngineFeature<'managedCrossOriginIframeFeature'> {
    id = 'managedCrossOriginIframeFeature' as const;
    api = {};
    dependencies = [COM, echoFeature];
}
