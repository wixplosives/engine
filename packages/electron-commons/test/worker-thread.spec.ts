import fs from '@file-services/node';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import workerThreadFeature, { serverEnv } from '@fixture/worker-thread/dist/worker-thread.feature';

import { setupRunningNodeEnv } from '../test-kit/setup-running-node-env';

chai.use(chaiAsPromised);

const featurePath = fs.dirname(require.resolve('@fixture/worker-thread/package.json'));

const setupRunningEnv = () =>
    setupRunningNodeEnv({
        featurePath,
        featureId: workerThreadFeature.id,
        env: serverEnv,
    });

describe('workerthread environment', () => {
    it('initializes and exposes API', async () => {
        const { exitPromise } = await setupRunningEnv();

        const exitResult = await exitPromise;

        expect(exitResult.exitCode).to.eql(0);
    });
});
