import { Feature } from '@wixc3/engine-core';
import contextualFeature, { procEnv } from '../feature/preload-context.feature';

export default new Feature({
    id: 'preloadContextWorker',
    dependencies: [contextualFeature],
    api: {},
});

export const Context = procEnv.useContext('workerCtx');
