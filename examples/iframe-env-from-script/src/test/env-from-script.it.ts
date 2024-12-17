import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor } from 'promise-assist';

describe('iframe created via script and fetch-options-from-parent=true', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'iframe-env-from-script/env-from-script',
    });

    it('to initialize', async () => {
        const { page } = await getLoadedFeature();
        const echoBtn = page.locator('#echo');

        const frameLocator = page.frameLocator('iframe').locator('body');
        await waitFor(async () => {
            expect(await frameLocator.getByText('iframe initialized').count()).to.eql(1);
        });

        await echoBtn.click();

        await waitFor(async () => {
            expect(await frameLocator.getByText('echo').count()).to.eql(1);
        });
    });
});
