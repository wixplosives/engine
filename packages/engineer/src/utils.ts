import fs from '@file-services/node';
import { BaseHost, RuntimeEngine, RuntimeFeature, TopLevelConfig } from '@wixc3/engine-core';
import { isFeatureFile, loadFeaturesFromPaths } from '@wixc3/engine-scripts';
import type io from 'socket.io';

import { LaunchEnvironmentMode, runNodeEnvironment, TopLevelConfigProvider } from '@wixc3/engine-runtime-node';
import { TargetApplication } from './application-proxy-service';
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
    featureDiscoveryRoot?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    socketServerOptions?: Partial<io.ServerOptions>;
    webpackConfigPath?: string;
    log?: boolean;
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
    featureDiscoveryRoot,
    nodeEnvironmentsMode,
    socketServerOptions,
    webpackConfigPath,
    log,
}: IStartOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
    devServerFeature: RuntimeFeature<typeof devServerFeature, typeof devServerEnv>['api'];
    outputPath: string | undefined;
}> {
    const app = new TargetApplication({
        basePath: targetApplicationPath,
    });
    const { config: engineConfig } = await app.getEngineConfig();

    const { require, favicon: configFavicon, featureDiscoveryRoot: configFeatureDiscoveryRoot } = engineConfig ?? {};

    const featurePaths = fs.findFilesSync(basePath, {
        filterFile: ({ name }) => isFeatureFile(name),
    });
    preRequire([...pathsToRequire, ...(require ?? [])], basePath);

    const { features } = loadFeaturesFromPaths(new Set(featurePaths), new Set([basePath]), fs);
    const { engine, dispose } = await runNodeEnvironment({
        featureName: engineerEntry,
        features: [...features],
        bundlePath: app.outputPath,
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
                    featureDiscoveryRoot: featureDiscoveryRoot ?? configFeatureDiscoveryRoot,
                    nodeEnvironmentsMode,
                    socketServerOptions,
                    webpackConfigPath,
                    log,
                },
            }),
            guiFeature.use({
                engineerConfig: {
                    features,
                },
            }),
        ],
        context: targetApplicationPath,
        env: devServerEnv,
    });
    return {
        engine,
        outputPath: app.outputPath,
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
