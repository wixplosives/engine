import { expect } from 'chai';
import { withFeature } from '@wixc3/engine-test-kit';
import { createDisposables } from '@wixc3/engine-core';

describe('Contextual preload', () => {
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    describe('node context', () => {
        // Preload declares 2 messages, nodeCtx declares 1, procEnv declares 1
        const featureName = 'preload/contextual';
        const { getLoadedFeature } = withFeature({
            featureName,
        });

        it('Runs only the node context preload, and runs it first, in dev mode', async () => {
            const { page } = await getLoadedFeature();
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
        const { getLoadedFeature } = withFeature({
            featureName,
        });

        it('Runs only the worker context preload, and runs it first, in dev mode', async () => {
            const { page } = await getLoadedFeature();
            const content = await page.$eval('pre', (e) => e.textContent!);
            const parsedContent = JSON.parse(content) as { proc: string[] };

            expect(parsedContent.proc[0]).to.eq('workerCtx');
            expect(parsedContent.proc[1]).to.eq('preload');
            expect(parsedContent.proc.length).to.eq(4);
        });
    });
});
