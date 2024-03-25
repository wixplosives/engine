import { Feature } from '@wixc3/engine-core';
import FileServer from '../feature/file-server.feature.js';

export default class FileServerSample extends Feature<'file-server-sample-feature'> {
    id = 'file-server-sample-feature' as const;
    api = {};
    dependencies = [FileServer];
}
