import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { processingEnv } from '../feature/multi-env.feature.js';
import { expect } from 'chai';

describe('multi-env Processing env test', () => {
    it('echos from node env', async () => {
        const { runningApi } = await getRunningFeature({
            featureName: 'multi-env/test-node',
            env: processingEnv,
            runtimeOptions: {
                projectPath: __dirname,
            },
            feature: Feature,
        });

        const message = runningApi.echoService.echo('text');
        expect(message).to.eq('node env says text');
    });
});
