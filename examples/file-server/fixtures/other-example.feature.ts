import { Feature } from '@wixc3/engine-core';
import FileServer from '../feature/file-server.feature';

export const OTHER_EXAMPLE_FEATURE_NAME = 'file-server-sample-feature-2';

export default new Feature({
    id: OTHER_EXAMPLE_FEATURE_NAME,
    api: {},
    dependencies: [FileServer],
});
