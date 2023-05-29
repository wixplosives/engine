import { Feature } from '@wixc3/engine-core';
import contextualFeature, { procEnv } from '../feature/preload-context.feature';

export default class PreloadContextWorker extends Feature<'preloadContextWorker'> {
    id = 'preloadContextWorker' as const;
    api = {};
    dependencies = [contextualFeature];
}
export const Context = procEnv.useContext('workerCtx');
