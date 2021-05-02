import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { join } from 'path';
import { createDisposables } from '@wixc3/engine-core';
import { Application } from '@wixc3/engine-scripts';
import { createBrowserProvider } from '@wixc3/engine-test-kit';

chai.use(chaiAsPromised);

const nodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'node-env');
const multiNodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'multi-node-env');
const socketNodeEnvironmentFixturePath = join(__dirname, 'fixtures', 'multi-socket-node-env');
const runFeatureOptions = { featureName: 'engine-node/x' };

describe('Node environments manager', function () {
    this.timeout(10_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();

    after(() => browserProvider.dispose());

    afterEach(disposables.dispose);

    it('launches a new node environment', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        await app.build();
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager } = await app.run();
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);

        const allOpenEnvironments = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();
        expect(allOpenEnvironments).to.be.not.an('undefined');
        expect(allOpenEnvironments).to.be.an('Array');
        expect(allOpenEnvironments[0]).to.contain(runFeatureOptions.featureName);
    });

    it('lists only open environments', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        await app.build();
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager } = await app.run();
        disposables.add(close);

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
        await app.build();
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager } = await app.run();
        disposables.add(close);

        await expect(
            nodeEnvironmentManager.runServerEnvironments({ featureName: 'test' })
        ).to.eventually.be.rejectedWith(
            'cannot find feature test. available features: engine-node/x, engine-core/communication'
        );
    });

    it('closes open environments', async () => {
        const app = new Application({ basePath: nodeEnvironmentFixturePath });
        await app.build();
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager } = await app.run();
        disposables.add(close);

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);
        await expect(nodeEnvironmentManager.closeEnvironment({ featureName: 'test' })).to.eventually.be.rejectedWith(
            'there are no node environments running for test'
        );
    });

    it('allows socket communication between node environments', async () => {
        const app = new Application({ basePath: socketNodeEnvironmentFixturePath });
        await app.build({
            featureName: 'engine-multi-socket-node/x',
            staticBuild: false,
            publicConfigsRoute: '/config',
        });
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager, port } = await app.run({
            publicConfigsRoute: 'config',
            autoLaunch: false,
        });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments({ featureName: 'engine-multi-socket-node/x' });

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        disposables.add(() => page.close());

        const contents = await page.textContent('body');
        expect(contents).to.eq('hello gaga');
    });

    it('allows socket communication between node environments when running in forked mode', async () => {
        const app = new Application({ basePath: socketNodeEnvironmentFixturePath });
        await app.build({
            featureName: 'engine-multi-socket-node/x',
            staticBuild: false,
            publicConfigsRoute: '/config',
        });
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager, port } = await app.run({
            publicConfigsRoute: 'config',
            autoLaunch: false,
        });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments({
            featureName: 'engine-multi-socket-node/x',
            mode: 'forked',
        });

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        disposables.add(() => page.close());

        const contents = await page.textContent('body');
        expect(contents).to.eq('hello gaga');
    });

    it('allows local communication between node environments', async () => {
        const app = new Application({ basePath: multiNodeEnvironmentFixturePath });
        await app.build({
            featureName: 'engine-multi-node/x',
            staticBuild: false,
            publicConfigsRoute: '/config',
        });
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager, port } = await app.run({
            publicConfigsRoute: 'config',
            autoLaunch: false,
        });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments({ featureName: 'engine-multi-node/x' });

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        disposables.add(() => page.close());

        const contents = await page.textContent('body');
        expect(contents).to.eq('hello gaga');
    });

    it('allows local communication between node environments when running in forked mode', async () => {
        const app = new Application({ basePath: multiNodeEnvironmentFixturePath });
        await app.build({
            featureName: 'engine-multi-node/x',
            staticBuild: false,
            publicConfigsRoute: '/config',
        });
        disposables.add(() => app.clean());
        const { close, nodeEnvironmentManager, port } = await app.run({
            publicConfigsRoute: 'config',
            autoLaunch: false,
        });
        disposables.add(() => close());

        await nodeEnvironmentManager.runServerEnvironments({ featureName: 'engine-multi-node/x', mode: 'forked' });

        const page = await browserProvider.loadPage(`http://localhost:${port}/main.html`);
        disposables.add(() => page.close());

        const contents = await page.textContent('body');
        expect(contents).to.eq('hello gaga');
    });
});
