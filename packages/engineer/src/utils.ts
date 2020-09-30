import { resolve } from 'path';
import fs from '@file-services/node';
import {
    isFeatureFile,
    loadFeaturesFromPaths,
    runNodeEnvironment,
    TopLevelConfigProvider,
} from '@wixc3/engine-scripts';
import { RuntimeEngine, BaseHost, TopLevelConfig } from '@wixc3/engine-core';

import devServerFeature, { devServerEnv } from '../feature/dev-server.feature';
import guiFeature from '../feature/gui.feature';

export interface IStartOptions {
    outputPath: string;
    targetApplicationPath: string;
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
}

export function startDevServer({
    featureName,
    configName,
    httpServerPort = 3000,
    singleRun,
    singleFeature,
    pathsToRequire = [],
    outputPath,
    mode = 'development',
    title,
    publicConfigsRoute = 'configs/',
    autoLaunch,
    targetApplicationPath,
    engineerEntry = 'engineer/gui',
    overrideConfig = [],
}: IStartOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
}> {
    const basePath = resolve(__dirname, '../feature');
    const featurePaths = fs.findFilesSync(basePath, {
        filterFile: ({ name }) => isFeatureFile(name),
    });
    preRequire(pathsToRequire, basePath);

    const features = loadFeaturesFromPaths(new Set(featurePaths), new Set([basePath]), fs).features;

    return runNodeEnvironment({
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
                    publicPath: outputPath,
                    mode,
                    configName,
                    title,
                    publicConfigsRoute,
                    autoLaunch,
                    basePath: targetApplicationPath,
                    overrideConfig,
                },
            }),
            guiFeature.use({
                engineerConfig: {
                    features,
                },
            }),
        ],
    });
}

function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        require(resolvedRequest);
    }
}
