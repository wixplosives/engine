import { expect } from 'chai';
import { createDisposables } from '@wixc3/engine-test-kit';
import { Application, NodeEnvironmentsManager } from '../src';
import { join } from 'path';

const nodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'node-env');

describe('Node environments manager', () => {
    const disposables = createDisposables();

    afterEach(disposables.dispose);

    it('launches a new node environment', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, runFeature } = await app.start();
        const nodeEnvManager = new NodeEnvironmentsManager(runFeature);

        const runFeatureOptions = { featureName: 'engine-local/x', configName: 'engine-local/dev' };

        await nodeEnvManager.runFeature(runFeatureOptions);

        disposables.add(() => nodeEnvManager.closeFeature(runFeatureOptions));
        disposables.add(() => close());

        const allOpenEnvironments = await nodeEnvManager.getRunningFeatures();
        expect(allOpenEnvironments).to.be.not.an('undefined');
        expect(allOpenEnvironments).to.be.not.an('Array');
        const nodeEnv = allOpenEnvironments as Record<string, string[]>;
        expect(nodeEnv[runFeatureOptions.featureName]).to.contain(runFeatureOptions.configName);
    });

    it('lists only open environments', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, runFeature } = await app.start();
        const nodeEnvManager = new NodeEnvironmentsManager(runFeature);

        let allOpenEnvironments = await nodeEnvManager.getRunningFeatures();

        expect(allOpenEnvironments).to.be.an('object');
        const nodeEnv = allOpenEnvironments as Record<string, string[]>;
        expect(Object.keys(nodeEnv).length).to.equal(0);

        const runFeatureOptions = { featureName: 'engine-local/x', configName: 'engine-local/dev' };
        await nodeEnvManager.runFeature(runFeatureOptions);

        const allOpenEnvironmentsForConfig = await nodeEnvManager.getRunningFeatures({
            featureName: runFeatureOptions.featureName
        });
        expect(allOpenEnvironmentsForConfig).to.be.an('Array');
        expect(allOpenEnvironmentsForConfig).to.contain(runFeatureOptions.configName);

        allOpenEnvironments = await nodeEnvManager.getRunningFeatures();
        expect((allOpenEnvironments as Record<string, string[]>)[runFeatureOptions.featureName]).to.contain(
            runFeatureOptions.configName
        );

        disposables.add(() => nodeEnvManager.closeFeature(runFeatureOptions));
        disposables.add(() => close());
    });
});
