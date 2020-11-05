import { expect } from 'chai';
import type { Page } from 'puppeteer';
import { waitFor } from 'promise-assist';
import fs from '@file-services/node';

import { createBrowserProvider } from '@wixc3/engine-test-kit';
import { createDisposables, TopLevelConfig, RuntimeEngine } from '@wixc3/engine-core';
import { Application, IExternalFeatureDefinition, TopLevelConfigProvider } from '@wixc3/engine-scripts';
import { startDevServer } from '@wixc3/engineer';
import { join } from 'path';
import rimraf from 'rimraf';

const engineFeatureFixturePath = fs.join(__dirname, './fixtures/engine-feature');
const engineRuntimeFeatureFixturePath = fs.join(__dirname, './fixtures/engine-run-options');
const engineFeatureRoots = fs.join(__dirname, './fixtures/engine-feature-roots');
const multiFeatureFixturePath = fs.join(__dirname, './fixtures/engine-multi-feature');
const nodeFeatureFixturePath = fs.join(__dirname, './fixtures/node-env');
const contextualFeatureFixturePath = fs.join(__dirname, './fixtures/contextual');
const useConfigsFeaturePath = fs.join(__dirname, './fixtures/using-config');
const baseWebApplicationFixturePath = fs.join(__dirname, './fixtures/base-web-application');
const applicationExternalFixturePath = fs.join(__dirname, './fixtures/application-external');

function getBodyContent(page: Page) {
    return page.evaluate(() => document.body.textContent!.trim());
}

