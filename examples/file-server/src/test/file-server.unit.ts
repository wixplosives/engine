import { getRunningFeature } from '@wixc3/engine-test-kit';
import { createDisposables } from '@wixc3/create-disposables';

import Feature, { server } from '../feature/file-server.feature';
import { expect } from 'chai';
import fs from '@file-services/node';

describe('file-server Processing env test', () => {
    const disposables = createDisposables();
    afterEach(disposables.dispose);
    it('reads directory', async () => {
        const {
            engine,
            runningApi: { remoteFiles },
        } = await getRunningFeature({
            featureName: 'file-server',
            env: server,
            runtimeOptions: {
                projectPath: __dirname,
            },
            feature: Feature,
        });
        disposables.add(engine.shutdown);

        const remoteFile = remoteFiles.readFile(fs.basename(__filename));
        expect(remoteFile).to.eq(fs.readFileSync(__filename, 'utf8'));
    });
});
