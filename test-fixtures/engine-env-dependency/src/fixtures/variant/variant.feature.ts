import { Environment, Feature } from '@wixc3/engine-core';
import App, { client } from '../../feature/app.feature';
export const page2 = new Environment('page2', 'window', 'single', [client]);

export default class EngineEnvDependencyUser extends Feature<'engine-env-dependency-user'> {
    id = 'engine-env-dependency-user' as const;
    api = {};
    dependencies = [App];
}
