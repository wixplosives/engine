import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { processingEnv } from '../feature/multi-env.feature';
import { expect } from 'chai';

describe('Processing env test', () => {
    it('echos from node env', async () => {
        const { dispose, runningApi } = await getRunningFeature({
            featureName: 'multi-env/test-node',
            env: processingEnv,
            runtimeOptions: {
                projectPath: __dirname,
            },
            feature: Feature,
        });

        const message = await runningApi.echoService.echo('text');
        expect(message).to.eq('node env says text');

        await dispose();
    });
});
