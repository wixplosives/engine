import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { withFeature } from '@wixc3/engine-test-kit';
import MultiEnv from '../feature/multi-env.feature.js';

describe('Multi Environment', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'multi-env/test-webworker',
    });

    it('allows providing custom top level config', async () => {
        const { page } = await getLoadedFeature({
            config: [
                MultiEnv.configure({
                    config: {
                        name: 'my-name',
                    },
                }),
            ],
        });

        await waitFor(async () => {
            const content = await page.evaluate(() => document.body.textContent!.trim());
            const { config } = JSON.parse(content) as { config: { name: string } };
            expect(config.name).to.eq('my-name');
        });
    });
});
