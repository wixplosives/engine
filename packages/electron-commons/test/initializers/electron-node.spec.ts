import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { IOType } from 'child_process';
import { platform } from 'os';

import fs from '@file-services/node';
import testFeature, { ErrorTypeConfig, serverEnv } from '@fixture/disconnecting-env/dist/disconnecting-env.feature';

import type { ProcessExitDetails } from '../../src';
import { setupRunningNodeEnv } from '../../test-kit/setup-running-node-env';

const { expect } = chai;
chai.use(chaiAsPromised);

const featurePath = fs.dirname(require.resolve('@fixture/disconnecting-env/package.json'));

const setupRunningEnv = ({ type, handleUncaught }: Partial<ErrorTypeConfig>, stdio?: IOType) =>
    setupRunningNodeEnv({
        featurePath,
        featureId: testFeature.id,
        env: serverEnv,
        config: [testFeature.use({ errorType: { type, handleUncaught } })],
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
            const { dispose, exitPromise } = await setupRunningEnv({ type: 'no-error' });

            dispose();

            await expect(exitPromise).to.eventually.deep.eq(expectedTerminationResult);
        });

        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'exit' });
            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'exception' });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'promiseReject' });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'exception' }, 'pipe');
            const exitDetails = await exitPromise;
            expect(exitDetails.errorMessage).to.not.be.empty;
        });
    });
    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({ handleUncaught, type: 'no-error' });

            dispose();

            await expect(exitPromise).to.eventually.deep.eq(expectedTerminationResult);
        });
        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'exit', handleUncaught });
            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'exception', handleUncaught });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({ type: 'promiseReject', handleUncaught });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
    });
});
