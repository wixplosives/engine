import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { contextualEnv } from '../feature/some-feature.feature';

export default new Feature({
    id: 'serverMultiEnvFeature',
    api: {},
    dependencies:[MultiEnvFeature.asEntity],
});

export const Context = contextualEnv.useContext('server');
