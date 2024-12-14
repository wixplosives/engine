import { withFeature } from '@wixc3/engine-test-kit';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'node:path';
import { type Page } from 'playwright-core';

chai.use(chaiAsPromised);

describe('react/someplugin persistent checks', function () {
    this.timeout(20_000);

    const { getLoadedFeature } = withFeature({
        featureName: 'react/someplugin',
        runOptions: {
            projectPath: path.join(import.meta.dirname, '..'),
        },
        persist: true,
    });

    let page: Page;
    before('initialize page', async function () {
        ({ page } = await getLoadedFeature());
    });

    it('checks checkbox in order for it to appear in the next test', async () => {
        const checkbox = page.locator('#checkbox');
        await checkbox.waitFor();
        await checkbox.check();
    });

    it('validates if checkbox is checked from the previous test', async () => {
        const checkbox = page.locator('#checkbox');
        await checkbox.isChecked({ timeout: 1000 });
    });

    it('should throw an error if getLoadedFeature is being called more than once', async () => {
        await expect(getLoadedFeature()).to.be.eventually.rejectedWith(
            'getLoadedFeature cannot be called more than once while persist mode is on!',
        );
    });
});
