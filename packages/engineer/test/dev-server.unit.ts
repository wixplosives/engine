import { createBrowserProvider } from '@wixc3/engine-test-kit';
import devServerFeature, { devServerEnv } from '../feature/dev-server.feature';
import fs from '@file-services/node';
import { createDisposables, BaseHost, RuntimeFeature, TopLevelConfig, RuntimeEngine } from '@wixc3/engine-core';
import type { Page } from 'puppeteer';
import { expect } from 'chai';
import {
    runNodeEnvironment,
    loadFeaturesFromPackages,
    resolvePackages,
    TopLevelConfigProvider,
} from '@wixc3/engine-scripts';

const engineFeatureFixturePath = fs.join(__dirname, '../fixtures/engine-feature');
const multiFeatureFixturePath = fs.join(__dirname, '../fixtures/engine-multi-feature');
const nodeFeatureFixturePath = fs.join(__dirname, '../fixtures/node-env');
const contextualFeatureFixturePath = fs.join(__dirname, '../fixtures/contextual');
const useConfigsFeaturePath = fs.join(__dirname, '../fixtures/using-config');
import { waitFor } from 'promise-assist';

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
    }: {
        featureName?: string;
        port?: number;
        basePath: string;
        autoLaunch?: boolean;
        configName?: string;
        inspect?: boolean;
        overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
        outputPath?: string;
    }): Promise<{
        dispose: () => Promise<void>;
        engine: RuntimeEngine;
        runtimeFeature: RuntimeFeature | undefined;
        config: { featureName: string | undefined; port: number };
    }> => {
        const { dispose, engine } = await runNodeEnvironment({
            featureName: 'engineer/dev-server',
            features: [...loadFeaturesFromPackages(resolvePackages('../'), fs).features],
            name: devServerEnv.env,
            type: 'node',
            host: new BaseHost(),
            config: [
                devServerFeature.use({
                    devServerConfig: {
                        basePath,
                        httpServerPort: port,
                        singleRun: true,
                        featureName,
                        autoLaunch,
                        configName,
                        inspect,
                        overrideConfig,
                        outputPath,
                    },
                }),
            ],
        });

        const runtimeFeature: RuntimeFeature | undefined = engine.features.get(devServerFeature);
        runtimeFeature?.addOnDisposeHandler(async () => {
            await runtimeFeature.api.devServerActions.close();
        }, devServerEnv.env);

        const runningPort: number = await new Promise((resolve) => {
            runtimeFeature!.api.serverListeningHandlerSlot.register(({ port }: { port: number }) => {
                resolve(port);
            });
        });

        disposables.add(() => dispose());

        return { dispose, engine, runtimeFeature, config: { featureName, port: runningPort } };
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

    it('serves a fixture feature', async () => {
        const {
            config: { port },
        } = await setup({ basePath: multiFeatureFixturePath });

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
            mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!),
            myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
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
                    const parsedBodyConfig = JSON.parse(bodyConfig.trim());
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
                    const parsedBodyConfig = JSON.parse(bodyConfig.trim());
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
                    const parsedBodyConfig = JSON.parse(bodyConfig.trim());
                    expect(parsedBodyConfig.value).to.eq(1);
                }
            }
        });
    });

    it('runs 2 node features simultaniously', async () => {
        const {
            config: { port },
            runtimeFeature,
        } = await setup({ basePath: nodeFeatureFixturePath });

        const application = runtimeFeature?.api.application;

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
            application.closeFeature({ featureName: 'engine-node/x', configName: firstFeatureConfigName })
        );
        disposables.add(() =>
            application.closeFeature({ featureName: 'engine-node/x', configName: secondFeatureConfigName })
        );

        const pageOne = await loadPage(
            `http://localhost:${port}/main.html?feature=engine-node/x&config=${firstFeatureConfigName as string}`
        );

        const pageTwo = await loadPage(
            `http://localhost:${port}/main.html?feature=engine-node/x&config=${secondFeatureConfigName as string}`
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

        const responseText = JSON.stringify(await getBodyContent(someArbFileFromTheOutputPath));
        const fileContent = JSON.stringify(fs.readFileSync(packageFile).toString().trim());

        expect(responseText).to.eq(fileContent);
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
