import { app, BrowserWindow, ipcMain } from 'electron';
import { BaseHost, TopLevelConfig, RuntimeEngine, Environment } from '@wixc3/engine-core';
import fs from '@file-services/node';
import { IStaticFeatureDefinition, runNodeEnvironment } from '@wixc3/engine-runtime-node';
import {
    communicationChannels,
    electronRuntimeArguments,
    externalFeaturesManager,
    IEngineRuntimeArguments,
} from '@wixc3/engine-electron-commons';
import { importModules } from '@wixc3/engine-electron-commons/dist/import-modules';
import { getParentProcessApi } from './ipc-communication';
import runtimeArgumentsProvider from './runtime-arguments-provider';

const EXTERNAL_FEATURES_BASE_URI = 'external-features';
const nodeEntryPath = require.resolve('@wixc3/engine-electron-commons/node-entry');

export interface ElectronEnvParams {
    basePath: string;
    outputPath: string;
    featureName?: string;
    configName?: string;
    devport?: number;
    devtools?: boolean;
    outDir?: string;
    externalsPath?: string;
    features: Map<string, Required<IStaticFeatureDefinition>>;
    config: TopLevelConfig;
    requiredModules?: string[];
    env: Environment;
}
export const DEFAULT_EXTERNAL_FEATURES_PATH = '/external-features.json';

export async function runElectronEnv({
    basePath,
    outputPath = fs.join(basePath, 'dist-app'),
    configName,
    featureName,
    devport,
    devtools,
    externalsPath = DEFAULT_EXTERNAL_FEATURES_PATH,
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

    const getRuntimeArguments: () => Promise<IEngineRuntimeArguments> = async () => {
        const externalFeatures = await Promise.all(
            externalFeaturesManager
                .getMapped()
                .map(async (externalFeaturesResult) =>
                    externalFeaturesResult instanceof Promise ? await externalFeaturesResult : externalFeaturesResult
                )
        );

        return {
            basePath,
            featureName,
            outputPath,
            configName,
            nodeEntryPath,
            devtools,
            devport,
            externalsPath,
            features: Array.from(features.entries()),
            config: generalConfig,
            requiredModules,
            externalFeatures,
            runtimeOptions: Array.from(runOptions.entries()),
        };
    };
    runtimeArgumentsProvider.setProvider(getRuntimeArguments);
    ipcMain.handle(communicationChannels.engineRuntimeArguments, () => runtimeArgumentsProvider.getRuntimeArguments());
    ipcMain.handle(externalsPath, () => externalFeaturesManager.getMapped());

    // creating runOptions for the electron host environment. ipcMain cannot invoke events from itself, only ipcRenderer can, so we cannot use communicationChannels.engineRuntimeArguments
    runOptions.set(electronRuntimeArguments.runtimeFeatureName, featureName);
    runOptions.set(electronRuntimeArguments.devtools, !!devtools);

    if (configName) {
        runOptions.set(electronRuntimeArguments.runtimeConfigName, configName);
    }
    // in dev mode, we always have to have a port from where the main environment is being served from
    if (devport) {
        runOptions.set(electronRuntimeArguments.devport, `${devport}`);
        const api = getParentProcessApi();
        const routes = new Map<string, string>();
        externalFeaturesManager.setEntryMapper((externalFeature) => {
            const { envEntries, packageName } = externalFeature;
            for (const [envName, entries] of Object.entries(envEntries)) {
                for (const [target, entryPath] of Object.entries(entries)) {
                    if (target !== 'node') {
                        if (!routes.has(entryPath)) {
                            const route = `/${EXTERNAL_FEATURES_BASE_URI}/${packageName}`;
                            api.registerExternalRoute(fs.dirname(entryPath), route).catch((ex) => {
                                routes.delete(entryPath);
                                // eslint-disable-next-line no-console
                                console.error(ex);
                            });
                            routes.set(entryPath, route);
                        }
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        envEntries[envName]![target] = routes.get(entryPath)! + '/' + fs.basename(entryPath);
                    }
                }
            }
            return {
                ...externalFeature,
                envEntries,
            };
        });
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

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    app.on('window-all-closed', async () => {
        // Don't quit between closing one window and immediately opening another.
        await new Promise((res) => setTimeout(res, 0));

        if (BrowserWindow.getAllWindows().length === 0) {
            try {
                await runningEnvironment.dispose();
            } catch (e) {
                process.exitCode = 1;
                // eslint-disable-next-line no-console
                console.error(e);
            }
            app.quit();
        }
    });

    return runningEnvironment;
}
