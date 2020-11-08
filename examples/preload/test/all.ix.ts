import { expect } from 'chai';
import path from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('All Environment', () => {
    const projectBasePath = path.join(__dirname, '..');
    const featureName = 'preload/all';
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    it('loads preload files in all environments, non-contextual', async () => {
        const { browserProvider, featureUrl, dispose } = await startServerNewProcess({
            projectPath: projectBasePath,
            featureName,
        });
        disposables.add(async () => {
            await browserProvider.disposePages();
            await browserProvider.dispose();
            await dispose();
        });

        const page = await browserProvider.loadPage(featureUrl);
        disposables.add(async () => await page.close());

        const content = await page.$eval('pre', (e) => e.textContent!);
        const parsedContent = JSON.parse(content) as { window: string[]; node: string[]; worker: string[] };

        expect(parsedContent.window[0]).to.eq('main');
        expect(parsedContent.window[1]).to.eq('preload');
        expect(parsedContent.window.length).to.eq(4);
        expect(parsedContent.node[0]).to.eq('node');
        expect(parsedContent.node[1]).to.eq('preload');
        expect(parsedContent.node.length).to.eq(4);
        expect(parsedContent.worker[0]).to.eq('worker');
        expect(parsedContent.worker[1]).to.eq('preload');
        expect(parsedContent.worker.length).to.eq(4);
    });
});
