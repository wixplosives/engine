import { Feature } from '@wixc3/engine-core';
import ElectronApp from '../feature/electron-app.feature';

/**
 * exporting the feature name
 */
export const EXAMPLE_FEATURE_NAME = 'file-server-sample-feature';

export default new Feature({
    id: EXAMPLE_FEATURE_NAME,
    api: {},
    dependencies: [ElectronApp.asEntity],
});
