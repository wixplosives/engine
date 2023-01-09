import { Feature } from '@wixc3/engine-core';
import MultiEnvFeature, { processingEnv } from '../feature/multi-env.feature';

export default class Use_worker_example extends Feature<'use-worker-example'> {
    id = 'use-worker-example' as const;
    api = {};
    dependencies = [MultiEnvFeature];
}
export const Context = processingEnv.useContext('worker1');
