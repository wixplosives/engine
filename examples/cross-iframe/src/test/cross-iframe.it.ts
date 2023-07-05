import { withFeature } from '@wixc3/engine-test-kit';
import { waitFor } from 'promise-assist';
import { expect } from 'chai';
import { CrossIframeDriver } from './cross-iframe-driver';

describe('Cross Iframes Example', function () {
    const { getLoadedFeature } = withFeature({
        featureName: 'cross-iframe/configured-iframe',
    });
    this.timeout(15_000);

    it('initial iframe rendered', async () => {
        const { page } = await getLoadedFeature();
        const crossFrameDriver = await CrossIframeDriver.getFromRoot(page);

        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/0'));
    });

    it('initial iframe rendered and reinitialized', async () => {
        const { page } = await getLoadedFeature();
        const crossFrameDriver = await CrossIframeDriver.getFromRoot(page);

        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/0'));

        await crossFrameDriver.clickNavigationButton(0);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/1'));
    });

    it('initial iframe rendered and reinitialized multiple times to same url', async () => {
        const { page } = await getLoadedFeature();
        const crossFrameDriver = await CrossIframeDriver.getFromRoot(page);

        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/0'));

        await crossFrameDriver.clickNavigationButton(0);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/1'));

        await crossFrameDriver.clickNavigationButton(0);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/2'));

        await crossFrameDriver.clickNavigationButton(0);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/3'));
    });

    it('initial iframe rendered and reinitialized multiple times cross origins', async () => {
        const { page } = await getLoadedFeature();
        const crossFrameDriver = await CrossIframeDriver.getFromRoot(page);

        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/0'));
        await crossFrameDriver.clickNavigationButton(0);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/1'));

        await crossFrameDriver.clickNavigationButton(1);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/2'));

        await crossFrameDriver.clickNavigationButton(2);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/3'));

        await crossFrameDriver.clickNavigationButton(0);
        await waitFor(async () => expect(await crossFrameDriver.getIframeContent()).to.eq('iframe/4'));
    });
});
