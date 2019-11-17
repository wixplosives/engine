import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { waitFor, sleep } from 'promise-assist';
import { contentId, echoBtnId, refreshBtnId, timesRefreshedId } from '../src/consts';

describe('managed iframe environment', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'reloaded-iframe'
    });

    it('successfully reload iframe enviroenment when iframe refreshes', async () => {
        const { page } = await getLoadedFeature();
        const echoBtn = await page.$(`#${echoBtnId}`);
        const content = await page.$(`#${contentId}`);
        const refreshBtn = await page.$(`#${refreshBtnId}`);
        await refreshBtn!.click();
        await waitFor(
            async () => {
                const timesRefreshed = await page.$(`#${timesRefreshedId}`);
                expect(await (await timesRefreshed!.getProperty('textContent')!).jsonValue()).to.contain('1');
            },
            {
                timeout: 2000
            }
        );
        await echoBtn!.click();
        await sleep(500);
        expect(await (await content!.getProperty('textContent')!).jsonValue()).to.contain('1');
        // await waitFor(
        //     async () => {
        //     },
        //     {
        //         timeout: 2000
        //     }
        // );
    });
});
