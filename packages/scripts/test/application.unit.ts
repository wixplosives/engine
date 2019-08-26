import fs from '@file-services/node';
import { createBrowserProvider, createDisposables } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { Application } from '../src/application';

describe('Application', function() {
    this.timeout(20_000);
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

    describe('build', () => {
        it(`supports building features with a single fixture`, async () => {
            const app = new Application(engineFeatureFixturePath);
            await app.build();
            disposables.add(() => app.clean());

            expect(fs.directoryExistsSync(app.outputPath), 'has dist folder').to.equal(true);
        });
    });

    describe('start', () => {
        it(`serves and allows running a feature`, async () => {
            const app = new Application(engineFeatureFixturePath);
            const { close, port } = await app.start({ featureName: 'engine-single/x' });
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await page.evaluate(() => document.body.textContent!.trim());

            expect(text).to.equal('App is running.');
        });

        it(`serves a fixture feature`, async () => {
            const app = new Application(multiFeatureFixturePath);
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
            const app = new Application(multiFeatureFixturePath);
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
            const app = new Application(nodeFeatureFixturePath);
            const runningApp = await app.start({
                featureName: 'engine-node/x'
            });
            disposables.add('closing app', () => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await page.evaluate(() => document.body.textContent!.trim())).to.equal('Hello');
            });
        });

        it('launches a feature with contextual environment with worker context', async () => {
            const app = new Application(contextualFeatureFixturePath);
            const runningApp = await app.start({
                featureName: 'contextual/some-feature'
            });
            disposables.add('closing app', () => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await page.evaluate(() => document.body.textContent!.trim())).to.equal('from worker');
            });
        });

        it('launches a feature with contextual environment with server context', async () => {
            const app = new Application(contextualFeatureFixturePath);
            const runningApp = await app.start({
                featureName: 'contextual/server-env'
            });
            disposables.add('closing app', () => runningApp.close());

            const page = await loadPage(`http://localhost:${runningApp.port}/main.html`);

            await waitFor(async () => {
                expect(await page.evaluate(() => document.body.textContent!.trim())).to.equal('from server');
            });
        });
    });

    describe('run static', function() {
        // bundling may take a few seconds on ci machines
        this.timeout(15_000);
        it(`launches a published application`, async () => {
            const app = new Application(engineFeatureFixturePath);
            await app.clean();
            await app.build({
                featureName: 'engine-single/x'
            });
            const { close, port } = await app.run();
            disposables.add(() => close());
            disposables.add(() => app.clean());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await page.evaluate(() => document.body.textContent!.trim());

            expect(text).to.equal('App is running.');
        });

        it(`launches a published application with node environment`, async () => {
            const app = new Application(nodeFeatureFixturePath);
            await app.clean();
            await app.build({
                featureName: 'engine-node/x'
            });
            disposables.add(() => app.clean());

            const { close, port } = await app.run();
            disposables.add(() => close());

            const page = await loadPage(`http://localhost:${port}/main.html`);

            const text = await page.evaluate(() => document.body.textContent!.trim());

            expect(text).to.equal('Hello');
        });

        it(`launches a published application with a contextual environment`, async () => {
            const app = new Application(contextualFeatureFixturePath);
            await app.clean();
            await app.build();
            const { close: closeServer, port: serverAppPort } = await app.run({
                featureName: 'contextual/some-feature'
            });
            disposables.add(() => app.clean());
            disposables.add(() => closeServer());

            const serverAppPage = await loadPage(
                `http://localhost:${serverAppPort}/main.html?feature=contextual/some-feature`
            );

            const serverText = await serverAppPage.evaluate(() => document.body.textContent!.trim());

            expect(serverText).to.contain('worker');

            const { close: closeWorker, port: workerAppPort } = await app.run({
                featureName: 'contextual/server-env'
            });
            disposables.add(() => closeWorker());

            const workerAppPage = await loadPage(
                `http://localhost:${workerAppPort}/main.html?feature=contextual/server-env`
            );

            const workerText = await workerAppPage.evaluate(() => document.body.textContent!.trim());

            expect(workerText).to.contain('server');
        });
    });
});
