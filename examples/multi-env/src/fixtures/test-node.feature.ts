import { EngineFeature } from '@wixc3/engine-core';
import MultiEnvFeature, { processingEnv } from '../feature/multi-env.feature';

export default class Use_local_server_example extends EngineFeature<'use-local-server-example'> {
    id = 'use-local-server-example' as const;
    api = {};
    dependencies = [MultiEnvFeature];
}
export const Context = processingEnv.useContext('node1');
