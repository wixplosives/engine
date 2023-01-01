import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { processingEnv } from '../feature/multi-env.feature';

export default new Feature({
    id: 'use-worker-example',
    dependencies: [MultiEnvFeature],
    api: {},
});

export const Context = processingEnv.useContext('worker1');
