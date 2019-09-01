import fs from '@file-services/node';
import { createBrowserProvider, createDisposables } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { Page } from 'puppeteer';
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

describe('Application', function() {
    this.timeout(15_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    afterEach(function() {
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
            const { close, port } = await app.start({ featureName: 'engine-single/x' });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await getBodyContent(page);

            expect(text).to.equal('App is running.');
        });

        it(`serves a fixture feature`, async () => {
            const app = new Application({ basePath: multiFeatureFixturePath });
            const { close, port } = await app.start();
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html?feature=engine-multi/variant`);

            const { myConfig, mySlot } = await page.evaluate(() => ({
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!),
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!)
            }));

            expect(myConfig).to.eql({
                tags: []
            });
            expect(mySlot).to.eql(['testing 1 2 3']);
        });

        it(`allows specfiying a config`, async () => {
            const app = new Application({ basePath: multiFeatureFixturePath });
            const { close, port } = await app.start();
            disposables.add(() => close());

            const page = await loadPage(
                `http://localhost:${port}/main.html?feature=engine-multi/variant&config=engine-multi/variant2`
            );

            const { myConfig, mySlot } = await page.evaluate(() => ({
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!),
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!)
            }));

            expect(myConfig).to.eql({
                tags: ['variant', '2']
            });
            expect(mySlot).to.eql(['testing 1 2 3']);
        });

        it(`runs node environments`, async () => {
            const app = new Application({ basePath: nodeFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'engine-node/x'
            });
            disposables.add('closing app', () => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('Hello');
            });
        });

        it('launches a feature with contextual environment with worker context', async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'contextual/some-feature'
            });
            disposables.add('closing app', () => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('from worker');
            });
        });

        it('launches a feature with contextual environment with server context', async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'contextual/server-env'
            });
            disposables.add('closing app', () => runningApp.close());

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
            disposables.add(() => fs.promises.unlink(configFilePathInRepo));
            const app = new Application({ basePath: useConfigsFeaturePath });
            const runningApp = await app.start({
                featureName: 'configs/use-configs',
                configName: 'configs/example'
            });
            disposables.add(() => runningApp.close());
            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            // validate original config file is used
            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal(originalConfigValue);
            });

            // modifying the config file
            await fs.promises.writeFile(configFilePathInRepo, getConfigFileContent(modifiedConfigValue));

            // reload the page (to see if the config file was changed, without re-running the application)
            await page.reload({
                waitUntil: 'networkidle2'
            });

            // checking if config content is changed
            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal(modifiedConfigValue);
            });
        });

        it('runs node environments with inspect mode', async function() {
            // these tests takes longer in CI
            this.timeout(20_000);
            const app = new Application({ basePath: nodeFeatureFixturePath });
            const runningApp = await app.start({
                featureName: 'engine-node/x',
                inspect: true
            });
            disposables.add('closing app', () => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await getBodyContent(page)).to.equal('Hello');
            });
        });
    });

    describe('run', function() {
        // bundling may take a few seconds on ci machines
        this.timeout(15_000);
        it(`launches a built application with web environment`, async () => {
            const app = new Application({ basePath: engineFeatureFixturePath });
            await app.build({
                featureName: 'engine-single/x'
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run();
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await getBodyContent(page);

            expect(text).to.equal('App is running.');
        });

        it(`launches a built application with node environment`, async () => {
            const app = new Application({ basePath: nodeFeatureFixturePath });
            await app.build({
                featureName: 'engine-node/x'
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run();
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await getBodyContent(page);

            expect(text).to.equal('Hello');
        });

        it(`launches a built application with a contextual environment`, async () => {
            const app = new Application({ basePath: contextualFeatureFixturePath });
            await app.build();
            const { close: webWorkerServer, port: webWorkerAppPort } = await app.run({
                featureName: 'contextual/some-feature'
            });
            disposables.add(() => app.clean());
            disposables.add(() => webWorkerServer());

            const webWorkerAppPage = await loadPage(
                `http://localhost:${webWorkerAppPort}/main.html?feature=contextual/some-feature`
            );

            const textFromWebWorker = await getBodyContent(webWorkerAppPage);

            expect(textFromWebWorker).to.contain('worker');

            const { close: closeServer, port: serverAppPort } = await app.run({
                featureName: 'contextual/server-env'
            });
            disposables.add(() => closeServer());

            const serverAppPage = await loadPage(
                `http://localhost:${serverAppPort}/main.html?feature=contextual/server-env`
            );

            const textFromServer = await getBodyContent(serverAppPage);

            expect(textFromServer).to.contain('server');
        });
    });
});
