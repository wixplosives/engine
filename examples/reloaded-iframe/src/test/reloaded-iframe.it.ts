import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { contentId, echoBtnId, refreshBtnId, timesRefreshedId } from '../consts.js';

describe('managed iframe environment', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'reloaded-iframe',
    });

    it.skip('successfully reload iframe enviroenment when iframe refreshes', async () => {
        const { page } = await getLoadedFeature();
        const echoBtn = await page.$(`#${echoBtnId}`);
        const content = await page.$(`#${contentId}`);
        const refreshBtn = await page.$(`#${refreshBtnId}`);
        await refreshBtn!.click();
        await waitFor(async () => {
            const timesRefreshed = await page.$(`#${timesRefreshedId}`);
            expect(await (await timesRefreshed!.getProperty('textContent')!).jsonValue()).to.contain('1');
        });
        await echoBtn!.click();

        await waitFor(async () => {
            expect(await (await content!.getProperty('textContent')!).jsonValue()).to.contain('1');
        });
    });
});
