import fs from '@file-services/node';
import { BaseHost, Communication } from '@wixc3/engine-core';
import { initializeNodeEnvironment, ProcessExitDetails } from '@wixc3/engine-electron-commons';
import { findFeatures } from '@wixc3/engine-scripts';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { IOType } from 'child_process';
import { deferred } from 'promise-assist';
import testFeature, { serverEnv } from '../test-project/test-feature.feature';

const { expect } = chai;
chai.use(chaiAsPromised);

const testProjectPath = fs.join(__dirname, '../test-project');

const setupRunningEnv = async ({
    errorMode,
    handleUncaught,
    stdio = 'ignore',
}: {
    errorMode?: 'exception' | 'exit' | 'promiseReject' | 'out-of-memory';
    handleUncaught?: boolean;
    stdio?: IOType;
} = {}) => {
    const communication = new Communication(new BaseHost(), 'someId');
    const { features } = findFeatures(testProjectPath, fs, 'dist');
    const { onDisconnect, dispose, environmentIsReady } = initializeNodeEnvironment({
        communication,
        env: serverEnv,
        runtimeArguments: {
            featureName: testFeature.id,
            basePath: testProjectPath,
            outputPath: fs.join(testProjectPath, 'dist-app'),
            nodeEntryPath: fs.join(testProjectPath, 'entry.js'),
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

    const disconnect = deferred<ProcessExitDetails>();
    onDisconnect(disconnect.resolve);

    return {
        onDisconnect,
        dispose,
        disconnectPromise: disconnect.promise,
    };
};

describe('onDisconnectHandler for node environment initializer', () => {
    const expectedProcessExitDetails: ProcessExitDetails = {
        exitCode: 1,
        signal: null,
        lastSeenError: null,
    };

    describe('without own uncaughtException handling', () => {
        it('should catch on dispose of env', async () => {
            const { dispose, disconnectPromise } = await setupRunningEnv();

            dispose();

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should catch on env exit intentionally', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exit' });
            await disconnectPromise;
            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should expose disconnect reason when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'promiseReject' });

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', stdio: 'pipe' });

            const disconnectDetails = await disconnectPromise;
            expect(disconnectDetails.lastSeenError).to.not.be.empty;
        });
    });
    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, disconnectPromise } = await setupRunningEnv({ handleUncaught });

            dispose();

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should catch on env exit intentionally', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exit', handleUncaught });
            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', handleUncaught });

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should expose disconnect reason when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'promiseReject', handleUncaught });

            await expect(disconnectPromise).to.eventually.deep.eq(expectedProcessExitDetails);
        });
        it('should expose disconnect reason when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', stdio: 'pipe' });

            const disconnectDetails = await disconnectPromise;
            expect(disconnectDetails.lastSeenError).to.not.be.empty;
        });
    });
});
