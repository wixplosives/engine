import { Feature, Environment, ContextualEnvironment, Service, COM } from '@wixc3/engine-core';
import nonContextualFeature from './non-contextual.feature';

const nodeEnv = new Environment('nodeCtx', 'node', 'single');
const workerEnv = new Environment('workerCtx', 'webworker', 'single');
export const procEnv = new ContextualEnvironment('procEnv', 'single', [nodeEnv, workerEnv]);
export const mainEnv = new Environment('main', 'window', 'single');

export default new Feature({
    id: 'preloadcontext',
    api: {
        procEnvMessages: Service.withType<{ getProcEnvMessages: () => Array<string> }>()
            .defineEntity(procEnv)
            .allowRemoteAccess(),
    },
    dependencies: [COM.asDependency, nonContextualFeature.asDependency],
    context: {
        someCtx: procEnv.withContext<{}>(),
    },
});

export const Context = procEnv.useContext('nodeCtx');
