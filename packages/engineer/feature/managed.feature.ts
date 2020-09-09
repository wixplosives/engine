import { Feature } from '@wixc3/engine-core/src';
import devServer from './dev-server.feature';

export default new Feature({
    id: 'managedFeature',
    dependencies: [devServer.asEntity],
    api: {},
});
