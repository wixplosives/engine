import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { join } from 'path';

import { createDisposables } from '@wixc3/engine-core';

import { Application } from '../src';

chai.use(chaiAsPromised);

const nodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'node-env');
const runFeatureOptions = { featureName: 'engine-node/x' };

describe('Node environments manager', function () {
    this.timeout(10_000);
    const disposables = createDisposables();

    afterEach(disposables.dispose);

    it('launches a new node environment', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        const { close, nodeEnvironmentManager } = await app.start({ singleRun: true });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);

        const allOpenEnvironments = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();
        expect(allOpenEnvironments).to.be.not.an('undefined');
        expect(allOpenEnvironments).to.be.an('Array');
        expect(allOpenEnvironments[0]).to.contain(runFeatureOptions.featureName);
    });

    it('lists only open environments', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        const { close, nodeEnvironmentManager } = await app.start({ singleRun: true });
        disposables.add(() => close());

        const allOpenEnvironments = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();

        expect(allOpenEnvironments).to.be.an('Array');
        expect(allOpenEnvironments.length).to.equal(0);

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);

        expect(nodeEnvironmentManager.getFeaturesWithRunningEnvironments()[0]).to.contain(
            runFeatureOptions.featureName
        );
    });

    it('fails to launch if wrong config name or feature name are provided', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        const { close, nodeEnvironmentManager } = await app.start({ singleRun: true });
        disposables.add(() => close());

        await expect(
            nodeEnvironmentManager.runServerEnvironments({ featureName: 'test' })
        ).to.eventually.be.rejectedWith(
            'cannot find feature test. available features: engine-node/x, engine-core/communication'
        );
    });

    it('closes open environments', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        const { close, nodeEnvironmentManager } = await app.start({ singleRun: true });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);
        await expect(nodeEnvironmentManager.closeEnvironment({ featureName: 'test' })).to.eventually.be.rejectedWith(
            'there are no node environments running for test'
        );
    });
});
