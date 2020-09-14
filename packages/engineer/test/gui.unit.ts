import { createDisposables, RuntimeFeature, BaseHost } from '@wixc3/engine-core/src';
import { createBrowserProvider } from '@wixc3/engine-test-kit/src';
import { runNodeEnvironment, loadFeaturesFromPackages, resolvePackages } from '@wixc3/engine-scripts/src';
import fs from '@file-services/node';
import devServerFeature, { devServerEnv } from '../feature/dev-server.feature';
import guiFeature from '../feature/gui.feature';
import { waitFor } from 'promise-assist';
import { expect } from 'chai';
import type { Page } from 'puppeteer';

function getBodyContent(page: Page) {
    return page.evaluate(() => document.body.textContent!.trim());
}

describe('engineer:gui', function () {
    this.timeout(15_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    const setup = async ({ featureName, basePath }: { featureName?: string; basePath: string }) => {
        const features = loadFeaturesFromPackages(resolvePackages(__dirname + '../'), fs).features;
        const { dispose, engine } = await runNodeEnvironment({
            featureName: 'engineer/gui',
            features: [...features],
            name: devServerEnv.env,
            type: 'node',
            host: new BaseHost(),
            config: [
                devServerFeature.use({
                    devServerConfig: {
                        basePath,
                    },
                    engineerConfig: {
                        features,
                    },
                }),
            ],
        });

        const runtimeFeature = engine.features.get(guiFeature) as RuntimeFeature;
        const devServerRuntime = engine.features.get(devServerFeature) as RuntimeFeature;
        runtimeFeature.addOnDisposeHandler(async () => {
            await devServerRuntime.api.devServerActions.close();
        }, devServerEnv.env);

        await waitFor(
            () => {
                expect(devServerRuntime.api.application.isServerRunning()).to.eql(true);
            },
            {
                timeout: 5000,
            }
        );

        disposables.add(() => dispose());

        return {
            dispose,
            engine,
            runtimeFeature,
            config: { featureName, port: devServerRuntime.api.devServerConfig.httpServerPort },
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

        const page = await loadPage(`http://localhost:${port as string}/main-dashboard.html?feature=engineer/gui`);

        const text = await getBodyContent(page);

        expect(text).to.include('Feature');
        expect(text).to.include('Config');
    });
});
