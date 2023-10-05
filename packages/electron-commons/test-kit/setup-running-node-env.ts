import { nodeFs as fs } from '@file-services/node';
import { BaseHost, Communication, Environment, type TopLevelConfig } from '@wixc3/engine-core';
import { initializeNodeEnvironment, type ProcessExitDetails } from '@wixc3/engine-electron-commons';
import { findFeatures } from '@wixc3/engine-scripts';
import type { IOType } from 'node:child_process';
import { createRequire } from 'node:module';
import { deferred } from 'promise-assist';

const require = createRequire(import.meta.url);
const nodeEntryPath = require.resolve('@wixc3/engine-electron-commons/node-entry');

export interface SetupRunningEnvOptions {
    featurePath: string;
    featureId: string;
    env: Environment<any, 'node', any, any>;
    config?: TopLevelConfig;
    stdio?: IOType;
}

export const setupRunningNodeEnv = async ({
    featurePath,
    featureId,
    env,
    config,
    stdio = 'ignore',
}: SetupRunningEnvOptions) => {
    const communication = new Communication(new BaseHost(), 'someId');
    const { features } = await findFeatures(featurePath, fs, 'dist');
    const { onExit, dispose, environmentIsReady } = initializeNodeEnvironment({
        communication,
        env,
        runtimeArguments: {
            featureName: featureId,
            basePath: featurePath,
            outputPath: fs.join(featurePath, 'dist-app'),
            nodeEntryPath,
            config: config ?? [],
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
        communication,
        onExit,
        dispose,
        exitPromise: environmentExit.promise,
    };
};
