import fs from '@file-services/node';
import { isFeatureFile, loadFeaturesFromPaths, getExternalFeaturesMetadata } from '@wixc3/engine-scripts';
import { RuntimeEngine, BaseHost, RuntimeFeature } from '@wixc3/engine-core';
import devServerFeature, { devServerEnv } from './feature/dev-server.feature';
import guiFeature from './feature/gui.feature';
import { TargetApplication } from './application-proxy-service';
import { runNodeEnvironment } from '@wixc3/engine-runtime-node';
import { defaultOptions, defaultsEngineConfig, DEngineConfig, DStartOptions, IStartOptions } from './utils.types';
import type { DevServerConfig } from './feature/dev-server.types';
import { defaults } from '@wixc3/common'

const basePath = fs.join(__dirname, './feature');

export async function startDevServer(options: IStartOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
    devServerFeature: RuntimeFeature<typeof devServerFeature, typeof devServerEnv>['api'];
    outputPath: string | undefined;
}> {
    const serverOpts = defaults(options, defaultOptions)
    const app = new TargetApplication({
        basePath: serverOpts.targetApplicationPath,
    });
    const { config, path: engineConfigPath } = await app.getEngineConfig();
    const engineCnf = defaults(config, defaultsEngineConfig)
    const featurePaths = options.devServerOnly
        // include only dev-server.feature
        ? fs.join(basePath, 'dev-server.feature.ts')
        // include all features (gui, managed etc)
        : fs.findFilesSync(basePath, {
            filterFile: ({ name }) => isFeatureFile(name),
        })
    preRequire([...serverOpts.pathsToRequire, ...engineCnf.require], basePath);


    const { features } = loadFeaturesFromPaths({ files: new Set(featurePaths), dirs: new Set([basePath]) }, fs);
    const resolvedExternalFeaturesPath = fs.resolve(
        serverOpts.externalFeaturesPath ?? (
            engineCnf.externalFeaturesBasePath
                ? fs.dirname(engineConfigPath!)
                : basePath)
    );

    const externalFeatures = getExternalFeaturesMetadata(
        app.normalizeDefinitionsPackagePath([
            ...engineCnf.externalFeatureDefinitions,
            ...serverOpts.externalFeatureDefinitions]),
        resolvedExternalFeaturesPath
    );

    const { engine, dispose } = await runNodeEnvironment({
        featureName: serverOpts.engineerEntry,
        features: [...features],
        bundlePath: app.outputPath,
        name: devServerEnv.env,
        type: 'node',
        host: new BaseHost(),
        config: [
            devServerFeature.use({
                devServerConfig: asDevConfig(serverOpts, engineCnf),
            }),
            ...options.devServerOnly
                ? []
                : [guiFeature.use({
                    engineerConfig: {
                        features,
                        externalFeatures,
                    },
                })]
        ],
        context: serverOpts.targetApplicationPath,
        externalFeatures,
        env: devServerEnv,
    });
    return {
        engine,
        outputPath: app.outputPath,
        dispose,
        devServerFeature: engine.get(devServerFeature).api,
    };
}

function asDevConfig(options: DStartOptions, engineConfig: DEngineConfig): Partial<DevServerConfig> {
    return {
        ...options,
        favicon: options.favicon ?? engineConfig.favicon,
        basePath: options.targetApplicationPath,
        defaultRuntimeOptions: options.runtimeOptions,
        featureDiscoveryRoot: options.featureDiscoveryRoot ?? engineConfig.featureDiscoveryRoot,
    };
}

function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        require(resolvedRequest);
    }
}
