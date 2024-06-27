import { nodeFs as fs } from '@file-services/node';
import { createDisposables } from '@wixc3/create-disposables';
import type { EngineerMetadataConfig, TopLevelConfig } from '@wixc3/engine-core';
import { Application, type IBuildManifest } from '@wixc3/engine-scripts/dist/application/index.js';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import type { Frame, Page } from 'playwright-core';
import { waitFor } from 'promise-assist';

chai.use(chaiAsPromised);
function getBodyContent(page: Page | Frame) {
    return page.evaluate(() => (document.body.textContent || '').trim());
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

    const engineFeatureFixturePath = fs.dirname(require.resolve('@fixture/engine-single-feature/package.json'));
    const staticBaseWebApplicationFixturePath = fs.dirname(
        require.resolve('@fixture/static-base-web-application-feature/package.json'),
    );
    const withIframeFixturePath = fs.dirname(require.resolve('@fixture/with-iframe/package.json'));
    const nodeFeatureFixturePath = fs.dirname(require.resolve('@fixture/engine-node/package.json'));
    const contextualFeatureFixturePath = fs.dirname(require.resolve('@fixture/contextual-feature/package.json'));

    const engineRuntimeMetadataFixturePath = fs.dirname(
        require.resolve('@fixture/engine-runtime-metadata/package.json'),
    );

    describe('build', () => {
        const manifestFileName = 'manifest.json';

        it(`supports building features with a single fixture`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build();
            disposables.add(() => app.clean());

            expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
        });

        it(`allows building feature with given favicon`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build({ favicon: 'assets/favicon.ico' });
            disposables.add(() => app.clean());
            expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
            const contents = fs.readdirSync(app.outputPath);
            expect(contents).to.include('favicon.ico');
        });

        describe('manifest generation', () => {
            it('generates manifest', async () => {
                const app = new Application({ basePath: engineFeatureFixturePath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build();
                disposables.add(() => app.clean());

                expect(fs.fileExistsSync(manifestFilePath), 'manifest file exist').to.equal(true);

                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;
                expect(manifest.features).to.have.length.gt(0);
                expect(manifest.features[0]![0]).have.eq('engine-single/x');
            });

            it('includes provided feature name in manifest file', async () => {
                const app = new Application({ basePath: engineFeatureFixturePath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build({
                    featureName: 'engine-single/x',
                });
                disposables.add(() => app.clean());
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;

                expect(manifest.defaultFeatureName).to.eq('engine-single/x');
            });

            it('maps own feature requests to relative requests if output path inside package directory', async () => {
                const app = new Application({ basePath: engineFeatureFixturePath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build({
                    featureName: 'engine-single/x',
                });
                disposables.add(() => app.clean());
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;

                const featureDefinition = manifest.features.find(([featureName]) => featureName === 'engine-single/x');
                expect(featureDefinition).to.not.eq(undefined);
                const [, { filePath }] = featureDefinition!;
                expect(filePath).to.eq('../dist/feature/x.feature.js');
            });

            it('uses sourcesRoot when building to the output path which is inside package directory', async () => {
                const app = new Application({ basePath: engineFeatureFixturePath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build({
                    featureName: 'engine-single/x',
                    sourcesRoot: 'lib',
                });
                disposables.add(() => app.clean());
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;

                const featureDefinition = manifest.features.find(([featureName]) => featureName === 'engine-single/x');
                expect(featureDefinition).to.not.eq(undefined);
                const [, { filePath }] = featureDefinition!;
                expect(filePath).to.eq('../lib/dist/feature/x.feature.js');
            });

            it('maps to own feature request to package requests if output path outside package directory', async () => {
                const tempDirPath = mkdtempSync(fs.join(os.tmpdir(), 'some-test'));
                const app = new Application({ basePath: engineFeatureFixturePath, outputPath: tempDirPath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build({
                    featureName: 'engine-single/x',
                });
                disposables.add(() => app.clean());
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;

                const featureDefinition = manifest.features.find(([featureName]) => featureName === 'engine-single/x');
                expect(featureDefinition).to.not.eq(undefined);
                const [, { filePath }] = featureDefinition!;
                expect(filePath).to.eq('@fixture/engine-single-feature/dist/feature/x.feature.js');
            });

            it('uses package requests when output path is outside package path', async () => {
                const tempDirPath = mkdtempSync(fs.join(os.tmpdir(), 'some-test'));
                const app = new Application({ basePath: engineFeatureFixturePath, outputPath: tempDirPath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build({
                    featureName: 'engine-single/x',
                    sourcesRoot: 'lib',
                });
                disposables.add(() => app.clean());
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;

                const featureDefinition = manifest.features.find(([featureName]) => featureName === 'engine-single/x');
                expect(featureDefinition).to.not.eq(undefined);
                const [, { filePath }] = featureDefinition!;
                expect(filePath).to.eq('@fixture/engine-single-feature/lib/dist/feature/x.feature.js');
            });
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
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);

            await waitFor(async () => {
                const text = await getBodyContent(page);
                expect(text).to.include('App is running');
            });
        });
        it(`launches a built application with web environment and given favicon`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build({
                featureName: 'engine-single/x',
                favicon: 'assets/favicon.ico',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run();
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);
            const faviconHref = await page.$eval('head > link[rel="icon"]', (el) => el.getAttribute('href'));
            expect(faviconHref).to.equal('favicon.ico');
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
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);

            await waitFor(async () => {
                const text = await getBodyContent(page);
                expect(text).to.equal('Hello');
            });
        });

        it(`launches a built application with node environment which contains runtime metadata`, async () => {
            const app = new Application({ basePath: engineRuntimeMetadataFixturePath });
            await app.build({
                featureName: 'engine-runtime-metadata/x',
                publicConfigsRoute: 'configs',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                publicConfigsRoute: 'configs',
            });
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);

            await waitFor(async () => {
                const text = await getBodyContent(page);
                const metadata = JSON.parse(text) as EngineerMetadataConfig;

                expect(metadata).to.eql({ applicationPath: app.outputPath });
            });
        });

        it(`launches a built application with iframe environment`, async () => {
            const app = new Application({ basePath: withIframeFixturePath });
            await app.build({
                featureName: 'with-iframe/x',
                publicConfigsRoute: 'some-config-path',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                publicConfigsRoute: 'some-config-path',
            });
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);

            await waitFor(async () => {
                const text = await page.evaluate(() => {
                    return (
                        (document.getElementById('iframe') as HTMLIFrameElement).contentWindow?.document.body
                            .innerText || ''
                    ).trim();
                });
                expect(text).to.equal('echo');
            });
        });

        it('allows providing top level config through the override config on build', async () => {
            const mainConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });

            await app.build({
                featureName: 'engine-single/x',
                overrideConfig: () => mainConfig,
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                featureName: 'engine-single/x',
            });
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                const [, bodyConfig] = bodyContent.split(': ');
                const parsedBodyConfig = JSON.parse(bodyConfig!.trim()) as { value: number };
                expect(parsedBodyConfig.value).to.eq(1);
            });
        });

        it(`launches a built application with a contextual environment`, async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            await app.build({
                publicConfigsRoute: 'configs',
            });
            const { close, port: webWorkerAppPort } = await app.run({
                featureName: 'contextual/some-feature',
                publicConfigsRoute: 'configs',
            });
            disposables.add(() => app.clean());
            disposables.add(close);

            const webWorkerAppPage = await loadPage(
                `http://localhost:${webWorkerAppPort}/main.html?feature=contextual/some-feature`,
            );

            await waitFor(async () => {
                const textFromWebWorker = await getBodyContent(webWorkerAppPage);
                expect(textFromWebWorker).to.contain('webworker');
            });

            const { close: closeServer, port: serverAppPort } = await app.run({
                featureName: 'contextual/server-env',
                publicConfigsRoute: 'configs',
            });
            disposables.add(closeServer);

            const serverAppPage = await loadPage(
                `http://localhost:${serverAppPort}/main.html?feature=contextual/server-env`,
            );

            await waitFor(async () => {
                const textFromServer = await getBodyContent(serverAppPage);
                expect(textFromServer).to.contain('server');
            });
        });

        // was false positive due to if statements inside the waitFor causing noop
        it.skip('allows providing top level config', async () => {
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
            disposables.add(close);
            const page = await loadPage(`http://localhost:${port}/main.html`);

            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                const [, bodyConfig] = bodyContent.split(': ');
                expect(bodyConfig).to.not.equal(undefined);
                const parsedBodyConfig = JSON.parse(bodyConfig!.trim()) as { value: number };
                expect(parsedBodyConfig.value).to.eq(1);
            });
        });

        // was false positive due to if statements inside the waitFor causing noop
        it.skip('allows providing top level config and config name', async () => {
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
            disposables.add(close);

            const page = await loadPage(`http://localhost:${port}/main.html`);

            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                const [, bodyConfig] = bodyContent.split(': ');
                expect(bodyConfig).to.not.equal(undefined);
                const parsedBodyConfig = JSON.parse(bodyConfig!.trim()) as { value: number };
                expect(parsedBodyConfig.value).to.eq(1);
            });
        });

        it('loads config', async () => {
            const publicConfigsRoute = 'config';
            const app = new Application({ basePath: staticBaseWebApplicationFixturePath });
            await app.build({
                featureName: 'static-base-web-application/base-web-application',
                singleFeature: true,
                configName: 'static-base-web-application/base',
                publicConfigsRoute: '/config',
                staticBuild: true,
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                publicConfigsRoute,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const configurableElem = await page.waitForSelector('#configurable', { timeout: 5_000 });
            const text = await configurableElem?.innerText();
            expect(text).equal('a configured message');
        });

        it('overrides config', async () => {
            const app = new Application({ basePath: staticBaseWebApplicationFixturePath });
            await app.build({
                featureName: 'static-base-web-application/base-web-application',
                singleFeature: true,
                configName: 'static-base-web-application/base',
                staticBuild: true,
                configLoaderModuleName:
                    '@fixture/static-base-web-application-config-loader/dist/override-config-loader',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({});
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const configurableElem = await page.waitForSelector('#configurable', { timeout: 5_000 });
            const text = await configurableElem?.innerText();
            expect(text).equal('an overriden message');
        });
    });

    it('allows adding routes to the engine router', async () => {
        const app = new Application({
            basePath: engineFeatureFixturePath,
        });
        await app.build();
        disposables.add(() => app.clean());
        const { close, port, router } = await app.run();
        disposables.add(close);

        router.get('/test/me', (_req, res) => {
            res.send('OK');
        });

        const page = await loadPage(`http://localhost:${port}/test/me`);
        expect(await page.content()).to.include('OK');
    });
});
