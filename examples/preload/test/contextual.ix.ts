import { expect } from 'chai';
import { dirname } from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('Contextual preload', () => {
    const projectPath = dirname(require.resolve('../package.json'));
    const disposables = createDisposables();
    afterEach(disposables.dispose);

    describe('node context', () => {
        // Preload declares 2 messages, nodeCtx declares 1, procEnv declares 1
        const featureName = 'preload/preload-context';

        it('Runs only the node context preload, and runs it first, in dev mode', async () => {
            const { dispose, featureUrl, browserProvider } = await startServerNewProcess({
                projectPath,
                featureName,
            });
            disposables.add(browserProvider.dispose);
            disposables.add(dispose);
            const page = await browserProvider.loadPage(featureUrl);

            await page.waitForSelector('#envMessages');
            const content = await page.$eval('#envMessages', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc).to.eql(['nodeCtx', 'preload', 'nodeEnvCtxEval', 'procEnvEval']);
        });
    });

    describe('worker context', () => {
        // Preload declares 2 messages, workerCtx declares 1, procEnv declares 1
        const featureName = 'preload/preload-context-worker';

        it('Runs only the worker context preload, and runs it first, in dev mode', async () => {
            const { dispose, featureUrl, browserProvider } = await startServerNewProcess({
                projectPath,
                featureName,
            });
            disposables.add(browserProvider.dispose);
            disposables.add(dispose);
            const page = await browserProvider.loadPage(featureUrl);

            await page.waitForSelector('#envMessages');
            const content = await page.$eval('#envMessages', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc).to.eql(['workerCtx', 'preload', 'workerEnvCtxEval', 'procEnvEval']);
        });
    });
});
