import { nodeFs as fs } from '@file-services/node';
import contextualMultiPreloadFeature, {
    contextualMultiServerEnv,
    type ContextualMultiPreloadWorkerService,
} from '@fixture/worker-thread/dist/contextual-multi-preload.feature.js';
import multiFeature, { multiServerEnv, type MultiWorkerService } from '@fixture/worker-thread/dist/multi.feature.js';
import workerThreadFeature, {
    serverEnv,
    type WorkerService,
} from '@fixture/worker-thread/dist/worker-thread.feature.js';
import { createTestDisposables } from '@wixc3/testing';
import { expect } from 'chai';
import { setupRunningNodeEnv } from '../test-kit/setup-running-node-env.js';

const featurePath = fs.dirname(require.resolve('@fixture/worker-thread/package.json'));

const setupRunningEnv = (featureId: string) =>
    setupRunningNodeEnv({
        featurePath,
        featureId,
        env: serverEnv,
        stdio: 'pipe',
    });
const timeout = 3000;

describe('workerthread environment type', () => {
    const disposables = createTestDisposables();
    it('initializes worker, calls API and disposes', async () => {
        const { dispose, communication } = await setupRunningEnv(workerThreadFeature.id);

        disposables.add({
            timeout,
            name: `worker thread ${workerThreadFeature.id}`,
            dispose,
        });

        const workerService = communication.apiProxy<WorkerService>(
            { id: serverEnv.env },
            { id: `${workerThreadFeature.id}.workerService` },
        );

        const response = await workerService.initAndCallWorkerEcho('hello');
        expect(response).to.eql('hello from worker');
    });

    it('initializes multiple workers, calls API and disposes', async () => {
        const { dispose, communication } = await setupRunningEnv(`${workerThreadFeature.id}/${multiFeature.id}`);
        disposables.add({
            timeout,
            name: `worker thread ${workerThreadFeature.id}/${multiFeature.id}`,
            dispose,
        });

        const multiWorkerService = communication.apiProxy<MultiWorkerService>(
            { id: multiServerEnv.env },
            { id: `${multiFeature.id}.multiWorkersService` },
        );

        const response = await multiWorkerService.initAndCallWorkersEcho(['hello1', 'hello2', 'hello3']);
        expect(response).to.eql(['hello1 from worker', 'hello2 from worker', 'hello3 from worker']);
    });

    it('executes preload for contextual multi env', async function () {
        const { dispose, communication } = await setupRunningEnv(
            `${workerThreadFeature.id}/${contextualMultiPreloadFeature.id}`,
        );
        disposables.add({
            timeout,
            name: `worker thread ${workerThreadFeature.id}/${contextualMultiPreloadFeature.id}`,
            dispose,
        });

        const contextualMultiPreloadWorkerService = communication.apiProxy<ContextualMultiPreloadWorkerService>(
            { id: contextualMultiServerEnv.env },
            { id: `${contextualMultiPreloadFeature.id}.contextualMultiPreloadWorkersService` },
        );

        const response = await contextualMultiPreloadWorkerService.echo(['hello1', 'hello2', 'hello3']);
        expect(response).to.eql([
            'hello1 from preloaded worker',
            'hello2 from preloaded worker',
            'hello3 from preloaded worker',
        ]);
    });
});
