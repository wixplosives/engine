import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { contentId, echoBtnId, refreshBtnId } from '../src/consts';

describe('managed iframe environment', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'reloaded-iframe'
    });

    it('successfully reload iframe enviroenment when iframe refreshes', async () => {
        const { page } = await getLoadedFeature();
        const echoBtn = await page.$(`#${echoBtnId}`);
        const content = await page.$(`#${contentId}`);
        const rebreshBtn = await page.$(`#${refreshBtnId}`);
        await rebreshBtn!.click();
        await echoBtn!.click();
        expect(await (await content!.getProperty('textContent')!).jsonValue()).to.contain('1');
    });
});
