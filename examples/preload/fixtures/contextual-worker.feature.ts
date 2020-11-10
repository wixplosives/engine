import { Feature } from '@wixc3/engine-core';
import contextualFeature, { procEnv } from '../feature/contextual.feature';

export default new Feature({
    id: 'contextWorker',
    dependencies: [contextualFeature],
    api: {},
});

export const Context = procEnv.useContext('workerCtx');
