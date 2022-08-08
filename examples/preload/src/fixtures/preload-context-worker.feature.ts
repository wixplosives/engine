import { Feature } from '@wixc3/engine-core';
import contextualFeature, { procEnv } from '../feature/preload-context.feature';

export default new Feature({
    id: 'preloadContextWorker',
    dependencies: [contextualFeature.asEntity],
    api: {},
});

export const Context = procEnv.useContext('workerCtx');
