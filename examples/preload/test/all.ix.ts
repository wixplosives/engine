import { expect } from 'chai';
import { dirname } from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('All Environment', () => {
    const projectPath = dirname(require.resolve('../package.json'));
    const featureName = 'preload/all';
    const disposables = createDisposables();
    afterEach(disposables.dispose;

    it('loads preload files in all environments, non-contextual', async () => {
        const { browserProvider, featureUrl, dispose } = await startServerNewProcess({
            projectPath,
            featureName,
        });
        disposables.add(async () => {
            await browserProvider.disposePages();
            await browserProvider.dispose();
            await dispose();
        });

        const page = await browserProvider.loadPage(featureUrl);
        disposables.add(async () => await page.close());

        const content = await page.$eval('#envMessages', (e) => e.textContent!);
        const parsedContent = JSON.parse(content) as { window: string[]; node: string[]; worker: string[] };

        expect(parsedContent.window).to.eql(['main', 'preload', 'feature', 'enveval']);
        expect(parsedContent.node).to.eql(['node', 'preload', 'feature', 'enveval']);
        expect(parsedContent.worker).to.eql(['worker', 'preload', 'feature', 'enveval']);
    });
});
