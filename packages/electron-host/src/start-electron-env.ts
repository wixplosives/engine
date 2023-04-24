import fs from '@file-services/node';
import { app, ipcMain } from 'electron';

import { BaseHost, Environment, RuntimeEngine, TopLevelConfig } from '@wixc3/engine-core';
import { IEngineRuntimeArguments } from '@wixc3/engine-core-node';
import { communicationChannels, electronRuntimeArguments } from '@wixc3/engine-electron-commons';
import { importModules, IStaticFeatureDefinition, runNodeEnvironment } from '@wixc3/engine-runtime-node';

import runtimeArgumentsProvider from './runtime-arguments-provider';

const nodeEntryPath = require.resolve('@wixc3/engine-electron-commons/node-entry');

export interface ElectronEnvParams {
    basePath: string;
    outputPath: string;
    featureName?: string;
    configName?: string;
    devport?: number;
    devtools?: boolean;
    outDir?: string;
    features: Map<string, Required<IStaticFeatureDefinition>>;
    config: TopLevelConfig;
    requiredModules?: string[];
    env: Environment;
}

export async function runElectronEnv({
    basePath,
    outputPath = fs.join(basePath, 'dist-app'),
    configName,
    featureName,
    devport,
    devtools,
    features,
    config,
    requiredModules,
    env,
}: ElectronEnvParams): Promise<{
    dispose: () => void;
    engine: RuntimeEngine;
}> {
    if (requiredModules) {
        await importModules(basePath, requiredModules);
    }

    if (!featureName) {
        throw new Error('Must provide a featureName');
    }

    if (!app.isReady()) {
        await new Promise((resolve) => app.once('ready', resolve));
    }

    /****************
     Now, after application is ready, running the electron-main environment
     ****************/

    // creating a communication channel, that will be used for node environment initialization

    const generalConfig: TopLevelConfig = [...config];
    const runOptions = new Map<string, string | boolean>();

    const getRuntimeArguments: () => Promise<IEngineRuntimeArguments> = () => {
        return Promise.resolve({
            basePath,
            featureName,
            outputPath,
            configName,
            nodeEntryPath,
            devtools,
            devport,
            features: Array.from(features.entries()),
            config: generalConfig,
            requiredModules,
            runtimeOptions: Array.from(runOptions.entries()),
        });
    };
    runtimeArgumentsProvider.setProvider(getRuntimeArguments);
    ipcMain.handle(communicationChannels.engineRuntimeArguments, () => runtimeArgumentsProvider.getRuntimeArguments());

    // creating runOptions for the electron host environment. ipcMain cannot invoke events from itself, only ipcRenderer can, so we cannot use communicationChannels.engineRuntimeArguments
    runOptions.set(electronRuntimeArguments.runtimeFeatureName, featureName);
    runOptions.set(electronRuntimeArguments.devtools, !!devtools);

    if (configName) {
        runOptions.set(electronRuntimeArguments.runtimeConfigName, configName);
    }
    // in dev mode, we always have to have a port from where the main environment is being served from
    if (devport) {
        runOptions.set(electronRuntimeArguments.devport, `${devport}`);
    } else {
        runOptions.set(electronRuntimeArguments.outPath, basePath);
    }
    if (devtools !== undefined) {
        runOptions.set(electronRuntimeArguments.devtools, devtools);
    }

    const runningEnvironment = await runNodeEnvironment({
        featureName,
        features: [...features.entries()],
        name: env.env,
        bundlePath: electronRuntimeArguments.outPath,
        type: 'node',
        host: new BaseHost(),
        config,
        options: [...runOptions.entries()],
        env,
    });

    return runningEnvironment;
}
