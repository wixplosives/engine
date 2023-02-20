import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from '@file-services/node';
import { BaseHost, Communication } from '@wixc3/engine-core';
import { findFeatures } from '@wixc3/engine-scripts';
import { DisconnectDetails, initializeNodeEnvironment } from '@wixc3/engine-electron-commons';
import testFeature, { serverEnv } from '../test-project/test-feature.feature';

const { expect } = chai;
chai.use(chaiAsPromised);

const testProjectPath = fs.join(__dirname, '../test-project');

const setupRunningEnv = async ({
    errorMode,
    handleUncaught,
    pipeOutput,
}: { errorMode?: 'exception' | 'exit' | 'promiseReject'; handleUncaught?: boolean; pipeOutput?: boolean } = {}) => {
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
            stdio: pipeOutput === true ? ['pipe', 'pipe', 'pipe', 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc'],
        },
        environmentStartupOptions: {},
    });

    await environmentIsReady;

    const disconnectPromise = new Promise<DisconnectDetails>((res) => {
        onDisconnect(res);
    });

    return {
        onDisconnect,
        dispose,
        disconnectPromise,
    };
};

describe('onDisconnectHandler for node environment initializer', () => {
    describe('without own uncaughtException handling', () => {
        it('should catch on dispose of env', async () => {
            const { dispose, disconnectPromise } = await setupRunningEnv();

            dispose();

            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should catch on env exit intentionally', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exit' });
            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should expose disconnect reason when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.be.deep.eq({
                exitCode: 1,
                signal: null,
                lastSeenError: undefined,
            });
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'promiseReject' });

            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should expose error when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', pipeOutput: true });

            await expect(disconnectPromise).to.eventually.be.fulfilled;
            const disconnectDetails = await disconnectPromise;
            expect(disconnectDetails.lastSeenError).to.not.be.empty;
        });
    });
    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, disconnectPromise } = await setupRunningEnv({ handleUncaught });

            dispose();

            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should catch on env exit intentionally', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exit', handleUncaught });
            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should catch on env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', handleUncaught });

            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should expose disconnect reason when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.be.deep.eq({
                exitCode: 1,
                signal: null,
                lastSeenError: undefined,
            });
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'promiseReject', handleUncaught });

            await expect(disconnectPromise).to.eventually.be.fulfilled;
        });
        it('should expose disconnect reason when env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', pipeOutput: true });

            await expect(disconnectPromise).to.eventually.be.fulfilled;
            const disconnectDetails = await disconnectPromise;
            expect(disconnectDetails.lastSeenError).to.not.be.empty;
        });
    });
});
