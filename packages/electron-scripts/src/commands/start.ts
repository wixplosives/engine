import { nodeFs as fs } from '@file-services/node';
import type { TopLevelConfig } from '@wixc3/engine-core';
import { provideApiForChildProcess, type IRunOptionsMessage } from '@wixc3/engine-electron-host';
import { findFeatures, getExportedEnvironments } from '@wixc3/engine-scripts';
import { startDevServer } from '@wixc3/engineer';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { getConfig } from '../engine-helpers.js';
import { getEngineConfig } from '../find-features.js';

// electron node lib exports the electron executable path; inside electron, it's the api itself.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const electronPath = require('electron') as unknown as string;

export interface IStartCommandOptions {
    /**
     * The feature you want to run
     */
    featureName: string;
    /**
     * The name of the config you want your application to run with
     */
    configName?: string;
    /**
     * The path which is where to search the feature at
     */
    basePath?: string;
    /**
     * The name of the environment running in the electron-main process
     */
    envName: string;
    /**
     * Top level config, or a top level config provider, with which the application will be ran with
     */
    overrideConfig?: ((runningPort: number) => TopLevelConfig) | TopLevelConfig;
    /**
     * Should open the browser window with devtools
     */
    devtools?: boolean;

    featureDiscoveryRoot?: string;
}

export async function start({
    featureName,
    configName,
    basePath = process.cwd(),
    overrideConfig = [],
    envName,
    devtools,
    featureDiscoveryRoot,
}: IStartCommandOptions) {
    const { require: requiredModules, featureDiscoveryRoot: configFeatureDiscoveryRoot } =
        (await getEngineConfig(basePath)) || {};

    const resolvedFeatureDiscoveryRoot = featureDiscoveryRoot ?? configFeatureDiscoveryRoot;

    const {
        engine,
        devServerFeature: { serverListeningHandlerSlot },
    } = await startDevServer({
        autoLaunch: false,
        featureName,
        configName,
        singleFeature: true,
        featureDiscoveryRoot: resolvedFeatureDiscoveryRoot,
        targetApplicationPath: basePath,
    });

    // registering to the dev server ready event
    serverListeningHandlerSlot.register(({ port, router }) => {
        const config: TopLevelConfig = [];
        const { features, configurations } = findFeatures(basePath, fs, resolvedFeatureDiscoveryRoot);

        const environments = getExportedEnvironments(features);

        // doing this in 2 steps as a future step for not needing to provide the environment name in the cli
        const electronHostEnvironments = [...environments].filter(({ type }) => type === 'electron-main');

        const env = electronHostEnvironments.find(({ name }) => name === envName)?.env;

        if (!env) {
            throw new Error(`Environment ${envName} not found`);
        }

        if (configName) {
            config.push(...getConfig(configName, configurations, envName));
        }
        if (overrideConfig) {
            config.push(...(typeof overrideConfig === 'function' ? overrideConfig(port) : overrideConfig));
        }
        // running electon application
        const electronApp = spawn(electronPath, [require.resolve(join(__dirname, '../electron-entry'))], {
            cwd: basePath,
            stdio: ['ipc', 'inherit', 'inherit'],
        });

        provideApiForChildProcess(electronApp, router);

        electronApp.send({
            id: 'runOptions',
            runOptions: {
                featureName,
                envName,
                outputPath: join(basePath, 'dist-app'),
                devport: port,
                basePath,
                configName,
                devtools,
                requiredModules,
                config,
                features: [...features.entries()],
                env,
            },
        } as IRunOptionsMessage);

        electronApp.once('close', () => {
            // eslint-disable-next-line no-console
            engine.shutdown().catch(console.error);
        });
    });
}
