import { Feature } from '@wixc3/engine-core/src';
//import buildFeature from './feature/build.feature';
import guiFeature from './feature/gui.feature';

export default new Feature({
    id: 'engineer',
    dependencies: [guiFeature],
    api: {},
});
