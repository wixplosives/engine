import { expect } from 'chai';

import fs from '@file-services/node';

import { getRunningFeature } from '../src/run-environment';
import workerThreadFeature, { serverEnv } from '@fixture/worker-thread/dist/worker-thread.feature';
import { createDisposables } from '@wixc3/create-disposables';

const featurePath = fs.dirname(require.resolve('@fixture/worker-thread/package.json'));

describe('runs environment', () => {
    const disposables = createDisposables();
    afterEach(disposables.dispose);

    it('runs environment with workerthread support', async () => {
        const { dispose, runningApi } = await getRunningFeature({
            env: serverEnv,
            feature: workerThreadFeature,
            featureName: workerThreadFeature.id,
            basePath: featurePath,
        });
        disposables.add(dispose);

        const result = await runningApi.workerService.initAndCallWorkerEcho('hello');
        expect(result).to.equal('hello from worker');
    });
});
