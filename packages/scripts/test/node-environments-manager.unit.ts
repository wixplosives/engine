import chai, { expect } from 'chai';
import { createDisposables } from '@wixc3/engine-test-kit';
import { Application, NodeEnvironmentsManager } from '../src';
import chaiAsPromised from 'chai-as-promised';
import { join } from 'path';

chai.use(chaiAsPromised);

const nodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'node-env');
const runFeatureOptions = { featureName: 'engine-local/x', configName: 'engine-local/dev' };

describe('Node environments manager', () => {
    const disposables = createDisposables();

    afterEach(disposables.dispose);

    it('launches a new node environment', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, runFeature } = await app.start();
        const nodeEnvManager = new NodeEnvironmentsManager(runFeature);

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

    it('fails to launch if wrong config name or feature name are provided', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, runFeature } = await app.start();
        const nodeEnvManager = new NodeEnvironmentsManager(runFeature);
        expect(nodeEnvManager.runFeature({})).to.eventually.throw('feature name was not provided');
        expect(nodeEnvManager.runFeature({ featureName: 'test' })).to.eventually.throw('config name was not provided');
        expect(nodeEnvManager.runFeature({ featureName: 'test', configName: 'test' })).to.eventually.throw();
        disposables.add(() => close());
    });

    it('closes open environments', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, runFeature } = await app.start();
        const nodeEnvManager = new NodeEnvironmentsManager(runFeature);
        await nodeEnvManager.runFeature(runFeatureOptions);
        disposables.add(() => close());
        disposables.add(() => close());
        expect(nodeEnvManager.closeFeature({ featureName: 'test', configName: 'test' })).to.eventually.throw(
            'Error: there are no node environments running for test'
        );
        await nodeEnvManager.closeFeature(runFeatureOptions);
        disposables.add(() => close());
    });
});
