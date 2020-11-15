import { expect } from 'chai';
import { dirname } from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('Contextual preload', () => {
    const projectPath = dirname(require.resolve('../package.json'));
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    describe('node context', () => {
        // Preload declares 2 messages, nodeCtx declares 1, procEnv declares 1
        const featureName = 'preload/contextual';

        it('Runs only the node context preload, and runs it first, in dev mode', async () => {
            const { dispose, featureUrl, browserProvider } = await startServerNewProcess({
                projectPath,
                featureName,
            });
            disposables.add(async () => await dispose());
            disposables.add(async () => {
                await browserProvider.disposePages();
                await browserProvider.dispose();
            });
            const page = await browserProvider.loadPage(featureUrl);
            disposables.add(async () => await page.close());

            await page.waitForSelector('#envMessages');
            const content = await page.$eval('#envMessages', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc).to.eql([
                'procEnvContextualNoContextPreload',
                'nodeCtx',
                'preload',
                'nodeEnvCtxEval',
                'procEnvEval',
            ]);
        });
    });
    describe('worker context', () => {
        // Preload declares 2 messages, workerCtx declares 1, procEnv declares 1
        const featureName = 'preload/contextual-worker';

        it('Runs only the worker context preload, and runs it first, in dev mode', async () => {
            const { dispose, featureUrl, browserProvider } = await startServerNewProcess({
                projectPath,
                featureName,
            });
            disposables.add(async () => await dispose());
            disposables.add(async () => {
                await browserProvider.disposePages();
                await browserProvider.dispose();
            });
            const page = await browserProvider.loadPage(featureUrl);
            disposables.add(async () => await page.close());

            await page.waitForSelector('#envMessages');
            const content = await page.$eval('#envMessages', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc).to.eql(['workerCtx', 'preload', 'workerEnvCtxEval', 'procEnvEval']);
        });
    });
});
