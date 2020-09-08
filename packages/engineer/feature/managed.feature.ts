import { Feature } from '@wixc3/engine-core/src';
import buildFeature from './build.feature';

export default new Feature({
    id: 'managedFeature',
    dependencies: [buildFeature.asEntity],
    api: {},
});
