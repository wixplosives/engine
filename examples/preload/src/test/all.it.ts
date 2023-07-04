import { expect } from 'chai';
import { dirname } from 'path';
import { createDisposables } from '@wixc3/create-disposables';
import { startServerNewProcess } from './utils';
import type { Page } from 'playwright-core';

describe('All Environment', () => {
    const projectPath = dirname(require.resolve('@example/preload/package.json'));
    const featureName = 'preload/all';
    const disposables = createDisposables();
    const runtimeOptions = { a: 'b', c: true };
    let page: Page | undefined;
    beforeEach(async function () {
        this.timeout(20_000);
        const { browserProvider, featureUrl, dispose } = await startServerNewProcess({
            projectPath,
            featureName,
            runtimeOptions,
        });
        disposables.add(browserProvider);
        disposables.add(dispose);

        page = await browserProvider.loadPage(featureUrl);
        disposables.add(async () => {
            if (page) {
                await page.close();
                page = undefined;
            }
        });
    });
    afterEach(disposables.dispose);

    it('loads preload files in all environments, non-contextual', async () => {
        await page!.waitForSelector('#envMessages');
        const content = await page!.$eval('#envMessages', (e) => e.textContent!);
        const parsedContent = JSON.parse(content) as { window: string[]; node: string[]; webworker: string[] };

        expect(parsedContent.node).to.eql(['node', 'preload', 'preloadInit', 'feature', 'enveval']);

        const runtimeOptionsContent = await page!.$eval('#runtimeOptions', (e) => e.textContent!);
        const runtimeOptionsparsedContent = JSON.parse(runtimeOptionsContent) as {
            node: Record<string, string | boolean>;
        };

        expect(runtimeOptionsparsedContent.node).to.eql(runtimeOptions);
    });
});
