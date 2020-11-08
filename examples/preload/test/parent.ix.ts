import path from 'path';
import { expect } from 'chai';
import { createDisposables } from '@wixc3/engine-core';
import { startServerNewProcess } from './utils';

describe('Parent feature', function () {
    const projectPath = path.join(__dirname, '..');
    const featureName = 'preload/parent';
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    it('When loading a feature that depends on a feature that has preload, the preloads are still loaded first', async () => {
        const { dispose, browserProvider, featureUrl } = await startServerNewProcess({
            projectPath,
            featureName,
        });
        disposables.add(async () => await dispose());
        disposables.add(async () => {
            await browserProvider.disposePages();
            await browserProvider.dispose();
        });

        const page = await browserProvider.loadPage(featureUrl);
        disposables.add(() => page.close());

        const content = await page.$eval('pre', (e) => e.textContent!);
        const parsedContent = JSON.parse(content) as { window: string[]; node: string[]; worker: string[] };

        expect(parsedContent.node[0]).to.eq('node');
        expect(parsedContent.node[1]).to.eq('preload');
        expect(parsedContent.node.includes('parentEnvEval')).to.be.true;
        expect(parsedContent.node.indexOf('preload')).to.be.lessThan(parsedContent.node.indexOf('parentEnvEval'));
    });
});
