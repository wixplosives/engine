import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { contextualEnv } from '../feature/some-feature.feature';

export default class ServerMultiEnvFeature extends Feature<'serverMultiEnvFeature'> {
    id = 'serverMultiEnvFeature' as const;
    api = {};
    dependencies = [MultiEnvFeature];
}

export const Context = contextualEnv.useContext('server');
