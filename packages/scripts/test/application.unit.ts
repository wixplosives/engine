import { nodeFs } from '@file-services/node';
import { createBrowserProvider, createDisposables } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { join } from 'path';
import { waitFor } from 'promise-assist';
import { Application } from '../src/application';
const { directoryExists } = nodeFs.promises;

describe('Application', function() {
    this.timeout(30_000);

    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    afterEach(async function() {
        this.timeout(60_000);
        return disposables.dispose();
    });

    after(() => browserProvider.dispose());

    it(`supports building features with a single fixture`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-feature');
        const app = new Application(fixtureBase);
        await app.build('x', 'dev');

        expect(await directoryExists(app.outputPath), 'has dist folder').to.equal(true);
    });

    // we don't support multiple fixtures build
    it.skip(`supports building features with multiple fixtures`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-multi-feature');
        const app = new Application(fixtureBase);
        await app.build();

        expect(await directoryExists(app.outputPath), 'has dist folder').to.equal(true);
    });

    it(`start a development server and serve the feature default config`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-feature');

        const app = new Application(fixtureBase);

        const { close, port } = await app.start();
        disposables.add(() => close());
        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        disposables.add(() => page.close());

        const text = await page.evaluate(() => document.body.textContent!.trim());

        expect(text).to.equal('App is running.');
    });

    it(`run feature and serve default feature with default config`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-multi-feature');
        const app = new Application(fixtureBase);
        const { close, port } = await app.start();
        disposables.add(() => close());

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        disposables.add(() => page.close());

        const { myConfig, mySlot } = await page.evaluate(() => {
            return {
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!)
            };
        });

        expect(myConfig).to.eql({
            tags: ['fixture1']
        });
        expect(mySlot).to.eql([]);
    });

    it(`run feature and serve with feature from url and it's default config`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-multi-feature');
        const app = new Application(fixtureBase);
        const { close, port } = await app.start();
        disposables.add(() => close());

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html?feature=variant`);
        disposables.add(() => page.close());

        const { myConfig, mySlot } = await page.evaluate(() => {
            return {
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!)
            };
        });

        expect(myConfig).to.eql({
            tags: ['variant', '1']
        });
        expect(mySlot).to.eql(['testing 1 2 3']);
    });

    it(`run feature and serve with feature from url and config from url`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-multi-feature');
        const app = new Application(fixtureBase);
        const { close, port } = await app.start();
        disposables.add(() => close());

        const page = await browserProvider.loadPage(
            `http://localhost:${port}/main.html?feature=variant&config=variant2`
        );
        disposables.add(() => page.close());

        const { myConfig, mySlot } = await page.evaluate(() => {
            return {
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!)
            };
        });

        expect(myConfig).to.eql({
            tags: ['variant', '2']
        });
        expect(mySlot).to.eql(['testing 1 2 3']);
    });

    it(`run feature and serves node environments`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-local-feature');
        const app = new Application(fixtureBase);
        const runningApp = await app.start();
        disposables.add('closing app', () => runningApp.close());

        const runningFeature = await runningApp.runFeature({
            featureName: 'x',
            configName: 'dev'
        });
        disposables.add('closing feature', runningFeature.close);

        const page = await browserProvider.loadPage(
            `http://localhost:${runningApp.port}/main.html?feature=x&config=dev`
        );
        disposables.add('closing page', () => page.close());
        await waitFor(async () => {
            expect(await page.evaluate(() => document.body.textContent!.trim())).to.equal('Hello');
        });
    });
});
