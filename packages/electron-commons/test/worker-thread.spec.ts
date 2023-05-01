import fs from '@file-services/node';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import workerThreadFeature, { serverEnv, WorkerService } from '@fixture/worker-thread/dist/worker-thread.feature';
import multiFeature, { multiServerEnv, MultiWorkerService } from '@fixture/worker-thread/dist/multi.feature';

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
    it('initializes worker, calls API and disposes', async () => {
        const { dispose, communication } = await setupRunningEnv(workerThreadFeature.id);

        const workerService = communication.apiProxy<WorkerService>(
            { id: serverEnv.env },
            { id: `${workerThreadFeature.id}.workerService` }
        );

        const response = await workerService.initAndCallWorkerEcho('hello');
        expect(response).to.eql('hello from worker');

        await dispose();
    });

    it('initializes multiple workers, calls API and disposes', async () => {
        const { dispose, communication } = await setupRunningEnv(`${workerThreadFeature.id}/${multiFeature.id}`);

        const multiWorkerService = communication.apiProxy<MultiWorkerService>(
            { id: multiServerEnv.env },
            { id: `${multiFeature.id}.multiWorkersService` }
        );

        const response = await multiWorkerService.initAndCallWorkersEcho(['hello1', 'hello2', 'hello3']);
        expect(response).to.eql(['hello1 from worker', 'hello2 from worker', 'hello3 from worker']);

        await dispose();
    });
});
