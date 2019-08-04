import { createDisposables } from '@wixc3/engine-test-kit';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { join } from 'path';
import { Application } from '../src';

chai.use(chaiAsPromised);

const nodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'node-env');
const runFeatureOptions = { featureName: 'engine-local/x', configName: 'engine-local/dev' };

describe('Node environments manager', function() {
    this.timeout(10_000);
    const disposables = createDisposables();

    afterEach(disposables.dispose);

    it('launches a new node environment', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, nodeEnvironmentManager } = await app.start();

        await nodeEnvironmentManager.runFeature(runFeatureOptions);

        disposables.add(() => nodeEnvironmentManager.closeFeature(runFeatureOptions));
        disposables.add(() => close());

        const allOpenEnvironments = await nodeEnvironmentManager.getRunningFeatures();
        expect(allOpenEnvironments).to.be.not.an('undefined');
        expect(allOpenEnvironments).to.be.an('Array');
        expect(allOpenEnvironments).to.contain(runFeatureOptions.featureName);
    });

    it('lists only open environments', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, nodeEnvironmentManager } = await app.start();

        const allOpenEnvironments = await nodeEnvironmentManager.getRunningFeatures();

        expect(allOpenEnvironments).to.be.an('Array');
        expect((allOpenEnvironments as string[]).length).to.equal(0);

        await nodeEnvironmentManager.runFeature(runFeatureOptions);

        expect(await nodeEnvironmentManager.getRunningFeatures()).to.contain(runFeatureOptions.featureName);

        disposables.add(() => nodeEnvironmentManager.closeFeature(runFeatureOptions));
        disposables.add(() => close());
    });

    it('fails to launch if wrong config name or feature name are provided', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, nodeEnvironmentManager } = await app.start();
        expect(nodeEnvironmentManager.runFeature({})).to.eventually.throw('feature name was not provided');
        expect(nodeEnvironmentManager.runFeature({ featureName: 'test' })).to.eventually.throw(
            'config name was not provided'
        );
        expect(nodeEnvironmentManager.runFeature({ featureName: 'test' })).to.eventually.throw();
        disposables.add(() => close());
    });

    it('closes open environments', async () => {
        const app = new Application(nodeEnvironmentFixturePath);
        const { close, nodeEnvironmentManager } = await app.start();
        await nodeEnvironmentManager.runFeature(runFeatureOptions);
        disposables.add(() => close());
        expect(nodeEnvironmentManager.closeFeature({ featureName: 'test' })).to.eventually.throw(
            'Error: there are no node environments running for test'
        );
    });
});
