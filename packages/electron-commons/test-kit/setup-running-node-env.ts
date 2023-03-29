import fs from '@file-services/node';
import type { IOType } from 'child_process';
import { deferred } from 'promise-assist';

import { BaseHost, Communication, Environment, TopLevelConfig } from '@wixc3/engine-core';
import { initializeNodeEnvironment, ProcessExitDetails } from '@wixc3/engine-electron-commons';
import { findFeatures } from '@wixc3/engine-scripts';

const nodeEntryPath = require.resolve('@wixc3/engine-electron-commons/node-entry');
const workerThreadEntryPath = require.resolve('@wixc3/engine-runtime-node/worker-thread-entry');

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
    const { features } = findFeatures(featurePath, fs, 'dist');
    const { onExit, dispose, environmentIsReady } = initializeNodeEnvironment({
        communication,
        env,
        runtimeArguments: {
            featureName: featureId,
            basePath: featurePath,
            outputPath: fs.join(featurePath, 'dist-app'),
            nodeEntryPath,
            workerThreadEntryPath,
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
        onExit,
        dispose,
        exitPromise: environmentExit.promise,
    };
};
