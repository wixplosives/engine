import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from '@file-services/node';
import { BaseHost, Communication } from '@wixc3/engine-core';
import { loadFeaturesFromPackages } from '@wixc3/engine-scripts';
import { initializeNodeEnvironment } from '@wixc3/engine-electron-commons';

import testFeature, { serverEnv } from '../test-project/test-feature.feature';
import { childPackagesFromContext, resolveDirectoryContext } from '@wixc3/resolve-directory-context';

export function findFeatures(
    initialDirectoryPath: string,
    featureDiscoveryRoot = '.'
): ReturnType<typeof loadFeaturesFromPackages> {
    const packagePath = fs.findClosestFileSync(initialDirectoryPath, 'package.json');
    if (!packagePath) {
        throw new Error(`Couldn't find package.json relative to ${initialDirectoryPath}`);
    }
    const packages = childPackagesFromContext(resolveDirectoryContext(packagePath));
    return loadFeaturesFromPackages(packages, fs, featureDiscoveryRoot);
}

const { expect } = chai;
chai.use(chaiAsPromised);

const testProjectPath = fs.join(__dirname, '../test-project');

const setupRunningEnv = async ({
    errorMode,
    handleUncaught,
}: { errorMode?: 'exception' | 'exit' | 'promiseReject'; handleUncaught?: boolean } = {}) => {
    const communication = new Communication(new BaseHost(), 'someId');
    const { features } = findFeatures(testProjectPath, 'dist');
    const { onDisconnect, dispose } = await initializeNodeEnvironment({
        communication,
        env: serverEnv,
        getApplicationMetaData: () =>
            Promise.resolve({
                featureName: testFeature.id,
                basePath: testProjectPath,
                nodeEntryPath: fs.join(testProjectPath, 'entry.js'),
                config: [testFeature.use({ errorType: { type: errorMode, handleUncaught } })],
                features: Array.from(features.entries()),
                externalFeatures: [],
                env: serverEnv,
            }),
        processOptions: { cwd: process.cwd() },
        environmentStartupOptions: {},
    });

    const disconnectPromise = new Promise<boolean>((res) => {
        onDisconnect(() => {
            res(true);
        });
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

            await expect(disconnectPromise).to.eventually.eq(true);
        });
        it('should catch on env exit intentinally', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exit' });
            await expect(disconnectPromise).to.eventually.eq(true);
        });
        it('shuold catch on env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception' });

            await expect(disconnectPromise).to.eventually.eq(true);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'promiseReject' });

            await expect(disconnectPromise).to.eventually.eq(true);
        });
    });
    describe('with own uncaughtException handling', () => {
        const handleUncaught = true;
        it('should catch on dispose of env', async () => {
            const { dispose, disconnectPromise } = await setupRunningEnv({ handleUncaught });

            dispose();

            await expect(disconnectPromise).to.eventually.eq(true);
        });
        it('should catch on env exit intentinally', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exit', handleUncaught });
            await expect(disconnectPromise).to.eventually.eq(true);
        });
        it('shuold catch on env throwing uncaught exception', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'exception', handleUncaught });

            await expect(disconnectPromise).to.eventually.eq(true);
        });
        it('should catch on env unhandled promise rejection', async () => {
            const { disconnectPromise } = await setupRunningEnv({ errorMode: 'promiseReject', handleUncaught });

            await expect(disconnectPromise).to.eventually.eq(true);
        });
    });
});
