import { getRunningFeature } from '@wixc3/engine-test-kit';
import { createDisposables } from '@wixc3/create-disposables';
import Feature, { processingEnv } from '../feature/multi-env.feature';
import { expect } from 'chai';

describe('Processing env test', () => {
    const disposables = createDisposables();
    afterEach(disposables.dispose);

    it('echos from node env', async () => {
        const { engine, runningApi } = await getRunningFeature({
            featureName: 'multi-env/test-node',
            env: processingEnv,
            runtimeOptions: {
                projectPath: __dirname,
            },
            feature: Feature,
        });
        disposables.add(engine.shutdown);

        const message = runningApi.echoService.echo('text');
        expect(message).to.eq('node env says text');
    });
});
