import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { server } from '../feature/file-server.feature';
import { expect } from 'chai';
import fs from '@file-services/node';

describe('Processing env test', () => {
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

        const remoteFile = remoteFiles.readFile(fs.basename(__filename));
        expect(remoteFile).to.eq(fs.readFileSync(__filename, 'utf8'));

        await engine.shutdown();
    });
});
