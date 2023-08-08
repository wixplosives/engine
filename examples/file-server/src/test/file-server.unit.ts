import fs from 'node:fs';
import path from 'node:path';
import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { server } from '../feature/file-server.feature.js';
import { expect } from 'chai';

describe('file-server Processing env test', () => {
    it('reads directory', async () => {
        const {
            runningApi: { remoteFiles },
        } = await getRunningFeature({
            featureName: 'file-server',
            env: server,
            runtimeOptions: {
                projectPath: __dirname,
            },
            feature: Feature,
        });

        const remoteFile = remoteFiles.readFile(path.basename(__filename));
        expect(remoteFile).to.eq(fs.readFileSync(__filename, 'utf8'));
    });
});
