import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { processingEnv } from '../feature/multi-env.feature';

export default new Feature({
    id: 'use-webworker-example',
    dependencies: [MultiEnvFeature.asDependency],
    api: {},
});

export const Context = processingEnv.useContext('webworker1');
