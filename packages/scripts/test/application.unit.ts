import fs from '@file-services/node';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { join } from 'path';
import { Application } from '../src/application';
const { directoryExists } = fs.promises;

describe('Application', () => {
    const closables: Array<() => unknown> = [];
    const browserProvider = createBrowserProvider();

    afterEach(async function() {
        this.timeout(10_000);
        await Promise.all(closables.map(c => c()));
        closables.length = 0;
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
        await app.build('app');

        expect(await directoryExists(app.outputPath), 'has dist folder').to.equal(true);
    });

    it(`start a development server and serve the feature default config`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-feature');

        const app = new Application(fixtureBase);

        const { close, port } = await app.start();
        closables.push(() => close());
        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        closables.push(() => page.close());

        const text = await page.evaluate(() => document.body.textContent!.trim());

        expect(text).to.equal('App is running.');
    });

    it(`run feature and serve default feature with default config`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-multi-feature');
        const app = new Application(fixtureBase);
        const { close, port } = await app.start();
        closables.push(() => close());

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        closables.push(() => page.close());

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
        closables.push(() => close());

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html?feature=test/variant`);
        closables.push(() => page.close());

        const { myConfig, mySlot } = await page.evaluate(() => {
            return {
                myConfig: JSON.parse(document.getElementById('myConfig')!.textContent!),
                mySlot: JSON.parse(document.getElementById('mySlot')!.textContent!)
            };
        });

        expect(myConfig).to.eql({
            tags: ['fixture1']
        });
        expect(mySlot).to.eql(['testing 1 2 3']);
    });

    it(`run feature and serve with feature from url and config from url`, async () => {
        const fixtureBase = join(__dirname, './fixtures/engine-multi-feature');
        const app = new Application(fixtureBase);
        const { close, port } = await app.start();
        closables.push(() => close());

        const page = await browserProvider.loadPage(
            `http://localhost:${port}/main.html?feature=test/variant&config=test/variant2`
        );
        closables.push(() => page.close());

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
});
