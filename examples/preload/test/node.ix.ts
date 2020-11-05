import { expect } from 'chai';
import { withFeature } from '@wixc3/engine-test-kit';
import { Application } from '@wixc3/engine-scripts';
import path from 'path';
import { createDisposables } from '@wixc3/engine-core';

describe('Multi Environment', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'preload/node',
    });
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    it('loads preload files in all environments, non-contextual', async () => {
        const { page } = await getLoadedFeature();
        const content = await page.evaluate(() => document.body.textContent!.trim());
        console.log(content);
        const parsedContent = JSON.parse(content);

        expect(parsedContent.window[0]).to.eq('main');
        expect(parsedContent.window[1]).to.eq('preload');
        expect(parsedContent.window.length).to.eq(4);
        expect(parsedContent.node[0]).to.eq('node');
        expect(parsedContent.node[1]).to.eq('preload');
        // Feature is missing since we analyze features before run
        expect(parsedContent.node.length).to.eq(3);
        expect(parsedContent.worker[0]).to.eq('worker');
        expect(parsedContent.worker[1]).to.eq('preload');
        expect(parsedContent.worker.length).to.eq(4);
    });

    it('when building and running, loads files in all environments, non-contextual', async () => {
        const app = new Application({ basePath: path.join(__dirname, '..') });
        await app.build();
        disposables.add(async () => await app.clean());

        // Aggressivly cleaning up node cache since in real life this is meant to simulate 2 different processes
        // Maybe build in a different process just to keep everything clean?
        delete require.cache[path.join(__dirname, '../feature/node.feature.ts')];
        expect(globalThis.envMessages).to.be.undefined;
        const { close, nodeEnvironmentManager } = await app.run({ singleRun: true });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments({ featureName: 'preload/node' });
        expect(globalThis.envMessages[0]).to.eq('node');
        expect(globalThis.envMessages[1]).to.eq('preload');
    });
});
