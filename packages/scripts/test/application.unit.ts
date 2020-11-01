import fs from '@file-services/node';
import { TopLevelConfig, createDisposables } from '@wixc3/engine-core';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import type { Page } from 'puppeteer';
import { Application } from '@wixc3/engine-scripts';
import { join } from 'path';
import rimraf from 'rimraf';

function getBodyContent(page: Page) {
    return page.evaluate(() => document.body.textContent!.trim());
}

describe('Application', function () {
    this.timeout(15_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    afterEach(function () {
        this.timeout(30_000);
        return disposables.dispose();
    });
    after(() => browserProvider.dispose());

    const loadPage = async (url: string) => {
        const page = await browserProvider.loadPage(url);
        disposables.add(() => page.close());
        return page;
    };

    const engineFeatureFixturePath = fs.join(__dirname, './fixtures/engine-feature');
    const engineMultiFeatureFixturePath = fs.join(__dirname, './fixtures/engine-multi-feature');
    const nodeFeatureFixturePath = fs.join(__dirname, './fixtures/node-env');
    const nodeExternalFeatureFixturePath = fs.join(__dirname, './fixtures/node-env-external');
    const contextualFeatureFixturePath = fs.join(__dirname, './fixtures/contextual');

    describe('build', () => {
        it(`supports building features with a single fixture`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build();
            disposables.add(() => app.clean());

            expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
        });
        it('allows building features in external mode', async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build({ external: true });
            disposables.add(() => app.clean());
            expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
            const contents = fs.readdirSync(app.outputPath);
            expect(contents).to.include('main.web.js');
            expect(contents).to.include('[feature]x.web.js');
        });
    });

    describe('run', function () {
        // bundling may take a few seconds on ci machines
        this.timeout(15_000);
        it(`launches a built application with web environment`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build({
                featureName: 'engine-single/x',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run();
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await getBodyContent(page);

            expect(text).to.include('App is running');
        });

        it(`launches a built application with node environment`, async () => {
            const app = new Application({ basePath: nodeFeatureFixturePath });
            await app.build({
                featureName: 'engine-node/x',
                publicConfigsRoute: 'configs',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                publicConfigsRoute: 'configs',
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await getBodyContent(page);

            expect(text).to.equal('Hello');
        });

        it('allows providing top level config through the override config on build', async () => {
            const mainConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });

            await app.build({
                featureName: 'engine-single/x',
                singleRun: true,
                overrideConfig: () => mainConfig,
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                featureName: 'engine-single/x',
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                if (bodyContent) {
                    const [, bodyConfig] = bodyContent.split(': ');
                    if (bodyConfig) {
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim()) as { value: number };
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });

        it(`launches a built application with a contextual environment`, async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            await app.build({
                publicConfigsRoute: 'configs',
            });
            const { close: webWorkerServer, port: webWorkerAppPort } = await app.run({
                featureName: 'contextual/some-feature',
                publicConfigsRoute: 'configs',
            });
            disposables.add(() => app.clean());
            disposables.add(() => webWorkerServer());

            const webWorkerAppPage = await loadPage(
                `http://localhost:${webWorkerAppPort}/main.html?feature=contextual/some-feature`
            );

            const textFromWebWorker = await getBodyContent(webWorkerAppPage);

            expect(textFromWebWorker).to.contain('worker');

            const { close: closeServer, port: serverAppPort } = await app.run({
                featureName: 'contextual/server-env',
                publicConfigsRoute: 'configs',
            });
            disposables.add(() => closeServer());

            const serverAppPage = await loadPage(
                `http://localhost:${serverAppPort}/main.html?feature=contextual/server-env`
            );

            const textFromServer = await getBodyContent(serverAppPage);

            expect(textFromServer).to.contain('server');
        });

        it('allows providing top level config', async () => {
            const overrideConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });
            await app.build();
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                featureName: 'engine-single/x',
                overrideConfig,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                if (bodyContent) {
                    const [, bodyConfig] = bodyContent.split(': ');
                    if (bodyConfig) {
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim()) as { value: number };
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });

        it('allows providing top level config and config name', async () => {
            const overrideConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });
            await app.build();
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                configName: 'engine-single/x',
                featureName: 'engine-single/x',
                overrideConfig,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                if (bodyContent) {
                    const [, bodyConfig] = bodyContent.split(': ');
                    if (bodyConfig) {
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim()) as { value: number };
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });

        it('loads external features in browser', async () => {
            const externalFeatureName = 'engine-multi/variant';
            const pluginsFolderPath = join(engineMultiFeatureFixturePath, 'node_modules');
            const { name } = fs.readJsonFileSync(join(engineMultiFeatureFixturePath, 'package.json')) as {
                name: string;
            };
            const externalFeatureApp = new Application({
                basePath: engineMultiFeatureFixturePath,
                outputPath: join(pluginsFolderPath, name, 'variant/dist'),
            });
            await externalFeatureApp.build({
                external: true,
                featureName: externalFeatureName,
            });
            disposables.add(() => externalFeatureApp.clean());
            disposables.add(() => rimraf.sync(pluginsFolderPath));

            const app = new Application({ basePath: engineMultiFeatureFixturePath });
            await app.build({ featureName: 'engine-multi/app', singleFeature: true });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                serveExternalFeaturesPath: true,
                externalFeaturesPath: pluginsFolderPath,
                externalFeatureDefinitions: [
                    {
                        featureName: externalFeatureName,
                        packageName: name,
                    },
                ],
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                expect(bodyContent).include('testing 1 2 3');
            });
        });

        it.only('loads external features in server', async () => {
            const externalFeatureName = 'node-env-external';
            const pluginsFolderPath = join(nodeFeatureFixturePath, 'node_modules');
            const { name } = fs.readJsonFileSync(join(nodeExternalFeatureFixturePath, 'package.json')) as {
                name: string;
            };
            const externalFeatureApp = new Application({
                basePath: nodeExternalFeatureFixturePath,
                outputPath: join(pluginsFolderPath, name, 'dist'),
            });
            await externalFeatureApp.build({
                external: true,
                featureName: externalFeatureName,
            });
            // disposables.add(() => externalFeatureApp.clean());
            // disposables.add(() => rimraf.sync(pluginsFolderPath));

            const app = new Application({ basePath: nodeFeatureFixturePath });
            await app.build({ featureName: 'engine-node/x', singleFeature: true });
            // disposables.add(() => app.clean());

            const { close, port } = await app.run({
                serveExternalFeaturesPath: true,
                externalFeaturesPath: pluginsFolderPath,
                externalFeatureDefinitions: [
                    {
                        featureName: externalFeatureName,
                        packageName: name,
                    },
                ],
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const buttonElement = await page.$('#button');
                await buttonElement?.click();
                const bodyContent = await getBodyContent(page);
                expect(bodyContent).include('value');
            });
        });
    });

    it('allows adding routes to the engine router', async () => {
        const app = new Application({
            basePath: engineFeatureFixturePath,
        });
        await app.build();
        disposables.add(() => app.clean());
        const { close, port, router } = await app.run({ singleRun: true });
        disposables.add(() => close());
        router.get('/test/me', (_req, res) => {
            res.send('OK');
        });
        const page = await loadPage(`http://localhost:${port}/test/me`);
        expect(await page.content()).to.include('OK');
    });
});
