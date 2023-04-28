import fs from '@file-services/node';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { sleep } from 'promise-assist';

import workerThreadFeature, { serverEnv } from '@fixture/worker-thread/dist/worker-thread.feature';
import multiFeature from '@fixture/worker-thread/dist/multi.feature';
import emptyFeature from '@fixture/worker-thread/dist/empty.feature';

import { setupRunningNodeEnv } from '../test-kit/setup-running-node-env';

chai.use(chaiAsPromised);

const featurePath = fs.dirname(require.resolve('@fixture/worker-thread/package.json'));

const setupRunningEnv = (featureId: string) =>
    setupRunningNodeEnv({
        featurePath,
        featureId,
        env: serverEnv,
        stdio: 'pipe',
    });

describe('workerthread environment type', () => {
    it('initializes and exposes API', async () => {
        const { exitPromise } = await setupRunningEnv(workerThreadFeature.id);
        await expect(exitPromise).to.eventually.have.property('exitCode').eql(0);
    });

    it('initializes multi workerthread environment and exposes API', async () => {
        const { exitPromise } = await setupRunningEnv(`${workerThreadFeature.id}/${multiFeature.id}`);
        await expect(exitPromise).to.eventually.have.property('exitCode').eql(0);
    });

    it('correctly disposes worker_thread env', async () => {
        const { dispose } = await setupRunningEnv(`${workerThreadFeature.id}/${emptyFeature.id}`);

        // wait for worker thread being initialized inside feature
        await sleep(1000);

        await dispose();
    });
});
