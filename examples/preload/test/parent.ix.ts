import { expect } from 'chai';
import { withFeature } from '@wixc3/engine-test-kit';
import { createDisposables } from '@wixc3/engine-core';

describe('Parent feature', () => {
    const featureName = 'preload/parent';
    const { getLoadedFeature } = withFeature({
        featureName,
    });
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    it('When loading a feature that depends on a feature that has preload, the preloads are still loaded first', async () => {
        const { page } = await getLoadedFeature();
        const content = await page.$eval('pre', (e) => e.textContent!);
        const parsedContent = JSON.parse(content) as { window: string[]; node: string[]; worker: string[] };

        expect(parsedContent.node[0]).to.eq('node');
        expect(parsedContent.node[1]).to.eq('preload');
        expect(parsedContent.node.includes('parentEnvEval')).to.be.true;
        expect(parsedContent.node.indexOf('preload')).to.be.lessThan(parsedContent.node.indexOf('parentEnvEval'));
    });
});
