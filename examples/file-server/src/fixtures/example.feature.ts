import { EngineFeature } from '@wixc3/engine-core';
import FileServer from '../feature/file-server.feature';

/**
 * exporting the feature name
 */
export const EXAMPLE_FEATURE_NAME = 'file-server-sample-feature' as const;

export default class FileServerSample extends EngineFeature<'file-server-sample-feature'> {
    id = EXAMPLE_FEATURE_NAME;
    api = {};
    dependencies = [FileServer];
}
