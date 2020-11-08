import { expect } from 'chai';
import { withFeature } from '@wixc3/engine-test-kit';
import { Application } from '@wixc3/engine-scripts';
import path from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { spawnSync } from 'child_process';

describe('All Environment', () => {
    const featureName = 'preload/all';
    const { getLoadedFeature } = withFeature({
        featureName,
    });
    const disposables = createDisposables();
    afterEach(async () => await disposables.dispose());

    it('loads preload files in all environments, non-contextual', async () => {
        const { page } = await getLoadedFeature();
        const content = await page.$eval('pre', (e) => e.textContent!);
        const parsedContent = JSON.parse(content) as { window: string[]; node: string[]; worker: string[] };

        expect(parsedContent.window[0]).to.eq('main');
        expect(parsedContent.window[1]).to.eq('preload');
        expect(parsedContent.window.length).to.eq(4);
        expect(parsedContent.node[0]).to.eq('node');
        expect(parsedContent.node[1]).to.eq('preload');
        // Feature is missing since we analyze features before run on processing
        expect(parsedContent.node.length).to.eq(3);
        expect(parsedContent.worker[0]).to.eq('worker');
        expect(parsedContent.worker[1]).to.eq('preload');
        expect(parsedContent.worker.length).to.eq(4);
    });

    it('when building and running, loads files in all environments, non-contextual', async () => {
        const projectBasePath = path.join(__dirname, '..');
        // Using spawn and not app.build because it better simulates building on a different process
        spawnSync('yarn', ['engineer', 'build', '-f', featureName, '--singleFeature'], {
            cwd: projectBasePath,
        });

        const app = new Application({ basePath: projectBasePath });
        disposables.add(() => app.clean());

        expect(globalThis.envMessages).to.be.undefined;
        const { close } = await app.run({ singleRun: true });
        disposables.add(close);

        expect(globalThis.envMessages[0]).to.eq('node');
        expect(globalThis.envMessages[1]).to.eq('preload');
        expect(globalThis.envMessages.length).to.eq(4);
    });
});
