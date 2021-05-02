import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { join } from 'path';

describe('React Feature', function () {
    this.timeout(20_000);

    const { getLoadedFeature } = withFeature({
        featureName: 'react/someplugin',
        runOptions: {
            projectPath: join(__dirname, '..'),
            webpackHot: 'true',
            webpackConfig: join(__dirname, '../webpack.config.hot'),
        },
    });

    it('Can render react applications', async () => {
        const { page } = await getLoadedFeature({ runOptions: { webpackHot: 'true' } });
        const content = await page.$eval('#loadable', (e) => e.textContent!);
        expect(content).to.eql('This is from a file');
    });
});
