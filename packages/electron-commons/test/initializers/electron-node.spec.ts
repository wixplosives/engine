import fs from '@file-services/node';
import type { ProcessExitDetails } from '../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { IOType } from 'child_process';
import { platform } from 'os';
import testFeature, { ErrorTypeConfig, serverEnv } from '@fixture/disconnecting-env/dist/disconnecting-env.feature';
import { setupRunningNodeEnv } from '../../test-kit/setup-running-node-env';

const { expect } = chai;
chai.use(chaiAsPromised);

const featurePath = fs.dirname(require.resolve('@fixture/disconnecting-env/package.json'));

interface SetupRunningFeatureOptions {
    config: Partial<ErrorTypeConfig>;
    stdio?: IOType;
}

const setupRunningEnv = ({ config, stdio }: SetupRunningFeatureOptions) =>
    setupRunningNodeEnv({
        featurePath,
        featureId: testFeature.id,
        env: serverEnv,
        config: [testFeature.use({ errorType: config })],
        stdio,
    });

describe('onDisconnectHandler for node environment initializer', () => {
    const expectedErrorResult: ProcessExitDetails = {
        exitCode: 1,
        signal: null,
        errorMessage: '',
    };

    // windows does not support signals, so process termination
    // results in `exitCode: 1` instead of `signal: 'SIGTERM'` for win32 platform
    const expectedTerminationResult: ProcessExitDetails = {
        exitCode: platform() === 'win32' ? 1 : null,
        signal: platform() === 'win32' ? null : 'SIGTERM',
        errorMessage: '',
    };

    describe('without own uncaughtException handling', () => {
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({ config: { errorMode: 'no-error' } });

            dispose();

            await expect(exitPromise).to.eventually.deep.eq(expectedTerminationResult);
        });

        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'exit' } });
            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'exception' } });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'promiseReject' } });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'exception' }, stdio: 'pipe' });
            const exitDetails = await exitPromise;
            expect(exitDetails.errorMessage).to.not.be.empty;
        });
    });
    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({
                config: { errorMode: 'no-error', handleUncaught },
            });

            dispose();

            await expect(exitPromise).to.eventually.deep.eq(expectedTerminationResult);
        });
        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'exit', handleUncaught } });
            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'exception', handleUncaught } });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({ config: { errorMode: 'promiseReject', handleUncaught } });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
    });
});
