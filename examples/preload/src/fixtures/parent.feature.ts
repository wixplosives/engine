import { Feature } from '@wixc3/engine-core';
import allFeature from '../feature/all.feature';

export default new Feature({
    id: 'parent',
    dependencies: [allFeature],
    api: {},
});
