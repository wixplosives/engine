import fs from 'node:fs';
import path from 'node:path';
import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { server } from '../feature/file-server.feature.js';
import { expect } from 'chai';
import { fileURLToPath } from 'node:url';

describe('file-server Processing env test', () => {
    const selfPath = fileURLToPath(import.meta.url);
    const projectPath = fileURLToPath(new URL('.', import.meta.url));

    it('reads directory', async () => {
        const {
            runningApi: { remoteFiles },
        } = await getRunningFeature({
            featureName: 'file-server',
            env: server,
            runtimeOptions: {
                projectPath,
            },
            feature: Feature,
        });

        const remoteFile = remoteFiles.readFile(path.basename(selfPath));
        expect(remoteFile).to.eq(fs.readFileSync(selfPath, 'utf8'));
    });
});
