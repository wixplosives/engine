import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { IOType } from 'child_process';

import fs from '@file-services/node';
import { TopLevelConfig } from '@wixc3/engine-core';

import testFeature, { serverEnv } from '@fixture/disconnecting-env/dist/disconnecting-env.feature';
import { setupRunningNodeEnv } from '../../test-kit/setup-running-node-env';

const { expect } = chai;
chai.use(chaiAsPromised);

const featurePath = fs.dirname(require.resolve('@fixture/disconnecting-env/package.json'));

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
    describe('without own uncaughtException handling', () => {
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: false } })],
            });

            await dispose();
            await expect(exitPromise).to.eventually.be.fulfilled;
        });

        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exit' } })],
            });
            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exception' } })],
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'promise-reject' } })],
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exception' } })],
                stdio: 'pipe',
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
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exit', handleUncaught } })],
            });
            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'exception', handleUncaught } })],
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({
                featuresConfig: [testFeature.use({ errorsConfig: { throwError: 'promise-reject', handleUncaught } })],
            });

            await expect(exitPromise).to.eventually.deep.eq({ exitCode: 1 });
        });
    });
});
