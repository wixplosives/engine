import type io from 'socket.io';
import fs from '@file-services/node';
import { isFeatureFile, loadFeaturesFromPaths, getExternalFeaturesMetadata } from '@wixc3/engine-scripts';
import { RuntimeEngine, BaseHost, TopLevelConfig, MapToProxyType } from '@wixc3/engine-core';

import devServerFeature, { devServerEnv } from './feature/dev-server.feature';
import guiFeature from './feature/gui.feature';
import { TargetApplication } from './application-proxy-service';
import {
    IExternalDefinition,
    LaunchEnvironmentMode,
    runNodeEnvironment,
    TopLevelConfigProvider,
} from '@wixc3/engine-runtime-node';

const basePath = fs.join(__dirname, './feature');

export interface IStartOptions {
    publicPath?: string;
    targetApplicationPath: string;
    outputPath?: string;
    featureName?: string;
    configName?: string;
    httpServerPort?: number;
    singleFeature?: boolean;
    pathsToRequire?: string[];
    mode?: 'development' | 'production';
    title?: string;
    favicon?: string;
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
    webpackHot?: boolean;
}

export async function startDevServer({
    featureName,
    configName,
    httpServerPort = 3000,
    singleFeature,
    pathsToRequire = [],
    publicPath = '/',
    mode = 'development',
    title,
    favicon,
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
    webpackHot = false,
}: IStartOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
    devServerFeature: MapToProxyType<typeof devServerFeature['api']>;
}> {
    const app = new TargetApplication({
        basePath: targetApplicationPath,
    });
    const { config: engineConfig, path: engineConfigPath } = await app.getEngineConfig();

    const {
        externalFeatureDefinitions: configDefs = [],
        externalFeaturesBasePath: configExternalPath,
        require,
        favicon: configFavicon,
        featureDiscoveryRoot: configFeatureDiscoveryRoot,
    } = engineConfig ?? {};

    const featurePaths = fs.findFilesSync(basePath, {
        filterFile: ({ name }) => isFeatureFile(name),
    });
    preRequire([...pathsToRequire, ...(require ?? [])], basePath);

    const { features } = loadFeaturesFromPaths(new Set(featurePaths), new Set([basePath]), fs);

    const resolvedExternalFeaturesPath = fs.resolve(
        externalFeaturesPath ?? (configExternalPath ? fs.dirname(engineConfigPath!) : basePath)
    );

    const externalFeatures = getExternalFeaturesMetadata(
        app.normalizeDefinitionsPackagePath([...configDefs, ...externalFeatureDefinitions]),
        resolvedExternalFeaturesPath
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
                    singleFeature,
                    publicPath,
                    mode,
                    configName,
                    title,
                    favicon: favicon ?? configFavicon,
                    publicConfigsRoute,
                    autoLaunch,
                    basePath: targetApplicationPath,
                    overrideConfig,
                    outputPath,
                    inspect,
                    defaultRuntimeOptions: runtimeOptions,
                    externalFeatureDefinitions,
                    externalFeaturesPath,
                    featureDiscoveryRoot: featureDiscoveryRoot ?? configFeatureDiscoveryRoot,
                    nodeEnvironmentsMode,
                    socketServerOptions,
                    webpackConfigPath,
                    webpackHot,
                },
            }),
            guiFeature.use({
                engineerConfig: {
                    features,
                    externalFeatures,
                },
            }),
        ],
        context: targetApplicationPath,
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
