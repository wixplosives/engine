import { Feature, Environment, ContextualEnvironment, Service, COM } from '@wixc3/engine-core';
import nonContextualFeature from './non-contextual.feature.js';

const nodeEnv = new Environment('nodeCtx', 'node', 'single');
const workerEnv = new Environment('workerCtx', 'webworker', 'single');
export const procEnv = new ContextualEnvironment('procEnv', 'single', [nodeEnv, workerEnv]);
export const mainEnv = new Environment('main', 'window', 'single');

export default class Preloadcontext extends Feature<'preloadcontext'> {
    id = 'preloadcontext' as const;
    api = {
        procEnvMessages: Service.withType<{
            getProcEnvMessages: () => Array<string>;
        }>()
            .defineEntity(procEnv)
            .allowRemoteAccess(),
    };
    dependencies = [COM, nonContextualFeature];
    context = {
        someCtx: procEnv.withContext<{}>(),
    };
}
export const Context = procEnv.useContext('nodeCtx');
