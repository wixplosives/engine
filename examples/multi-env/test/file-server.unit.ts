import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { processingEnv } from '../feature/multi-env.feature';
import { expect } from 'chai';
import fs from '@file-services/node';

describe('Processing env test', () => {
    it('echos from node env', async () => {
        const { dispose, runningApi } = await getRunningFeature({
            featureName: 'multi-env/test-node',
            env: processingEnv,
            runtimeOptions: {
                projectPath: __dirname,
            },
            fs,
            feature: Feature,
        });

        const message = await runningApi.echoService.echo('text');
        expect(message).to.eq('node env says text');

        await dispose();
    });
});
