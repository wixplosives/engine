import { getRunningFeature } from '@wixc3/engine-test-kit';
import Feature, { devServerEnv } from '../feature/dev-server.feature';
//import { expect } from 'chai';
import fs from '@file-services/node';

describe('engineer:dev-server', () => {
    it('launches a webserver', async () => {
        const res = await getRunningFeature({
            featureName: 'engineer/dev-server',
            env: devServerEnv,
            feature: Feature,
            fs,
        });

        console.log(await res.runningApi.application.analyzeFeatures());
        await res.dispose();
    });
});
