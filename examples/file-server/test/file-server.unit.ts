import { waitFor, sleep } from 'promise-assist';
import { expect } from 'chai';

import fs from '@file-services/node';
import { createDisposables } from '@wixc3/engine-core';
import { getRunningFeature } from '@wixc3/engine-test-kit';

import Feature, { server } from '../feature/file-server.feature';
import OtherExampleFeature from '../fixtures/other-example.feature';

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
        const { dispose, finishedRunStage } = await getRunningFeature({
            featureName: `file-server/other-example`,
            env: server,
            runtimeOptions: {
                projectPath: __dirname,
            },
            fs,
            feature: OtherExampleFeature,
        });
        disposables.add(() => dispose());

        expect(finishedRunStage()).to.eq(false);

        /**
         * test feature sets timeout for 2 second. sleeping for a 1.5 seconds to validate that finishedRun is still false
         */
        await sleep(1_500);

        expect(finishedRunStage()).to.eq(false);

        await waitFor(() => expect(finishedRunStage()).to.eq(true));
    });
});
