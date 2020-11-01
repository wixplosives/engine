import NodeFeature from '@fixture/engine-node/feature/x.feature';
import { Feature } from '@wixc3/engine-core';

export default new Feature({
    id: 'XTestExternalFeature',
    api: {},
    dependencies: [NodeFeature],
});
