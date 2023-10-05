import { getRunningFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { fileURLToPath } from 'node:url';
import Feature, { processingEnv } from '../feature/multi-env.feature.js';

describe('multi-env Processing env test', () => {
    it('echos from node env', async () => {
        const projectPath = fileURLToPath(new URL('.', import.meta.url));

        const { runningApi } = await getRunningFeature({
            featureName: 'multi-env/test-node',
            env: processingEnv,
            runtimeOptions: {
                projectPath,
            },
            feature: Feature,
        });

        const message = runningApi.echoService.echo('text');
        expect(message).to.eq('node env says text');
    });
});
