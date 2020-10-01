import { createDisposables, RuntimeFeature } from '@wixc3/engine-core';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import fs from '@file-services/node';
import guiFeature from '../feature/gui.feature';
import { expect } from 'chai';
import type { Page } from 'puppeteer';
import { startDevServer } from '../src';

function getBodyContent(page: Page) {
    return page.evaluate(() => document.body.textContent!.trim());
}

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

        const runningPort: number = await new Promise((resolve) => {
            devServerFeature.api.serverListeningHandlerSlot.register(({ port }: { port: number }) => {
                resolve(port);
            });
        });

        disposables.add(() => dispose());

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
    after(() => browserProvider.dispose());

    it('should allow visit of dashboard gui', async () => {
        const engineFeatureFixturePath = fs.join(__dirname, '../fixtures/engine-feature');
        const {
            config: { port },
        } = await setup({ basePath: engineFeatureFixturePath });

        const page = await loadPage(`http://localhost:${port}/main-dashboard.html?feature=engineer/gui`);

        const text = await getBodyContent(page);

        expect(text).to.include('Feature');
        expect(text).to.include('Config');
    });
});
