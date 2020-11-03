import { Feature } from '@wixc3/engine-core';
import parallelFeature from './parallel.feature';

console.log('deep dep feature file');

export default new Feature({
    id: 'deepdep',
    api: {},
    dependencies: [parallelFeature],
});
