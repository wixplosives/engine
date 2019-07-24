import { Feature } from '@wixc3/engine-core';
import DepFeature from '../feature/x.feature';

export default new Feature({
    id: 'XTestFeature',
    api: {},
    dependencies: [DepFeature],
    flags: {}
});
