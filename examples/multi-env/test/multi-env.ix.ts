import { expect } from 'chai';
import { withFeature } from '@wixc3/engine-test-kit';
import MultiEnv from '../feature/multi-env.feature';

describe('Multi Environment', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'multi-env/test-worker',
    });

    it('allows providing custom top level config', async () => {
        const { page } = await getLoadedFeature({
            config: [
                MultiEnv.use({
                    config: {
                        name: 'my-name',
                    },
                }),
            ],
        });

        const content = await page.evaluate(() => document.body.textContent!.trim());
        const { config } = JSON.parse(content);
        expect(config.name).to.eq('my-name');
    });
});
