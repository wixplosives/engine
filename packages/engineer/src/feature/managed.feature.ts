import { Feature } from '@wixc3/engine-core';
import devServer from './dev-server.feature';

export default new Feature({
    id: 'managedFeature',
    dependencies: [devServer],
    api: {},
});
