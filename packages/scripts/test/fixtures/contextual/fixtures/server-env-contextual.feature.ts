import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { contextualEnv } from '../feature/contextual-with-worker-default.feature';

export default new Feature({
    id: 'serverMultiEnvFeature',
    api: {},
    dependencies: [MultiEnvFeature]
});

export const Context = contextualEnv.useContext('server');
