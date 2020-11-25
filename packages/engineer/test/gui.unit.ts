import { expect } from 'chai';
import fs from '@file-services/node';
import { createDisposables, RuntimeFeature } from '@wixc3/engine-core';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import { startDevServer } from '@wixc3/engineer';
import guiFeature from '@wixc3/engineer/gui-feature';

const engineFeatureFixturePath = fs.join(__dirname, './fixtures/engine-feature');

describe('engineer:gui', function () {
    this.timeout(15_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    const setup = async ({ featureName, basePath }: { featureName?: string; basePath: string }) => {
        const { dispose, engine, devServerFeature } = await startDevServer({
            engineerEntry: 'engineer/gui',
            targetApplicationPath: basePath,
        });

        const runtimeFeature = engine.features.get(guiFeature) as RuntimeFeature;

        const runningPort = await new Promise<number>((resolve) => {
            devServerFeature.serverListeningHandlerSlot.register(({ port }) => {
                resolve(port);
            });
        });

        disposables.add(dispose);

        return {
            dispose,
            engine,
            runtimeFeature,
            config: { featureName, port: runningPort },
        };
    };

    const loadPage = async (url: string) => {
        const page = await browserProvider.loadPage(url);
        disposables.add(() => page.close());
        return page;
    };

    afterEach(function () {
        this.timeout(30_000);
        return disposables.dispose();
    });
    after(browserProvider.dispose);

    it('should allow visit of dashboard gui', async () => {
        const {
            config: { port },
        } = await setup({ basePath: engineFeatureFixturePath });

        const page = await loadPage(`http://localhost:${port}/main-dashboard.html?feature=engineer/gui`);

        const text = await page.evaluate(() => document.body.textContent!.trim());

        expect(text).to.include('Feature');
        expect(text).to.include('Config');
    });
});
