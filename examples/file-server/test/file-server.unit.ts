import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import fs from '@file-services/node';
import { createDisposables } from '@wixc3/engine-core';
import { getRunningFeature } from '@wixc3/engine-test-kit';

import Feature, { server } from '../feature/file-server.feature';
import OtherExampleFeature from '../fixtures/other-example.feature';

chai.use(chaiAsPromised);

describe('Processing env test', () => {
    const disposables = createDisposables();

    afterEach(disposables.dispose);

    it('reads directory', async () => {
        const {
            dispose,
            runningApi: { remoteFiles },
        } = await getRunningFeature({
            featureName: 'file-server',
            env: server,
            runtimeOptions: {
                projectPath: __dirname,
            },
            fs,
            feature: Feature,
        });
        disposables.add(() => dispose());
        const remoteFile = await remoteFiles.readFile(fs.basename(__filename));
        expect(remoteFile).to.eq(fs.readFileSync(__filename, 'utf8'));

        await dispose();
    });

    it('waits for feature to finish running', async () => {
        const { dispose, engine } = await getRunningFeature({
            featureName: `file-server/other-example`,
            env: server,
            runtimeOptions: {
                projectPath: __dirname,
            },
            fs,
            feature: OtherExampleFeature,
        });
        disposables.add(() => dispose());

        await expect(engine.allReady()).to.eventually.be.fulfilled;
    });
});
