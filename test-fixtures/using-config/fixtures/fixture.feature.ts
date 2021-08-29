import { Feature } from '@wixc3/engine-core';
import UseConfigsFeature from '../feature/use-configs.feature';

export default new Feature({
    id: 'alternativeDisplay',
    dependencies: [UseConfigsFeature],
    api: {},
});
