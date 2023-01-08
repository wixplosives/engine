import { Environment, EngineFeature } from '@wixc3/engine-core';
import App, { client } from '../../feature/app.feature';
export const page2 = new Environment('page2', 'window', 'single', [client]);

export default class Engine_env_dependency_user extends EngineFeature<'engine-env-dependency-user'> {
    id = 'engine-env-dependency-user' as const;
    api = {};
    dependencies = [App];
}
