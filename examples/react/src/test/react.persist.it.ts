import { withFeature } from '@wixc3/engine-test-kit';
import { join } from 'path';
import { Page } from 'playwright-core';

describe('react/someplugin persistent checks', function () {
    this.timeout(20_000);

    const { getLoadedFeature } = withFeature({
        featureName: 'react/someplugin',
        runOptions: {
            projectPath: join(__dirname, '..'),
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
});
