import fs from '@file-services/node';
import { BaseHost, Communication } from '@wixc3/engine-core';
import { initializeNodeEnvironment, ProcessExitDetails } from '@wixc3/engine-electron-commons';
import { findFeatures } from '@wixc3/engine-scripts';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { IOType } from 'child_process';
import { deferred } from 'promise-assist';
import { platform } from 'os';
import testFeature, { serverEnv } from '../test-project/test-feature.feature';

const { expect } = chai;
chai.use(chaiAsPromised);

const testProjectPath = fs.join(__dirname, '../test-project');

const setupRunningEnv = async ({
    errorMode,
    handleUncaught,
    stdio = 'ignore',
}: {
    errorMode?: 'exception' | 'exit' | 'promiseReject' | 'out-of-memory' | 'no-error';
    handleUncaught?: boolean;
    stdio?: IOType;
} = {}) => {
    const communication = new Communication(new BaseHost(), 'someId');
    const { features } = findFeatures(testProjectPath, fs, 'dist');
    const { onExit, dispose, environmentIsReady } = initializeNodeEnvironment({
        communication,
        env: serverEnv,
        runtimeArguments: {
            featureName: testFeature.id,
            basePath: testProjectPath,
            outputPath: fs.join(testProjectPath, 'dist-app'),
            nodeEntryPath: fs.join(testProjectPath, 'entry.js'),
            workerThreadEntryPath: '',
            config: [testFeature.use({ errorType: { type: errorMode, handleUncaught } })],
            features: Array.from(features.entries()),
        },
        processOptions: {
            cwd: process.cwd(),
            stdio: [stdio, stdio, stdio, 'ipc'],
        },
        environmentStartupOptions: {},
    });

    await environmentIsReady;

    const environmentExit = deferred<ProcessExitDetails>();
    onExit(environmentExit.resolve);

    return {
        onExit,
        dispose,
        exitPromise: environmentExit.promise,
    };
};

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
            const { dispose, exitPromise } = await setupRunningEnv({ errorMode: 'no-error' });

            dispose();

            await expect(exitPromise).to.eventually.deep.eq(expectedTerminationResult);
        });

        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'exit' });
            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'promiseReject' });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'exception', stdio: 'pipe' });
            const exitDetails = await exitPromise;
            expect(exitDetails.errorMessage).to.not.be.empty;
        });
    });
    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, exitPromise } = await setupRunningEnv({ handleUncaught, errorMode: 'no-error' });

            dispose();

            await expect(exitPromise).to.eventually.deep.eq(expectedTerminationResult);
        });
        it('should catch on env exit intentionally', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'exit', handleUncaught });
            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'exception', handleUncaught });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { exitPromise } = await setupRunningEnv({ errorMode: 'promiseReject', handleUncaught });

            await expect(exitPromise).to.eventually.deep.eq(expectedErrorResult);
        });
    });
});
