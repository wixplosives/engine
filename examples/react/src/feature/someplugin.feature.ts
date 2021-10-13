import { Feature } from '@wixc3/engine-core';
import guiFeature from './gui.feature';

export default new Feature({
    id: 'plugin',
    api: {},
    dependencies: [guiFeature],
});
