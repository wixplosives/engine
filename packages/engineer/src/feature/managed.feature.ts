import { EngineFeature } from '@wixc3/engine-core';
import devServer from './dev-server.feature';
export default class ManagedFeature extends EngineFeature<'managedFeature'> {
    id = 'managedFeature' as const;
    api = {};
    dependencies = [devServer];
}