describe('engineer:dev-server', function () {
    this.timeout(15_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    const setup = async ({
        featureName,
        port = 3000,
        basePath,
        autoLaunch = true,
        configName,
        inspect = false,
        overrideConfig = [],
        outputPath,
        runtimeOptions = {},
        externalFeatureDefinitions,
        externalFeaturesPath,
        singleFeature,
        featureDiscoveryRoot,
    }: {
        featureName?: string;
        port?: number;
        basePath: string;
        autoLaunch?: boolean;
        configName?: string;
        inspect?: boolean;
        overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
        outputPath?: string;
        runtimeOptions?: Record<string, string | boolean>;
        externalFeatureDefinitions?: IExternalFeatureDefinition[];
        externalFeaturesPath?: string;
        singleFeature?: boolean;
        featureDiscoveryRoot?: string;
    }): Promise<{
        dispose: () => Promise<void>;
        engine: RuntimeEngine;
        runtimeFeature: typeof devServerFeature;
        config: { featureName: string | undefined; port: number };
    }> => {
        const { dispose, engine, devServerFeature } = await startDevServer({
            engineerEntry: 'engineer/dev-server',
            targetApplicationPath: basePath,
            httpServerPort: port,
            featureName,
            autoLaunch,
            configName,
            inspect,
            overrideConfig,
            outputPath,
            singleRun: true,
            runtimeOptions,
            externalFeatureDefinitions,
            externalFeaturesPath,
            singleFeature,
            featureDiscoveryRoot,
        });
        const runningPort = await new Promise<number>((resolve) => {
            devServerFeature.serverListeningHandlerSlot.register(({ port }) => resolve(port));
        });

        disposables.add(() => dispose());

        return { dispose, engine, runtimeFeature: devServerFeature, config: { featureName, port: runningPort } };
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

    it(`serves and allows running a feature`, async () => {
        const {
            config: { port },
        } = await setup({ featureName: 'engine-single/x', basePath: engineFeatureFixturePath });

        const page = await loadPage(`http://localhost:${port}/main.html`);

        const text = await getBodyContent(page);

        expect(text).to.include('App is running');
    });

    it('serves a root feature without featureDiscoveryRoot ', async () => {
        const {
            config: { port },
        } = await setup({ basePath: engineFeatureRoots });

        const page = await loadPage(`http://localhost:${port}/main.html?feature=engine-feature-roots/x`);

        const text = await getBodyContent(page);

        expect(text).to.include('Root Feature is running');
    });

    it('serves a build feature with featureDiscoveryRoot ', async () => {
        const {
            config: { port },
        } = await setup({ basePath: engineFeatureRoots, featureDiscoveryRoot: './build' });

        const page = await loadPage(`http://localhost:${port}/main.html?feature=engine-feature-roots/y`);

        const text = await getBodyContent(page);

        expect(text).to.include('Build Feature is running');
    });

    it('serves a fixture feature', async () => {
        const {
            config: { port },
        } = await setup({ basePath: multiFeatureFixturePath });

        const page = await loadPage(`http://localhost:${port}/main.html?feature=engine-multi/variant`);
        const { myConfig, mySlot } = await page.evaluate(() => ({
            mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!) as string[],
            myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!) as { tags: string[] },
        }));

        expect(myConfig).to.eql({
            tags: [],
        });
        expect(mySlot).to.eql(['testing 1 2 3']);
    });

    it(`runs node environments`, async () => {
        const {
            config: { port },
        } = await setup({ basePath: nodeFeatureFixturePath, featureName: 'engine-node/x' });

        const page = await loadPage(`http://localhost:${port}/main.html`);

        await waitFor(async () => {
            expect(await getBodyContent(page)).to.equal('Hello');
        });
    });

    it('launches a feature with contextual environment with worker context', async () => {
        const {
            config: { port },
        } = await setup({ basePath: contextualFeatureFixturePath, featureName: 'contextual/some-feature' });

        const page = await loadPage(`http://localhost:${port}/main.html`);

        await waitFor(async () => {
            expect(await getBodyContent(page)).to.equal('from worker');
        });
    });

    it(`allows specfiying a config`, async () => {
        const {
            config: { port },
        } = await setup({ basePath: multiFeatureFixturePath });

        const page = await loadPage(
            `http://localhost:${port}/main.html?feature=engine-multi/variant&config=engine-multi/variant2`
        );

        const { myConfig, mySlot } = await page.evaluate(() => ({
            mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!) as string[],
            myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!) as { tags: string[] },
        }));

        expect(myConfig).to.eql({
            tags: ['variant', '2'],
        });
        expect(mySlot).to.eql(['testing 1 2 3']);
    });

    it('launches a feature with contextual environment with server context', async () => {
        const {
            config: { port },
        } = await setup({
            basePath: contextualFeatureFixturePath,
            featureName: 'contextual/server-env',
        });

        const page = await loadPage(`http://localhost:${port}/main.html`);

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

        const {
            config: { port },
        } = await setup({
            basePath: useConfigsFeaturePath,
            featureName: 'configs/use-configs',
            configName: 'configs/example',
        });

        // after the test, delete the file
        disposables.add(() => fs.promises.unlink(configFilePathInRepo));

        const page = await loadPage(`http://localhost:${port}/main.html`);

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
        const {
            config: { port },
        } = await setup({ basePath: nodeFeatureFixturePath, featureName: 'engine-node/x', inspect: true });

        const page = await loadPage(`http://localhost:${port}/main.html`);

        await waitFor(async () => {
            expect(await getBodyContent(page)).to.equal('Hello');
        });
    });

    it('runs http server on different port', async () => {
        const expectedPort = 8080;
        const {
            config: { port },
        } = await setup({ basePath: engineFeatureFixturePath, featureName: 'engine-single/x', port: expectedPort });
        expect(port, `application is not created on port ${expectedPort}`).to.eq(expectedPort);

        const page = await loadPage(`http://localhost:${expectedPort}/main.html`);

        const text = await getBodyContent(page);

        expect(text).to.include('App is running');
    });

    it('allows providing top level config', async () => {
        const overrideConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
        const {
            config: { port },
        } = await setup({
            basePath: engineFeatureFixturePath,
            featureName: 'engine-single/x',
            overrideConfig,
        });

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

    it('allows providing top level config through the override config', async () => {
        const mainConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
        const {
            config: { port },
        } = await setup({
            basePath: engineFeatureFixturePath,
            featureName: 'engine-single/x',
            overrideConfig: () => mainConfig,
        });

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

    it('allows providing top level config with default config', async () => {
        const overrideConfig: TopLevelConfig = [['XTestFeature', { config: { value: 1 } }]];
        const {
            config: { port },
        } = await setup({
            basePath: engineFeatureFixturePath,
            featureName: 'engine-single/x',
            configName: 'engine-single/x',
            overrideConfig,
        });

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

    it('runs 2 node features simultaniously', async () => {
        const {
            config: { port },
            runtimeFeature: { application },
        } = await setup({ basePath: nodeFeatureFixturePath });

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

        const { configName: firstFeatureConfigName } = await application.runFeature({
            featureName: 'engine-node/x',
            overrideConfig: configOne,
        });
        const { configName: secondFeatureConfigName } = await application.runFeature({
            featureName: 'engine-node/x',
            overrideConfig: configTwo,
        });
        expect(firstFeatureConfigName).to.not.equal(undefined);
        expect(secondFeatureConfigName).to.not.equal(undefined);
        disposables.add(() =>
            application.closeFeature({ featureName: 'engine-node/x', configName: firstFeatureConfigName! })
        );
        disposables.add(() =>
            application.closeFeature({ featureName: 'engine-node/x', configName: secondFeatureConfigName! })
        );

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

    it('runs 2 apps simultaniously', async () => {
        const {
            config: { port: app1Port },
        } = await setup({ featureName: 'engine-single/x', basePath: engineFeatureFixturePath });

        const {
            config: { port: app2Port },
        } = await setup({ featureName: 'engine-single/x', basePath: engineFeatureFixturePath });

        const page1 = await loadPage(`http://localhost:${app1Port}/main.html`);
        const text1 = await getBodyContent(page1);
        expect(text1).to.include('App is running');

        const page2 = await loadPage(`http://localhost:${app2Port}/main.html`);
        const text2 = await getBodyContent(page2);
        expect(text2).to.include('App is running');
    });

    it('can run from arbitrary output dirs', async () => {
        const packageFile = fs.findClosestFileSync(__dirname, 'package.json') as string;
        const {
            config: { port },
        } = await setup({
            featureName: 'engine-single/x',
            basePath: engineFeatureFixturePath,
            outputPath: fs.dirname(packageFile),
        });

        const page = await loadPage(`http://localhost:${port}/main.html`);

        const text = await getBodyContent(page);

        expect(text).to.include('App is running');

        const someArbFileFromTheOutputPath = await loadPage(`http://localhost:${port}/package.json`);

        const responseText = JSON.stringify(JSON.parse(await getBodyContent(someArbFileFromTheOutputPath)));
        const fileContent = JSON.stringify(JSON.parse(fs.readFileSync(packageFile).toString().trim()));

        expect(responseText).to.eq(fileContent);
    });

    it('can run runtime configs', async () => {
        const {
            config: { port },
        } = await setup({
            featureName: 'engine-run-options/x',
            basePath: engineRuntimeFeatureFixturePath,
            runtimeOptions: { foo: 'bar' },
        });

        const page = await loadPage(`http://localhost:${port}/main.html`);

        const text = await getBodyContent(page);

        expect(text).to.include('{"foo":"bar"}');
    });

    it('loads external features in browser', async () => {
        const externalFeatureName = 'application-external';
        const pluginsFolderPath = join(baseWebApplicationFixturePath, 'node_modules');
        const { name } = fs.readJsonFileSync(join(applicationExternalFixturePath, 'package.json')) as {
            name: string;
        };
        const externalFeatureApp = new Application({
            basePath: applicationExternalFixturePath,
            outputPath: join(pluginsFolderPath, name, 'dist'),
        });
        await externalFeatureApp.build({
            external: true,
            featureName: externalFeatureName,
        });
        disposables.add(() => externalFeatureApp.clean());
        disposables.add(() => rimraf.sync(pluginsFolderPath));

        const {
            dispose,
            config: { port },
        } = await setup({
            basePath: baseWebApplicationFixturePath,
            featureName: 'base-web-application',
        });
        disposables.add(() => dispose());

        const page = await loadPage(`http://localhost:${port}/main.html`);
        await waitFor(async () => {
            const bodyContent = await getBodyContent(page);
            expect(bodyContent, `external feature is not loaded in the browser`).include('from ext,external');
        });
        const button = await page.$('#server-slot');
        await button?.click();
        await waitFor(async () => {
            const elem = await page.$('#server-slot-value');
            expect(await elem?.evaluate((e) => e.textContent)).to.eq('external');
        });
    });
});

function getConfigFileContent(textText: string) {
    return `
import UseConfigs from './use-configs.feature';

export default [
    UseConfigs.use({
        config: {
            echoText: '${textText}'
        }
    })
];
`;
}
