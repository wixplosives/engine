import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { IOType } from 'node:child_process';
import path from 'node:path';
import type { TopLevelConfig } from '@wixc3/engine-core';
import testFeature, { serverEnv } from '@fixture/disconnecting-env/dist/disconnecting-env.feature.js';
import { setupRunningNodeEnv } from '../test-kit/setup-running-node-env.js';
import { Disposables } from '@wixc3/patterns';

const { expect } = chai;
chai.use(chaiAsPromised);

const featurePath = path.dirname(require.resolve('@fixture/disconnecting-env/package.json'));
const timeout = 3000;

interface SetupRunningFeatureOptions {
    featuresConfig: TopLevelConfig;
    stdio?: IOType;
}

const setupRunningEnv = ({ featuresConfig, stdio }: SetupRunningFeatureOptions) =>
    setupRunningNodeEnv({
        featurePath,
        featureId: testFeature.id,
        env: serverEnv,
        config: featuresConfig,
        stdio,
    });

describe('onDisconnectHandler for node environment initializer', () => {
    const disposables = new Disposables();
    afterEach(() => disposables.dispose());
    describe('without own uncaughtException handling', () => {
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: false } })],
            });

            await dispose();
            await expect(exitPromise).to.eventually.be.fulfilled;
        });

        it('should catch on env exit intentionally', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exit' } })],
            });

            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exception' } })],
            });

            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'promise-reject' } })],
            });
            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exception' } })],
                stdio: 'pipe',
            });
            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });

            const exitDetails = await exitPromise;
            expect(exitDetails.errorMessage).to.not.be.empty;
        });
    });

    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: false, handleUncaught } })],
            });

            await dispose();
            await expect(exitPromise).to.eventually.be.fulfilled;
        });
        it('should catch on env exit intentionally', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exit', handleUncaught } })],
            });
            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });
            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exception', handleUncaught } })],
            });
            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });
            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise, dispose } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'promise-reject', handleUncaught } })],
            });
            disposables.add(dispose, {
                timeout,
                name: `env ${testFeature.id}`,
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
    });
});
