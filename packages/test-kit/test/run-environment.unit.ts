import { expect } from 'chai';
import fs from '@file-services/node';
import { getRunningFeature } from '@wixc3/engine-test-kit';
import workerThreadFeature, { serverEnv } from '@fixture/worker-thread/dist/worker-thread.feature';

const featurePath = fs.dirname(require.resolve('@fixture/worker-thread/package.json'));

describe('runs environment', () => {
    it('runs environment with workerthread support', async () => {
        const { runningApi } = await getRunningFeature({
            env: serverEnv,
            feature: workerThreadFeature,
            featureName: workerThreadFeature.id,
            basePath: featurePath,
        });

        const result = await runningApi.workerService.initAndCallWorkerEcho('hello');
        expect(result).to.equal('hello from worker');
    });
});
