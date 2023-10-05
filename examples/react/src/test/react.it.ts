import { withFeature } from '@wixc3/engine-test-kit';
import { fileURLToPath } from 'node:url';

describe('React Feature', function () {
    this.timeout(20_000);

    const { getLoadedFeature } = withFeature({
        featureName: 'react/someplugin',
        runOptions: {
            projectPath: fileURLToPath(new URL('..', import.meta.url)),
        },
    });

    it('Can render react applications', async () => {
        const { page } = await getLoadedFeature();

        await page.locator('#loadable', { hasText: 'This is from a file' }).waitFor({ state: 'visible' });
    });
});
