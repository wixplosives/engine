import { Feature } from '@wixc3/engine-core';
import Preview from '../preview/preview.feature';

export default new Feature({
    id: 'endWith',
    dependencies: [Preview],
    api: {}
});
