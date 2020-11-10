import type io from 'socket.io';
import fs from '@file-services/node';
import {
    IExternalDefinition,
    isFeatureFile,
    loadFeaturesFromPaths,
    runNodeEnvironment,
    TopLevelConfigProvider,
    LaunchEnvironmentMode,
} from '@wixc3/engine-scripts';
import { RuntimeEngine, BaseHost, TopLevelConfig, MapToProxyType } from '@wixc3/engine-core';

import devServerFeature, { devServerEnv } from './feature/dev-server.feature';
import guiFeature from './feature/gui.feature';

const basePath = fs.join(__dirname, './feature');

export interface IStartOptions {
    publicPath?: string;
    targetApplicationPath: string;
    outputPath?: string;
    featureName?: string;
    configName?: string;
    httpServerPort?: number;
    singleRun?: boolean;
    singleFeature?: boolean;
    pathsToRequire?: string[];
    mode?: 'development' | 'production';
    title?: string;
    publicConfigsRoute?: string;
    autoLaunch?: boolean;
    engineerEntry?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    inspect?: boolean;
    runtimeOptions?: Record<string, string | boolean>;
    externalFeatureDefinitions?: IExternalDefinition[];
    externalFeaturesPath?: string;
    featureDiscoveryRoot?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    socketServerOptions?: Partial<io.ServerOptions>;
}

export async function startDevServer({
    featureName,
    configName,
    httpServerPort = 3000,
    singleRun,
    singleFeature,
    pathsToRequire = [],
    publicPath = '/',
    mode = 'development',
    title,
    publicConfigsRoute = 'configs/',
    autoLaunch = true,
    targetApplicationPath,
    engineerEntry = 'engineer/gui',
    overrideConfig = [],
    outputPath,
    inspect,
    runtimeOptions = {},
    externalFeatureDefinitions = [],
    externalFeaturesPath,
    featureDiscoveryRoot,
    nodeEnvironmentsMode,
    socketServerOptions,
}: IStartOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
    devServerFeature: MapToProxyType<typeof devServerFeature['api']>;
}> {
    const featurePaths = fs.findFilesSync(basePath, {
        filterFile: ({ name }) => isFeatureFile(name),
    });
    preRequire(pathsToRequire, basePath);

    const features = loadFeaturesFromPaths(new Set(featurePaths), new Set([basePath]), fs).features;

    const { engine, dispose } = await runNodeEnvironment({
        featureName: engineerEntry,
        features: [...features],
        name: devServerEnv.env,
        type: 'node',
        host: new BaseHost(),
        config: [
            devServerFeature.use({
                devServerConfig: {
                    httpServerPort,
                    featureName,
                    singleRun,
                    singleFeature,
                    publicPath,
                    mode,
                    configName,
                    title,
                    publicConfigsRoute,
                    autoLaunch,
                    basePath: targetApplicationPath,
                    overrideConfig,
                    outputPath,
                    inspect,
                    defaultRuntimeOptions: runtimeOptions,
                    externalFeatureDefinitions,
                    externalFeaturesPath,
                    featureDiscoveryRoot,
                    nodeEnvironmentsMode,
                    socketServerOptions,
                },
            }),
            guiFeature.use({
                engineerConfig: {
                    features,
                },
            }),
        ],
        externalFeatures: [],
    });
    return {
        engine,
        dispose,
        devServerFeature: engine.get(devServerFeature).api,
    };
}

function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        require(resolvedRequest);
    }
}
