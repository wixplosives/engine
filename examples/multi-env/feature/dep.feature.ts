import { Feature } from '@wixc3/engine-core';
import deepDepFeature from './deep-dep.feature';

console.log('dep feature file');

export default new Feature({
    id: 'dep',
    api: {},
    dependencies: [deepDepFeature],
});
