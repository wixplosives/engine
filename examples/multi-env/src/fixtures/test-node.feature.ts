import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { processingEnv } from '../feature/multi-env.feature';

export default class UseLocalServerExample extends Feature<'use-local-server-example'> {
    id = 'use-local-server-example' as const;
    api = {};
    dependencies = [MultiEnvFeature];
}
export const Context = processingEnv.useContext('node1');
