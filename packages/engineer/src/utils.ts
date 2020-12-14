import type io from 'socket.io';
import fs from '@file-services/node';
import {
    IExternalDefinition,
    isFeatureFile,
    loadFeaturesFromPaths,
    runNodeEnvironment,
    TopLevelConfigProvider,
    LaunchEnvironmentMode,
    getExternalFeaturesMetadata,
} from '@wixc3/engine-scripts';
import { RuntimeEngine, BaseHost, TopLevelConfig, MapToProxyType } from '@wixc3/engine-core';

import devServerFeature, { devServerEnv } from './feature/dev-server.feature';
import guiFeature from './feature/gui.feature';
import { TargetApplication } from './application-proxy-service';
import { join } from 'path';

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
    webpackConfigPath?: string;
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
    webpackConfigPath,
}: IStartOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
    devServerFeature: MapToProxyType<typeof devServerFeature['api']>;
}> {
    const app = new TargetApplication({
        basePath: targetApplicationPath,
    });
    const { externalFeatureDefinitions: configDefs = [], externalFeaturesPath: configExternalPath, require } =
        (await app.getEngineConfig()) ?? {};
    const featurePaths = fs.findFilesSync(basePath, {
        filterFile: ({ name }) => isFeatureFile(name),
    });
    preRequire([...pathsToRequire, ...(require ?? [])], basePath);

    const features = loadFeaturesFromPaths(new Set(featurePaths), new Set([basePath]), fs).features;
    const engineConfigPath = await app.getClosestEngineConfigPath();
    const externalFeatures = getExternalFeaturesMetadata(
        [...configDefs, ...externalFeatureDefinitions],
        engineConfigPath ? fs.dirname(engineConfigPath) : targetApplicationPath,
        externalFeaturesPath ?? configExternalPath ?? join(targetApplicationPath, 'node_modules')
    );
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
                    webpackConfigPath,
                },
            }),
            guiFeature.use({
                engineerConfig: {
                    features,
                    externalFeatures,
                },
            }),
        ],
        externalFeatures,
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
