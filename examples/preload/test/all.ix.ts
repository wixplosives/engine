import { expect } from 'chai';
import { dirname } from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('All Environment', () => {
    const projectPath = dirname(require.resolve('../package.json'));
    const featureName = 'preload/all';
    const disposables = createDisposables();
    afterEach(disposables.dispose);

    it('loads preload files in all environments, non-contextual', async () => {
        const runtimeOptions = { a: 'b', c: true };
        const { browserProvider, featureUrl, dispose } = await startServerNewProcess({
            projectPath,
            featureName,
            runtimeOptions,
        });
        disposables.add(async () => {
            await browserProvider.disposePages();
            await browserProvider.dispose();
            await dispose();
        });

        const page = await browserProvider.loadPage(featureUrl);
        disposables.add(async () => await page.close());

        const envMessagesContent = await page.$eval('#envMessages', (e) => e.textContent!);
        const parsedContent = JSON.parse(envMessagesContent) as { window: string[]; node: string[]; worker: string[] };

        expect(parsedContent.node).to.eql(['node', 'preload', 'feature', 'enveval']);

        const runtimeOptionsContent = await page.$eval('#runtimeOptions', (e) => e.textContent!);
        const runtimeOptionsparsedContent = JSON.parse(runtimeOptionsContent) as {
            window: Record<string, string | boolean>;
            node: Record<string, string | boolean>;
            worker: Record<string, string | boolean>;
        };

        expect(runtimeOptionsparsedContent.node).to.eql(runtimeOptions);
        expect(runtimeOptionsparsedContent.window).to.eql(runtimeOptions);
        expect(runtimeOptionsparsedContent.worker).to.eql(runtimeOptions);
    });
});
