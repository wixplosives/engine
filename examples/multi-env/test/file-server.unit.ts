import { runEngineEnvironment } from '@wixc3/engine-test-kit';
import Feature, { processingEnv } from '../feature/multi-env.feature';
import { expect } from 'chai';
import fs from '@file-services/node';

describe('Processing env test', () => {
    it('echos from node env', async () => {
        const { dispose, engine } = await runEngineEnvironment({
            featureName: 'multi-env/test-node',
            env: processingEnv,
            runtimeOptions: {
                projectPath: __dirname,
            },
            fs,
        });

        const {
            api: { echoService },
        } = engine.get(Feature);
        const message = await echoService.echo('text');
        expect(message).to.eq('node env says text');

        await dispose();
    });
});
