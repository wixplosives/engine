import fs from '@file-services/node';
import { TopLevelConfig, createDisposables } from '@wixc3/engine-core';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import type { Page } from 'puppeteer';
import { Application } from '../src/application';

function getBodyContent(page: Page) {
    return page.evaluate(() => document.body.textContent!.trim());
}

const getConfigFileContent = (textText: string) => `
import UseConfigs from './use-configs.feature';

export default [
    UseConfigs.use({
        config: {
            echoText: '${textText}'
        }
    })
];
`;

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
    const multiFeatureFixturePath = fs.join(__dirname, './fixtures/engine-multi-feature');
    const nodeFeatureFixturePath = fs.join(__dirname, './fixtures/node-env');
    const contextualFeatureFixturePath = fs.join(__dirname, './fixtures/contextual');
    const useConfigsFeaturePath = fs.join(__dirname, './fixtures/using-config');

    describe('build', () => {
        it(`supports building features with a single fixture`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build();
            disposables.add(() => app.clean());

            expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
        });
    });

    describe('start', () => {
        it(`serves and allows running a feature`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            const { close, port } = await app.start({ featureName: 'engine-single/x', singleRun: true });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await getBodyContent(page);

            expect(text).to.include('App is running');
        });

        it(`serves a fixture feature`, async () => {
            const app = new Application({ basePath: multiFeatureFixturePath });
            const { close, port } = await app.start({ singleRun: true });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html?feature=engine-multi/variant`);

            const { myConfig, mySlot } = await page.evaluate(() => ({
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!),
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
            }));

            expect(myConfig).to.eql({
                tags: [],
            });
            expect(mySlot).to.eql(['testing 1 2 3']);
        });

        it(`allows specfiying a config`, async () => {
            const app = new Application({ basePath: multiFeatureFixturePath });
            const { close, port } = await app.start({ singleRun: true });
            disposables.add(() => close());

            const page = await loadPage(
                `http://localhost:${port}/main.html?feature=engine-multi/variant&config=engine-multi/variant2`
            );

            const { myConfig, mySlot } = await page.evaluate(() => ({
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!),
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
            }));

            expect(myConfig).to.eql({
                tags: ['variant', '2'],
            });
            expect(mySlot).to.eql(['testing 1 2 3']);
        });

        it(`runs node environments`, async () => {
            const app = new Application({ basePath: nodeFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'engine-node/x',
                singleRun: true,
            });
            disposables.add(() => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('Hello');
            });
        });

        it('launches a feature with contextual environment with worker context', async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'contextual/some-feature',
                singleRun: true,
            });
            disposables.add(() => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('from worker');
            });
        });

        it('launches a feature with contextual environment with server context', async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'contextual/server-env',
                singleRun: true,
            });
            disposables.add(() => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('from server');
            });
        });

        it('hot reloads config files', async () => {
            const modifiedConfigValue = 'modified config';
            const originalConfigValue = 'original config';
            const configFilePathInRepo = fs.join(useConfigsFeaturePath, 'feature', 'example.config.ts');

            // creating config file
            await fs.promises.writeFile(configFilePathInRepo, getConfigFileContent(originalConfigValue));

            // after the test, delete the file
            const app = new Application({ basePath: useConfigsFeaturePath });
            const runningApp = await app.start({
                featureName: 'configs/use-configs',
                configName: 'configs/example',
                singleRun: true,
            });
            disposables.add(() => runningApp.close());
            disposables.add(() => fs.promises.unlink(configFilePathInRepo));

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            // validate original config file is used
            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal(originalConfigValue);
            });

            // modifying the config file
            await fs.promises.writeFile(configFilePathInRepo, getConfigFileContent(modifiedConfigValue));

            await waitFor(
                async () => {
                    // reload the page (to see if the config file was changed, without re-running the application)
                    await page.reload({
                        waitUntil: 'networkidle2',
                    });
                    expect(await getBodyContent(page)).to.equal(modifiedConfigValue);
                },
                { timeout: 10_000, delay: 500 }
            );
        });

        it('runs node environments with inspect mode', async function () {
            // these tests takes longer in CI
            this.timeout(25_000);
            const app = new Application({ basePath: nodeFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'engine-node/x',
                inspect: true,
                singleRun: true,
            });
            disposables.add(() => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('Hello');
            });
        });

        it('runs http server on different port', async () => {
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });

            const { port, close } = await app.start({
                featureName: 'engine-single/x',
                port: 8080,
                singleRun: true,
            });
            disposables.add(() => close());
            expect(port, 'application is not created on port 8080').to.eq(8080);
        });

        it('allows providing top level config', async () => {
            const overrideConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });

            const { close, port } = await app.start({
                featureName: 'engine-single/x',
                overrideConfig,
                singleRun: true,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                if (bodyContent) {
                    const [, bodyConfig] = bodyContent.split(': ');
                    if (bodyConfig) {
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim());
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });

        it('allows providing top level config through the override config', async () => {
            const mainConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });

            const { close, port } = await app.start({
                featureName: 'engine-single/x',
                singleRun: true,
                overrideConfig: () => mainConfig,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                if (bodyContent) {
                    const [, bodyConfig] = bodyContent.split(': ');
                    if (bodyConfig) {
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim());
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });

        it('allows providing top level config with default config', async () => {
            const overrideConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
            const app = new Application({
                basePath: engineFeatureFixturePath,
            });

            const { close, port } = await app.start({
                configName: 'engine-single/x',
                featureName: 'engine-single/x',
                overrideConfig,
                singleRun: true,
            });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);
            await waitFor(async () => {
                const bodyContent = await getBodyContent(page);
                if (bodyContent) {
                    const [, bodyConfig] = bodyContent.split(': ');
                    if (bodyConfig) {
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim());
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });

        it('runs 2 node features simultaniously', async () => {
            const app = new Application({
                basePath: nodeFeatureFixturePath,
            });

            const { runFeature, closeFeature, port, close } = await app.start({ singleRun: true });
            disposables.add(() => close());

            const configOne: TopLevelConfig = [
                [
                    'XTestFeature',
                    {
                        config: {
                            value: '1',
                        },
                    },
                ],
            ];

            const configTwo: TopLevelConfig = [
                [
                    'XTestFeature',
                    {
                        config: {
                            value: '2',
                        },
                    },
                ],
            ];

            const { configName: firstFeatureConfigName } = await runFeature({
                featureName: 'engine-node/x',
                overrideConfig: configOne,
            });
            const { configName: secondFeatureConfigName } = await runFeature({
                featureName: 'engine-node/x',
                overrideConfig: configTwo,
            });
            expect(firstFeatureConfigName).to.not.equal(undefined);
            expect(secondFeatureConfigName).to.not.equal(undefined);
            disposables.add(() => closeFeature({ featureName: 'engine-node/x', configName: firstFeatureConfigName! }));
            disposables.add(() => closeFeature({ featureName: 'engine-node/x', configName: secondFeatureConfigName! }));

            const pageOne = await loadPage(
                `http://localhost:${port}/main.html?feature=engine-node/x&config=${firstFeatureConfigName!}`
            );

            const pageTwo = await loadPage(
                `http://localhost:${port}/main.html?feature=engine-node/x&config=${secondFeatureConfigName!}`
            );

            await waitFor(async () => {
                expect(await getBodyContent(pageOne)).to.equal('1');
                expect(await getBodyContent(pageTwo)).to.equal('2');
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
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim());
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
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim());
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
                        const parsedBodyConfig = JSON.parse(bodyConfig.trim());
                        expect(parsedBodyConfig.value).to.eq(1);
                    }
                }
            });
        });
    });

    it('allows adding routes to the engine router', async () => {
        const app = new Application({
            basePath: engineFeatureFixturePath,
        });

        const { close, port, router } = await app.start({ singleRun: true });
        disposables.add(() => close());
        router.get('/test/me', (_req, res) => {
            res.send('OK');
        });
        const page = await loadPage(`http://localhost:${port}/test/me`);
        expect(await page.content()).to.include('OK');
    });
});
