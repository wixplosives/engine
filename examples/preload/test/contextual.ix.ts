import { expect } from 'chai';
import path from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('Contextual preload', () => {
    const projectPath = path.join(__dirname, '..');
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

            const content = await page.$eval('pre', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc[0]).to.eq('nodeCtx');
            expect(parsedContent.proc[1]).to.eq('preload');
            expect(parsedContent.proc.length).to.eq(4);
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

            const content = await page.$eval('pre', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc[0]).to.eq('workerCtx');
            expect(parsedContent.proc[1]).to.eq('preload');
            expect(parsedContent.proc.length).to.eq(4);
        });
    });
});
