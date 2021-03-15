import fs from '@file-services/node';
import { TopLevelConfig, createDisposables, IFeatureLoader } from '@wixc3/engine-core';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import chai, { expect } from 'chai';
import { waitFor } from 'promise-assist';
import type { Frame, Page } from 'playwright-core';
import { Application, IBuildManifest } from '@wixc3/engine-scripts';
import { join } from 'path';
import rimraf from 'rimraf';
import { mkdtempSync } from 'fs';
import os from 'os';
import chaiAsPromised from 'chai-as-promised';
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
    after(browserProvider.dispose);

    const loadPage = async (url: string) => {
        const page = await browserProvider.loadPage(url);
        disposables.add(() => page.close());
        return page;
    };

    const engineFeatureFixturePath = fs.join(__dirname, './fixtures/engine-feature');
    const baseWebApplicationFixturePath = fs.join(__dirname, './fixtures/base-web-application');
    const applicationExternalFixturePath = fs.join(__dirname, './fixtures/application-external');
    const nodeFeatureFixturePath = fs.join(__dirname, './fixtures/node-env');
    const contextualFeatureFixturePath = fs.join(__dirname, './fixtures/contextual');

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

            it('includes entrypoint locations when built externally', async () => {
                const app = new Application({ basePath: engineFeatureFixturePath });

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                await app.build({
                    featureName: 'engine-single/x',
                    external: true,
                });
                disposables.add(() => app.clean());
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;

                expect(manifest.entryPoints).to.not.eq(undefined);
                expect(Object.keys(manifest.entryPoints)).have.lengthOf(1);
                expect(manifest.entryPoints['main']).to.not.eq(undefined);
                expect(manifest.entryPoints['main']!['web']).to.eq('dist/main.web.js');
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
                expect(filePath).to.eq('../feature/x.feature');
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
                expect(filePath).to.eq('../lib/feature/x.feature');
            });

            it('maps to own feature request to package requests if output path outside package directory', async () => {
                const tempDirPath = fs.join(os.tmpdir(), mkdtempSync('some-test'));
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
                expect(filePath).to.eq('@fixture/engine-single-feature/feature/x.feature');
            });

            it('uses package requests when output path is outside package path', async () => {
                const tempDirPath = fs.join(os.tmpdir(), mkdtempSync('some-test'));
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
                expect(filePath).to.eq('@fixture/engine-single-feature/lib/feature/x.feature');
            });
        });

        describe('external mode', () => {
            it('allows building features in external mode', async () => {
                const app = new Application({ basePath: engineFeatureFixturePath });
                await app.build({ external: true, featureName: 'engine-single/x' });
                disposables.add(() => app.clean());
                expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
                const contents = fs.readdirSync(app.outputPath);
                expect(contents).to.include('main.web.js');
            });

            it('creates a node entry', async () => {
                const app = new Application({ basePath: nodeFeatureFixturePath });
                await app.build({ external: true, featureName: 'engine-node/x' });
                disposables.add(() => app.clean());

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;
                expect(manifest.entryPoints['server']).to.not.eq(undefined);
                const nodeEntryModule = (await import(
                    fs.join(nodeFeatureFixturePath, manifest.entryPoints['server']!['node']!)
                )) as Record<string, IFeatureLoader>;

                expect(nodeEntryModule['engine-node/x']).to.not.eq(undefined);
                const loadedModule = await nodeEntryModule['engine-node/x']?.load({});
                expect(loadedModule).to.not.eq({});
            });

            it('creates a node entry with re-mapped sources', async () => {
                const tempDirPath = fs.join(os.tmpdir(), mkdtempSync('some-test'));
                fs.copyDirectorySync(nodeFeatureFixturePath, tempDirPath);
                disposables.add(() => rimraf.sync(tempDirPath));
                fs.symlinkSync(
                    fs.join(__dirname, '../../../node_modules'),
                    fs.join(tempDirPath, 'node_modules'),
                    'junction'
                );
                fs.symlinkSync(
                    fs.join(__dirname, '../../../webpack.config.js'),
                    fs.join(tempDirPath, 'webpack.config.js'),
                    'file'
                );

                const app = new Application({ basePath: tempDirPath });
                await app.build({ external: true, featureName: 'engine-node/x', sourcesRoot: 'lib' });

                disposables.add(() => app.clean());

                const manifestFilePath = fs.join(app.outputPath, manifestFileName);
                const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')) as IBuildManifest;
                expect(manifest.entryPoints['server']).to.not.eq(undefined);
                const nodeEntryModule = (await import(
                    fs.join(tempDirPath, manifest.entryPoints['server']!['node']!)
                )) as Record<string, IFeatureLoader>;
                expect(nodeEntryModule['engine-node/x']).to.not.eq(undefined);

                await expect(nodeEntryModule['engine-node/x']?.load({})).to.eventually.be.rejectedWith();
                fs.copyDirectorySync(fs.join(tempDirPath, 'feature'), fs.join(tempDirPath, 'lib/feature'));
                await expect(nodeEntryModule['engine-node/x']?.load({})).to.eventually.not.be.rejectedWith();
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
                `http://localhost:${webWorkerAppPort}/main.html?feature=contextual/some-feature`
            );

            await waitFor(async () => {
                const textFromWebWorker = await getBodyContent(webWorkerAppPage);
                expect(textFromWebWorker).to.contain('worker');
            });

            const { close: closeServer, port: serverAppPort } = await app.run({
                featureName: 'contextual/server-env',
                publicConfigsRoute: 'configs',
            });
            disposables.add(closeServer);

            const serverAppPage = await loadPage(
                `http://localhost:${serverAppPort}/main.html?feature=contextual/server-env`
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

        it('loads external features', async () => {
            const externalFeatureName = 'application-external';
            const pluginsFolderPath = join(baseWebApplicationFixturePath, 'node_modules');
            const { name } = fs.readJsonFileSync(join(applicationExternalFixturePath, 'package.json')) as {
                name: string;
            };
            const externalFeatureApp = new Application({
                basePath: applicationExternalFixturePath,
            });
            const publicConfigsRoute = 'config';
            await externalFeatureApp.build({
                external: true,
                featureName: externalFeatureName,
            });

            fs.copyDirectorySync(applicationExternalFixturePath, join(pluginsFolderPath, name, 'dist'));
            fs.copyDirectorySync(join(applicationExternalFixturePath, 'dist'), join(pluginsFolderPath, name, 'dist'));
            disposables.add(() => externalFeatureApp.clean());
            disposables.add(() => rimraf.sync(pluginsFolderPath));

            const app = new Application({ basePath: baseWebApplicationFixturePath });
            await app.build({
                featureName: 'base-web-application',
                singleFeature: true,
                publicConfigsRoute: '/config',
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run({
                serveExternalFeaturesPath: true,
                externalFeatureDefinitions: [
                    {
                        packageName: name,
                    },
                ],
                autoLaunch: true,
                publicConfigsRoute,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(
                async () => {
                    const bodyContent = await getBodyContent(page);
                    expect(bodyContent, `external feature is not loaded in the browser`).include('from ext,external');
                },
                { timeout: 5_000 }
            );
            const button = await page.$('#server-slot');
            await waitFor(
                async () => {
                    await button?.click();
                    const elem = await page.$('#server-slot-value');
                    expect(await elem?.evaluate((e) => e.textContent)).to.eq('external');
                },
                { timeout: 5_000 }
            );
            const frames = page.frames();
            await waitFor(
                async () => {
                    for (const iframe of frames) {
                        const child = await iframe.$('#main-container');
                        if (!child) {
                            continue;
                        }
                        expect(await getBodyContent(iframe)).to.eq('hello external');
                    }
                },
                { timeout: 5_000 }
            );
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
